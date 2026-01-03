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
  const result = esbuild.buildSync({
    entryPoints: [routesPath],
    bundle: true,
    format: "cjs",
    platform: "node",
    target: ["node18"],
    write: false,
    absWorkingDir: path.dirname(routesPath),
    sourcemap: "inline",
    tsconfig: path.resolve("tsconfig.json"),
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

function analyzeRoutes() {
  const summary = [];
  const routeMap = new Map();
  const nameMap = new Map();

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

  return { summary, duplicates, nameDuplicates };
}

module.exports = {
  analyzeRoutes
};
