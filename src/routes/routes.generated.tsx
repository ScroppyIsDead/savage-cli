import { Suspense, lazy, type ReactElement, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import FeatureRuntimeWrapper from "../core/routing/FeatureRuntimeWrapper";
import type { PrefetchEntry } from "../core/routing/prefetchScheduler";
import LoadingFallback from "../core/components/LoadingFallback";
import NotFound from "../core/components/NotFound";

import manifestData from "../../tooling/route-manifest.json";

type LazyPageModule = { default: React.ComponentType<unknown> };
type LazyPageLoader = () => Promise<LazyPageModule>;

type NamedRouteObject = RouteObject & {
  name?: string;
  handle?: { routeName?: string };
};

const pageLoaders = import.meta.glob<LazyPageModule>(
  "../../features/*/pages/**/*.{ts,tsx}",
  { eager: false },
) as Record<string, LazyPageLoader>;

interface ManifestRoute {
  path?: string;
  index?: boolean;
  name?: string;
  handle?: {
    lazyImport?: string;
    policies?: Record<string, unknown>;
    prefetch?: string[];
    loadingFallback?: ReactNode;
    skipLazy?: boolean;
    [key: string]: unknown;
  };
  element?: ReactElement | ReactNode;
  children?: ManifestRoute[];
}

interface FeatureManifestEntry {
  name: string;
  routePrefix?: string | false;
  config?: {
    version?: string;
    policies?: Record<string, unknown>;
  };
  routes?: ManifestRoute[];
}

interface RouteManifest {
  features?: FeatureManifestEntry[];
}

const manifest = manifestData as RouteManifest;
const featureNames = new Set<string>(
  (manifest.features ?? []).map((entry) => entry.name),
);
const loaderCache = new Map<string, LazyPageLoader | undefined>();
const prefetchCache = new Map<string, PrefetchEntry>();
const routeNameMap: Record<string, string> = {};

function normalizePrefix(prefix?: string | false): string | undefined {
  if (prefix === false || prefix === undefined || prefix === null)
    return undefined;
  const normalized = `${prefix}`.replace(/^\/+|\/+$/g, "");
  return normalized || undefined;
}

function normalizeRoutePath(value: string): string {
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

function buildPath(routePath: string | undefined, parentPath: string): string {
  if (routePath && routePath.startsWith("/")) {
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

function splitAbsolutePaths(routes: RouteObject[]) {
  const prefixed: RouteObject[] = [];
  const absolute: RouteObject[] = [];

  for (const route of routes) {
    if (typeof route.path === "string" && route.path.startsWith("/")) {
      absolute.push({ ...route, path: route.path.replace(/\/+/g, "/") });
    } else {
      prefixed.push(route);
    }
  }

  return { prefixed, absolute };
}

function hasIndexRoute(routes: RouteObject[]) {
  return routes.some(
    (route) =>
      route.index ||
      (typeof route.path === "string" &&
        (route.path === "" || route.path === "/")),
  );
}

function ensurePrefixHasFallback(
  children: RouteObject[],
  prefix: string | undefined,
) {
  if (!prefix || hasIndexRoute(children)) {
    return children;
  }

  return [
    ...children,
    {
      index: true,
      element: <NotFound />,
    },
  ];
}

function resolveLoader(featureName: string, importPath?: string) {
  if (!importPath) return undefined;
  const cacheKey = `${featureName}:${importPath}`;
  if (loaderCache.has(cacheKey)) {
    return loaderCache.get(cacheKey);
  }

  const cleaned = importPath.replace(/^\.\//, "");
  const trimmed = cleaned.replace(/^(\.\.\/)+/, "");
  const candidates = new Set<string>();
  candidates.add(`../../features/${featureName}/${trimmed}`);
  candidates.add(`../../features/${featureName}/${cleaned}`);
  if (trimmed.startsWith("features/")) {
    candidates.add(`../../${trimmed}`);
    candidates.add(trimmed);
  }

  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length > 1 && featureNames.has(segments[0])) {
    const [, ...rest] = segments;
    if (rest.length) {
      candidates.add(`../../features/${segments[0]}/${rest.join("/")}`);
    }
  }

  let loader: LazyPageLoader | undefined;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const candidateLoader = pageLoaders[candidate as keyof typeof pageLoaders];
    if (candidateLoader) {
      loader = candidateLoader;
      break;
    }
  }

  if (!loader) {
    for (const [path, candidateLoader] of Object.entries(pageLoaders)) {
      if (trimmed && path.endsWith(trimmed)) {
        loader = candidateLoader;
        break;
      }
    }
  }

  loaderCache.set(cacheKey, loader);
  return loader;
}

function buildPrefetchEntries(
  featureName: string,
  paths?: string[],
): PrefetchEntry[] | undefined {
  if (!paths || paths.length === 0) return undefined;

  const entries: PrefetchEntry[] = [];

  for (const entryPath of paths) {
    if (!entryPath) continue;
    const normalized = entryPath.replace(/^\.\//, "");
    const cacheKey = `${featureName}:${normalized}`;
    if (prefetchCache.has(cacheKey)) {
      entries.push(prefetchCache.get(cacheKey)!);
      continue;
    }

    const loader = resolveLoader(featureName, entryPath);
    if (!loader) {
      continue;
    }

    const prefetchEntry: PrefetchEntry = {
      key: cacheKey,
      loader,
    };
    prefetchCache.set(cacheKey, prefetchEntry);
    entries.push(prefetchEntry);
  }

  return entries.length ? entries : undefined;
}

function createElementWrapper(
  descriptor: FeatureManifestEntry,
  route: ManifestRoute,
  routeName: string,
  prefetchEntries?: PrefetchEntry[],
) {
  const loader = resolveLoader(descriptor.name, route.handle?.lazyImport);
  const fallback = route.handle?.loadingFallback ?? <LoadingFallback />;
  const policies = route.handle?.policies ?? descriptor.config?.policies;

  if (loader) {
    const LazyComponent = lazy(() => loader());
    const wrapped = (
      <FeatureRuntimeWrapper
        featureName={descriptor.name}
        policies={policies}
        prefetchEntries={prefetchEntries}
      >
        <LazyComponent />
      </FeatureRuntimeWrapper>
    );

    return <Suspense fallback={fallback}>{wrapped}</Suspense>;
  }

  if (route.element) {
    return (
      <FeatureRuntimeWrapper
        featureName={descriptor.name}
        policies={policies}
        prefetchEntries={prefetchEntries}
      >
        {route.element as ReactElement}
      </FeatureRuntimeWrapper>
    );
  }

  throw new Error(
    `Route ${descriptor.name}/${routeName} does not expose a lazyImport or element.`,
  );
}

function wrapRoutes(
  descriptor: FeatureManifestEntry,
  routes: ManifestRoute[],
  parentPath: string,
): RouteObject[] {
  return routes.map((route) => {
    const routeName = route.name ?? route.path ?? `${descriptor.name}.route`;
    const currentPath = route.index
      ? parentPath || "/"
      : buildPath(route.path, parentPath);

    const children = route.children
      ? wrapRoutes(
          descriptor,
          route.children,
          currentPath === "/" ? "" : currentPath,
        )
      : undefined;

    const prefetchEntries = buildPrefetchEntries(
      descriptor.name,
      route.handle?.prefetch,
    );

    const element = createElementWrapper(
      descriptor,
      route,
      routeName,
      prefetchEntries,
    );

    const baseRoute: RouteObject = {
      ...route,
      element,
      children,
    } as RouteObject;

    return baseRoute;
  });
}

function groupRoutesByPrefix(descriptor: FeatureManifestEntry): RouteObject[] {
  const rawRoutes = descriptor.routes ?? [];
  if (rawRoutes.length === 0) return [];

  const prefixed = wrapRoutes(descriptor, rawRoutes, "");
  const { absolute, prefixed: generic } = splitAbsolutePaths(prefixed);
  const normalizedPrefix = normalizePrefix(descriptor.routePrefix);
  const grouped: RouteObject[] = [...absolute];

  if (generic.length > 0) {
    if (normalizedPrefix) {
      grouped.push({
        path: normalizedPrefix,
        children: ensurePrefixHasFallback(generic, normalizedPrefix),
      });
    } else {
      grouped.push(...generic);
    }
  }

  return grouped;
}

function visitForName(route: RouteObject, basePath: string) {
  const currentPath = route.index
    ? basePath || "/"
    : buildPath(route.path as string | undefined, basePath);
  const namedRoute = route as NamedRouteObject;
  const name =
    namedRoute.handle?.routeName ??
    namedRoute.name ??
    `${currentPath} (unnamed)`;
  routeNameMap[name] = currentPath;

  const children = route.children;
  if (children) {
    for (const child of children) {
      visitForName(child, currentPath === "/" ? "" : currentPath);
    }
  }
}

function populateRouteNameMap(routes: RouteObject[]) {
  Object.keys(routeNameMap).forEach((key) => {
    delete routeNameMap[key];
  });
  routes.forEach((route) => visitForName(route, ""));
}

export const generatedFeatureRoutes: RouteObject[] = (
  manifest.features ?? []
).flatMap((feature) => groupRoutesByPrefix(feature));

populateRouteNameMap(generatedFeatureRoutes);

export function getRoutePathByName(name: string) {
  return routeNameMap[name];
}
