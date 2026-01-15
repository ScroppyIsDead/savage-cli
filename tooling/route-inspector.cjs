const fs = require("node:fs");
const path = require("node:path");
const Module = require("module");
const yaml = require("js-yaml");
const esbuild = require("esbuild");

const featuresRoot = path.resolve("features");

function toRouteArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizePrefix(prefix) {
  if (prefix === false || prefix === undefined || prefix === null) return undefined;
  const normalized = `${prefix}`.replace(/^\/+|\/+$/g, "");
  return normalized || undefined;
}

function splitAbsolutePaths(routes) {
  const prefixed = [];
  const absolute = [];
  for (const route of routes) {
    if (route && typeof route.path === "string" && route.path.startsWith("/")) {
      const cloned = { ...route, path: route.path.replace(/\/+/g, "/") };
      absolute.push(cloned);
    } else if (route) {
      prefixed.push(route);
    }
  }
  return { prefixed, absolute };
}

function groupRoutesByPrefix(descriptor) {
  const { prefixed, absolute } = splitAbsolutePaths(descriptor.routes);
  const prefix = normalizePrefix(descriptor.routePrefix);
  const grouped = [...absolute];

  if (prefixed.length > 0) {
    if (prefix) {
      grouped.push({
        path: prefix,
        children: prefixed
      });
    } else {
      grouped.push(...prefixed);
    }
  }

  return grouped;
}

function buildPath(routePath, parentPath) {
  if (routePath && typeof routePath === "string" && routePath.startsWith("/")) {
    return normalizeRoutePath(routePath);
  }

  const cleanParent = parentPath === "" ? "" : parentPath.replace(/\/+$/, "");
  const cleanSegment = (routePath ?? "").replace(/^\/+/, "");

  if (!cleanSegment) {
    return cleanParent || "/";
  }

  if (!cleanParent) {
    return `/${cleanSegment}`.replace(/\/+/g, "/");
  }

  return `${cleanParent}/${cleanSegment}`.replace(/\/+/g, "/");
}

function normalizeRoutePath(value) {
  if (!value && value !== "") return value;
  let normalized = value.replace(/\/+/g, "/");
  if (normalized === "") return "/";
  if (normalized !== "/" && normalized.endsWith("/")) {
    normalized = normalized.replace(/\/+$/, "");
  }
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  return normalized;
}

function collectRoutes(routes, featureName, summary, routeMap, nameMap) {
  function visit(route, basePath) {
    const currentPath = route.index ? basePath || "/" : buildPath(route.path, basePath);
    const routeName = route.name ?? `${currentPath} (unnamed)`;
    const isContainer =
      route.element == null && Array.isArray(route.children) && route.children.length > 0;

    if (!isContainer) {
      summary.push({ feature: featureName, name: routeName, path: currentPath });

      const entry = routeMap.get(currentPath) ?? { names: [], features: new Set() };
      entry.names.push(routeName);
      entry.features.add(featureName);
      routeMap.set(currentPath, entry);

      const nameEntry = nameMap.get(routeName) ?? { paths: [], features: new Set() };
      nameEntry.paths.push(currentPath);
      nameEntry.features.add(featureName);
      nameMap.set(routeName, nameEntry);
    }

    if (Array.isArray(route.children)) {
      for (const child of route.children) {
        visit(child, currentPath === "/" ? "" : currentPath);
      }
    }
  }

  for (const route of routes) {
    visit(route, "");
  }
}

function loadRoutesModule(routesPath) {
  const tsconfigPath = fs.existsSync(path.resolve("tsconfig.app.json"))
    ? path.resolve("tsconfig.app.json")
    : path.resolve("tsconfig.json");

  const result = esbuild.buildSync({
      entryPoints: [routesPath],
      bundle: true,
      format: "cjs",
      platform: "node",
      target: ["node18"],
      write: false,
      absWorkingDir: path.dirname(routesPath),
      sourcemap: "inline",
      tsconfig: tsconfigPath,
      loader: {
        ".ts": "ts",
        ".tsx": "tsx"
      },
    logLevel: "silent"
  });

  const compiled = result.outputFiles?.[0]?.text;
  if (!compiled) {
    throw new Error(`esbuild did not emit compiled code for ${routesPath}`);
  }

  const moduleInstance = new Module(routesPath, module.parent);
  moduleInstance.filename = routesPath;
  moduleInstance.paths = Module._nodeModulePaths(path.dirname(routesPath));
  moduleInstance._compile(compiled, routesPath);
  return moduleInstance.exports;
}

const configCache = new Map();

function readFeatureConfig(featureName) {
  if (configCache.has(featureName)) {
    return configCache.get(featureName);
  }

  const configPath = path.join(featuresRoot, featureName, "feature.config");
  if (!fs.existsSync(configPath)) {
    configCache.set(featureName, {});
    return {};
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = yaml.load(raw);
    configCache.set(featureName, parsed ?? {});
    return parsed ?? {};
  } catch (error) {
    throw new Error(`Failed to read feature config (${featureName}): ${error.message}`);
  }
}

function detectFeatures() {
  if (!fs.existsSync(featuresRoot)) {
    return [];
  }

  return fs.readdirSync(featuresRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
}

function validateCaseSensitivePath(resolvedPath) {
  // Handle both absolute and relative paths correctly on Windows and Unix
  const parsed = path.parse(resolvedPath);
  const isAbsolute = path.isAbsolute(resolvedPath);
  
  // Start from root for absolute paths, current directory for relative
  let base = isAbsolute ? parsed.root : path.resolve(".");
  
  // Extract directory path relative to root (handles Windows drive letters correctly)
  const dirPath = isAbsolute 
    ? parsed.dir.slice(parsed.root.length) 
    : parsed.dir;
  
  // Split into parts, filtering out empty strings
  const parts = dirPath ? dirPath.split(path.sep).filter(Boolean) : [];
  
  // Add filename to parts if present
  if (parsed.base) {
    parts.push(parsed.base);
  }
  
  // Walk through each part and verify case-sensitive existence
  for (const part of parts) {
    try {
      const entries = fs.readdirSync(base);
      // Check if the exact case-sensitive name exists
      if (!entries.includes(part)) {
        return null;
      }
      base = path.join(base, part);
    } catch {
      // If we can't read the directory, the path is invalid
      return null;
    }
  }
  
  return base;
}

function lazyImportExists(featureName, lazyImport) {
  if (!lazyImport) return false;
  const normalizedImport = lazyImport.replace(/^\.\//, "");
  const candidates = [
    path.join(featuresRoot, featureName, normalizedImport),
    path.resolve(normalizedImport),
    path.resolve(normalizedImport.replace(/^\.\/+/, "")),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const resolved = validateCaseSensitivePath(candidate);
    if (resolved) return candidate;
  }
  return false;
}

function checkLazyImports(routes, featureName, missing, routesPath, parentName = "") {
  for (const route of routes) {
    if (!route) continue;
    const lazyImport = route.lazyImport || route.handle?.lazyImport;
    const resolved = lazyImport && lazyImportExists(featureName, lazyImport);
    if (lazyImport && !resolved) {
      missing.push({
        feature: featureName,
        routeName: route.name ?? parentName ?? route.path ?? "unnamed",
        path: route.path,
        lazyImport,
        routesPath,
      });
    }
    if (Array.isArray(route.children)) {
      checkLazyImports(route.children, featureName, missing, routesPath, route.name);
    }
  }
}

function checkPrefetchImports(
  routes,
  featureName,
  missing,
  routesPath,
  parentName = ""
) {
  for (const route of routes) {
    if (!route) continue;
    const routeName = route.name ?? parentName ?? route.path ?? "unnamed";
    const prefetchPaths = route.handle?.prefetch ?? route.prefetch;
    if (Array.isArray(prefetchPaths)) {
      for (const prefetchPath of prefetchPaths) {
        if (!prefetchPath) continue;
        const resolved = lazyImportExists(featureName, prefetchPath);
        if (!resolved) {
          missing.push({
            feature: featureName,
            routeName,
            path: route.path,
            prefetchPath,
            routesPath,
          });
        }
      }
    }
    if (Array.isArray(route.children)) {
      checkPrefetchImports(route.children, featureName, missing, routesPath, routeName);
    }
  }
}

function analyzeRoutes() {
  const summary = [];
  const routeMap = new Map();
  const nameMap = new Map();
  const missingLazyImports = [];
  const missingPrefetchImports = [];

  for (const entry of detectFeatures()) {
    const featureName = entry.name;
    const routesPath = path.join(featuresRoot, featureName, "routes.tsx");
    if (!fs.existsSync(routesPath)) continue;

    const moduleExports = loadRoutesModule(routesPath);
    const config = readFeatureConfig(featureName);
    const routeDefinitions = toRouteArray(moduleExports.routes ?? moduleExports.default);
    if (!routeDefinitions.length) continue;

    const descriptor = {
      name: featureName,
      routePrefix: moduleExports.routePrefix ?? config.routePrefix ?? featureName,
      routes: routeDefinitions
    };
    checkLazyImports(descriptor.routes, featureName, missingLazyImports, routesPath);
    checkPrefetchImports(
      descriptor.routes,
      featureName,
      missingPrefetchImports,
      routesPath
    );

    const finalRoutes = groupRoutesByPrefix(descriptor);
    collectRoutes(finalRoutes, featureName, summary, routeMap, nameMap);
  }

  const duplicates = [];
  for (const [routePath, metadata] of routeMap.entries()) {
    if (metadata.names.length > 1) {
      duplicates.push({
        path: routePath,
        names: metadata.names,
        features: Array.from(metadata.features)
      });
    }
  }

  const nameDuplicates = [];
  for (const [name, metadata] of nameMap.entries()) {
    if (metadata.paths.length > 1) {
      nameDuplicates.push({
        name,
        paths: metadata.paths,
        features: Array.from(metadata.features)
      });
    }
  }

  return {
    summary,
    duplicates,
    nameDuplicates,
    missingLazyImports,
    missingPrefetchImports,
  };
}

function buildManifestRoute(route) {
  const manifestEntry = {};
  if (route.path !== undefined) {
    manifestEntry.path = route.path;
  }
  if (route.name !== undefined) {
    manifestEntry.name = route.name;
  }
  if (route.index) {
    manifestEntry.index = true;
  }
  if (route.caseSensitive) {
    manifestEntry.caseSensitive = true;
  }
    if (route.handle) {
      const handleEntry = {};
      if (route.handle.lazyImport) {
        handleEntry.lazyImport = route.handle.lazyImport;
      }
      if (route.handle.skipLazy) {
        handleEntry.skipLazy = true;
      }
      if (route.handle.policies) {
        handleEntry.policies = route.handle.policies;
      }
      if (route.handle.prefetch) {
        handleEntry.prefetch = route.handle.prefetch;
      }
      if (Object.keys(handleEntry).length) {
        manifestEntry.handle = handleEntry;
      }
    }
  if (Array.isArray(route.children) && route.children.length > 0) {
    manifestEntry.children = route.children.map(buildManifestRoute);
  }
  return manifestEntry;
}

function generateRouteManifest() {
  const manifest = [];

  for (const entry of detectFeatures()) {
    const featureName = entry.name;
    const routesPath = path.join(featuresRoot, featureName, "routes.tsx");
    if (!fs.existsSync(routesPath)) continue;

    const moduleExports = loadRoutesModule(routesPath);
    const config = readFeatureConfig(featureName);
    const routeDefinitions = toRouteArray(moduleExports.routes ?? moduleExports.default);
    if (!routeDefinitions.length) continue;

    manifest.push({
      name: featureName,
      routePrefix: moduleExports.routePrefix ?? config.routePrefix ?? featureName,
      config,
      routes: routeDefinitions.map(buildManifestRoute),
    });
  }

  return manifest;
}

module.exports = {
  analyzeRoutes,
  generateRouteManifest,
};
