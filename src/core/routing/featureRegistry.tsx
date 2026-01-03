import React, { Suspense, type ComponentType, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import FeatureRuntimeWrapper from "./FeatureRuntimeWrapper";
import yaml from "js-yaml";
import NotFound from "../../routes/NotFound";

interface FeatureConfig {
  name?: string;
  version?: string;
  public?: {
    exports?: Array<{ name: string }>;
    hooks?: Record<string, string>;
  };
  routes?: Array<{ name?: string }>;
  policies?: Record<string, unknown>;
  routePrefix?: string | false;
}

interface FeatureDescriptor {
  name: string;
  config: FeatureConfig;
  routes: NamedRouteObject[];
  routePrefix?: string | false;
}

interface RouteHandle {
  featureName: string;
  routeName: string;
  routePath?: string;
  featureVersion?: string;
  lazyImport?: string;
  skipLazy?: boolean;
  policies?: Record<string, unknown>;
}

type NamedRouteObject = RouteObject & { name?: string; handle?: RouteHandle };

function extractFeatureName(filePath: string) {
  const match = filePath.split("features/")[1];
  if (!match) return "";
  return match.split("/")[0];
}

function toRouteArray(
  value: RouteObject | RouteObject[] | undefined
): NamedRouteObject[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizePrefix(prefix?: string | false): string | undefined {
  if (prefix === false || prefix === undefined || prefix === null)
    return undefined;
  const normalized = `${prefix}`.replace(/^\/+|\/+$/g, "");
  return normalized || undefined;
}

const configModules = import.meta.glob<string>(
  "../../../features/*/feature.config",
  {
    query: "?raw",
    import: "default",
    eager: true,
  }
);
type RouteModule = {
  routes?: RouteObject | RouteObject[];
  default?: RouteObject | RouteObject[];
  routePrefix?: string | false;
};
const routeModules = import.meta.glob<RouteModule>(
  "../../../features/*/routes.tsx",
  { eager: true }
);

const featureDescriptors: FeatureDescriptor[] = Object.entries(
  configModules
).map(([filePath, raw]) => {
  const name = extractFeatureName(filePath);
  const config = (yaml.load(raw) as FeatureConfig) ?? {};
  return {
    name,
    config,
    routes: [],
  };
});

for (const [filePath, module] of Object.entries(routeModules)) {
  const name = extractFeatureName(filePath);
  const descriptor = featureDescriptors.find((entry) => entry.name === name);
  if (!descriptor) continue;
  const exportedRoutes = module.routes ?? module.default;
  descriptor.routes = toRouteArray(exportedRoutes);
  const prefixCandidate =
    module.routePrefix ?? descriptor.config.routePrefix ?? descriptor.name;
  descriptor.routePrefix = prefixCandidate;
}

for (const descriptor of featureDescriptors) {
  if (descriptor.routePrefix === undefined) {
    descriptor.routePrefix = descriptor.config.routePrefix ?? descriptor.name;
  }
}

type LazyPageModule = { default: ComponentType<unknown> };
type LazyPageLoader = () => Promise<LazyPageModule>;
const pageLoaders = import.meta.glob<LazyPageModule>(
  "../../../features/*/pages/**/*.{ts,tsx}"
) as Record<string, LazyPageLoader | undefined>;

function resolveLazyElement(
  descriptor: FeatureDescriptor,
  handle?: RouteHandle
) {
  if (!handle?.lazyImport || handle.skipLazy) return undefined;
  const normalizedImport = handle.lazyImport.replace(/^\.\//, "");
  const candidates = [
    `../../features/${descriptor.name}/${normalizedImport}`,
    normalizedImport,
    normalizedImport.replace(/^\.\/+/, ""),
    `./${normalizedImport}`,
  ];
  let loader: LazyPageLoader | undefined;
  for (const candidate of candidates) {
    loader = pageLoaders[candidate];
    if (loader) break;
  }
  if (!loader) {
    const fallback = Object.entries(pageLoaders).find(([path]) =>
      path.endsWith(normalizedImport)
    );
    loader = fallback ? fallback[1] : undefined;
  }
  const resolvedLoader = loader;
  if (!resolvedLoader) {
    console.warn(
      `Lazy import not found for feature ${descriptor.name}: ${handle.lazyImport} (expected ${candidates[0]}).`
    );
    return undefined;
  }
  const element = React.lazy(() => resolvedLoader());
  return element;
}

function wrapRoutes(
  routes: NamedRouteObject[],
  descriptor: FeatureDescriptor
): RouteObject[] {
  const mapped = routes.map((route) => {
    const normalizedRoute = { ...route };
    const routeName =
      normalizedRoute.name ??
      normalizedRoute.path ??
      `${descriptor.name}.route`;
    normalizedRoute.handle = {
      ...(normalizedRoute.handle ?? {}),
      featureName: descriptor.name,
      routeName,
      routePath: normalizedRoute.path,
      featureVersion: descriptor.config.version,
      policies: normalizedRoute.handle?.policies ?? descriptor.config.policies,
    };
    const childRoutes = normalizedRoute.children as
      | NamedRouteObject[]
      | undefined;
    const children = childRoutes
      ? wrapRoutes(childRoutes, descriptor)
      : undefined;
    const lazyElement = resolveLazyElement(descriptor, normalizedRoute.handle);
    const lazyNode =
      lazyElement && !normalizedRoute.handle?.skipLazy ? (
        <Suspense
          fallback={
            <div className="min-h-[200px] flex items-center justify-center text-slate-400">
              Loading…
            </div>
          }
        >
          {React.createElement(lazyElement)}
        </Suspense>
      ) : null;
    const finalElement: ReactNode = normalizedRoute.element ?? lazyNode;
    const wrappedElement = finalElement ? (
      <FeatureRuntimeWrapper
        featureName={descriptor.name}
        policies={descriptor.config.policies}
        routeMetadata={{
          featureName: descriptor.name,
          routeName:
            normalizedRoute.handle?.routeName ?? `${descriptor.name}.route`,
          routePath: normalizedRoute.path,
          featureVersion: descriptor.config.version,
          policies: descriptor.config.policies,
        }}
      >
        {finalElement}
      </FeatureRuntimeWrapper>
    ) : undefined;

    const routeWithoutName = { ...normalizedRoute };
    delete routeWithoutName.name;
    const baseRoute = routeWithoutName as RouteObject;
    return {
      ...baseRoute,
      element: wrappedElement,
      children,
    };
  });

  return mapped as RouteObject[];
}

type SplitRoutes = {
  prefixed: RouteObject[];
  absolute: RouteObject[];
};

function splitAbsolutePaths(routes: RouteObject[]): SplitRoutes {
  const prefixed: RouteObject[] = [];
  const absolute: RouteObject[] = [];

  for (const route of routes) {
    if (typeof route.path === "string" && route.path.startsWith("/")) {
      const cloned = { ...route, path: route.path.replace(/\/+/g, "/") };
      absolute.push(cloned);
    } else {
      prefixed.push(route);
    }
  }

  return { prefixed, absolute };
}

function hasIndexRoute(children: RouteObject[]) {
  return children.some(
    (child) =>
      child.index ||
      (typeof child.path === "string" &&
        (child.path === "" || child.path === "/"))
  );
}

function createPrefixNotFound(prefix?: string) {
  const displayPath = prefix ? `/${prefix}` : "/";
  return <NotFound fallbackPath={displayPath} />;
}

function ensurePrefixHasFallback(
  children: RouteObject[],
  prefix: string | undefined
) {
  if (!prefix || hasIndexRoute(children)) return children;
  return [
    ...children,
    {
      index: true,
      element: createPrefixNotFound(prefix),
    },
  ];
}

function groupRoutesByPrefix(descriptor: FeatureDescriptor): RouteObject[] {
  const wrapped = wrapRoutes(
    descriptor.routes as NamedRouteObject[],
    descriptor
  );
  const { prefixed, absolute } = splitAbsolutePaths(wrapped);
  const prefixedRoutes: RouteObject[] = [];
  const prefix = normalizePrefix(descriptor.routePrefix);

  if (prefixed.length > 0) {
    if (prefix) {
      prefixedRoutes.push({
        path: prefix,
        children: ensurePrefixHasFallback(prefixed, prefix),
      });
    } else {
      prefixedRoutes.push(...prefixed);
    }
  }

  return [...absolute, ...prefixedRoutes];
}

function buildPath(routePath: string | undefined, parentPath: string): string {
  if (routePath && routePath.startsWith("/")) return routePath;

  const cleanParent = parentPath === "" ? "" : parentPath.replace(/\/+$/, "");
  const cleanSegment = routePath?.replace(/^\/+/, "") ?? "";

  if (!cleanSegment) {
    return cleanParent || "/";
  }

  if (!cleanParent) {
    return `/${cleanSegment}`;
  }

  return `${cleanParent}/${cleanSegment}`.replace(/\/+/g, "/");
}

function collectRoutes(routes: RouteObject[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};

  function visit(route: RouteObject, basePath: string) {
    const currentPath = route.index
      ? basePath || "/"
      : buildPath(route.path, basePath);
    const name =
      (route as NamedRouteObject).handle?.routeName ??
      (route as NamedRouteObject).name ??
      `${currentPath} (unnamed)`;
    const isContainer =
      route.element == null &&
      Array.isArray(route.children) &&
      route.children.length > 0;
    if (!isContainer) {
      if (!map[currentPath]) map[currentPath] = [];
      map[currentPath].push(name);
    }
    if (route.children) {
      for (const child of route.children) {
        visit(child, currentPath === "/" ? "" : currentPath);
      }
    }
  }

  for (const route of routes) {
    visit(route, "");
  }

  return map;
}

function verifyUniquePaths(routes: RouteObject[]) {
  const map = collectRoutes(routes);
  const duplicates = Object.entries(map).filter(
    ([, names]) => names.length > 1
  );
  if (duplicates.length === 0) return;
  const message = duplicates
    .map(([path, names]) => `Path "${path}" is declared by ${names.join(", ")}`)
    .join("; ");
  throw new Error(`Route path conflicts detected: ${message}`);
}

export function buildFeatureRoutes(): RouteObject[] {
  const routes = featureDescriptors.flatMap((descriptor) =>
    descriptor.routes.length ? groupRoutesByPrefix(descriptor) : []
  );
  verifyUniquePaths(routes);
  populateRouteNameMap(routes);
  return routes;
}

let routeNameMap: Record<string, string> = {};

function visitForName(route: RouteObject, basePath: string) {
  const currentPath = route.index
    ? basePath || "/"
    : buildPath(route.path, basePath);
  const name =
    (route as NamedRouteObject).handle?.routeName ??
    (route as NamedRouteObject).name ??
    `${currentPath} (unnamed)`;
  routeNameMap[name] = currentPath;

  if (route.children) {
    for (const child of route.children) {
      visitForName(child, currentPath === "/" ? "" : currentPath);
    }
  }
}

function populateRouteNameMap(routes: RouteObject[]) {
  routeNameMap = {};
  for (const route of routes) {
    visitForName(route, "");
  }
}

export function getRoutePathByName(name: string) {
  return routeNameMap[name];
}
