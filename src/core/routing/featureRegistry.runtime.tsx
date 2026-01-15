import {
  Suspense,
  createElement,
  lazy,
  type ComponentType,
  type ReactNode,
} from "react";
import type { RouteObject } from "react-router-dom";
import FeatureRuntimeWrapper from "./FeatureRuntimeWrapper";
import NotFound from "../components/NotFound";
import LoadingFallback from "../components/LoadingFallback";

export interface FeatureConfig {
  version?: string;
  policies?: Record<string, unknown>;
  routePrefix?: string | false;
  [key: string]: unknown;
}

interface RouteHandle {
  featureName: string;
  routeName: string;
  routePath?: string;
  featureVersion?: string;
  lazyImport?: string;
  skipLazy?: boolean;
  policies?: Record<string, unknown>;
  loadingFallback?: ReactNode;
}

type NamedRouteObject = RouteObject & { name?: string; handle?: RouteHandle };

interface FeatureManifestEntry {
  name: string;
  routePrefix?: string | false;
  config?: FeatureConfig;
  routes: ManifestRoute[];
}

export type RouteManifest = {
  features: FeatureManifestEntry[];
};

type ManifestRoute = NamedRouteObject & { children?: ManifestRoute[] };

interface FeatureDescriptor {
  name: string;
  config: FeatureConfig;
  routes: NamedRouteObject[];
  routePrefix?: string | false;
}

type LazyPageModule = { default: ComponentType<unknown> };
type LazyPageLoader = () => Promise<LazyPageModule>;

const LazyFeatureRuntimeWrapper = lazy(() => import("./FeatureRuntimeWrapper"));
const pageLoaders = import.meta.glob<LazyPageModule>(
  "../../../features/*/pages/**/*.{ts,tsx}",
) as Record<string, LazyPageLoader | undefined>;
const featureLoaderCache = new Map<
  string,
  Record<string, LazyPageLoader | undefined>
>();
const initialPath =
  typeof window === "undefined" ? "" : (window.location.pathname ?? "");

function normalizePrefix(prefix?: string | false): string | undefined {
  if (prefix === false || prefix === undefined || prefix === null)
    return undefined;
  const normalized = `${prefix}`.replace(/^\/+|\/+$/g, "");
  return normalized || undefined;
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

function pathMatchesInitial(pathname: string, routePath: string) {
  if (!pathname) return false;
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const normalizedRoute = routePath.replace(/\/+$/, "") || "/";
  if (normalizedRoute === "*") return true;
  if (normalizedRoute === normalizedPath) return true;

  const routeSegments = normalizedRoute.split("/").filter(Boolean);
  const pathSegments = normalizedPath.split("/").filter(Boolean);
  if (routeSegments.length > pathSegments.length) return false;

  for (let index = 0; index < routeSegments.length; index += 1) {
    const segment = routeSegments[index];
    if (segment === "*" || segment.startsWith(":")) continue;
    if (segment !== pathSegments[index]) return false;
  }

  return true;
}

function getFeatureDescriptors(
  routeManifest: RouteManifest,
): FeatureDescriptor[] {
  return (routeManifest.features ?? []).map((entry) => ({
    name: entry.name,
    config: entry.config ?? {},
    routes: entry.routes as NamedRouteObject[],
    routePrefix: entry.routePrefix,
  }));
}

function getPageLoaders(featureName: string) {
  if (featureLoaderCache.has(featureName)) {
    return featureLoaderCache.get(featureName)!;
  }
  const prefix = `../../../features/${featureName}/pages/`;
  const filtered: Record<string, LazyPageLoader | undefined> = {};
  for (const [key, loader] of Object.entries(pageLoaders)) {
    if (key.includes(prefix)) {
      filtered[key] = loader;
    }
  }
  featureLoaderCache.set(featureName, filtered);
  return filtered;
}

function resolveLazyElement(
  descriptor: FeatureDescriptor,
  handle?: RouteHandle,
) {
  if (!handle?.lazyImport || handle.skipLazy) return undefined;
  const normalizedImport = handle.lazyImport.replace(/^\.\//, "");
  const candidates = [
    `../../features/${descriptor.name}/${normalizedImport}`,
    normalizedImport,
    normalizedImport.replace(/^\.\/+/, ""),
    `./${normalizedImport}`,
  ];
  const loaders = getPageLoaders(descriptor.name);
  let loader: LazyPageLoader | undefined;
  for (const candidate of candidates) {
    loader = loaders[candidate];
    if (loader) break;
  }
  if (!loader) {
    const fallback = Object.entries(loaders).find(([path]) =>
      path.endsWith(normalizedImport),
    );
    loader = fallback ? fallback[1] : undefined;
  }
  const resolvedLoader = loader;
  if (!resolvedLoader) {
    throw new Error(
      `Lazy import not found for feature ${descriptor.name}: ${handle.lazyImport} (tried ${candidates.join(
        ", ",
      )}).`,
    );
  }
  const element = lazy(() => resolvedLoader());
  return element;
}

function wrapRoutes(
  routes: NamedRouteObject[],
  descriptor: FeatureDescriptor,
  parentPath: string,
): RouteObject[] {
  const mapped = routes.map((route) => {
    const normalizedRoute = { ...route };
    const routeName =
      normalizedRoute.name ??
      normalizedRoute.path ??
      `${descriptor.name}.route`;
    const currentPath = buildPath(normalizedRoute.path, parentPath);
    const shouldEagerWrapper = pathMatchesInitial(initialPath, currentPath);
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
      ? wrapRoutes(childRoutes, descriptor, currentPath)
      : undefined;
    const lazyElement = resolveLazyElement(descriptor, normalizedRoute.handle);
    const lazyFallback = normalizedRoute.handle?.loadingFallback ?? (
      <LoadingFallback />
    );
    const lazyNode =
      lazyElement && !normalizedRoute.handle?.skipLazy ? (
        <Suspense fallback={lazyFallback}>
          {createElement(lazyElement)}
        </Suspense>
      ) : null;
    const finalElement: ReactNode = normalizedRoute.element ?? lazyNode;
    if (!finalElement && !Array.isArray(normalizedRoute.children)) {
      throw new Error(
        `Route ${descriptor.name}/${routeName} (${normalizedRoute.path}) produces no element. Provide an element or a lazyImport.`,
      );
    }
    const wrappedElement = finalElement ? (
      shouldEagerWrapper ? (
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
      ) : (
        <Suspense fallback={null}>
          <LazyFeatureRuntimeWrapper
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
          </LazyFeatureRuntimeWrapper>
        </Suspense>
      )
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
        (child.path === "" || child.path === "/")),
  );
}

function createPrefixNotFound() {
  return <NotFound />;
}

function ensurePrefixHasFallback(
  children: RouteObject[],
  prefix: string | undefined,
) {
  if (!prefix || hasIndexRoute(children)) return children;
  return [
    ...children,
    {
      index: true,
      element: createPrefixNotFound(),
    },
  ];
}

function groupRoutesByPrefix(descriptor: FeatureDescriptor): RouteObject[] {
  let wrapped: RouteObject[];
  try {
    const prefix = normalizePrefix(descriptor.routePrefix);
    const parentPath = prefix ? `/${prefix}` : "";
    wrapped = wrapRoutes(
      descriptor.routes as NamedRouteObject[],
      descriptor,
      parentPath,
    );
  } catch (error: unknown) {
    const normalized =
      error instanceof Error
        ? error
        : new Error(String(error ?? "unknown error"));
    const message = `Failed to wrap routes for feature "${descriptor.name}": ${normalized.message}`;
    console.error("[featureRegistry]", message, normalized);
    throw new Error(message);
  }
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

export async function buildFeatureRoutes(
  routeManifest: RouteManifest,
): Promise<RouteObject[]> {
  const descriptors = getFeatureDescriptors(routeManifest);
  const routes = descriptors.flatMap((descriptor) =>
    descriptor.routes.length ? groupRoutesByPrefix(descriptor) : [],
  );
  populateRouteNameMap(routes);
  if (import.meta.env.DEV) {
    const { verifyUniquePaths } = await import("./featureRegistry.dev");
    verifyUniquePaths(routes);
  }
  return routes;
}

export function getRoutePathByName(name: string) {
  return routeNameMap[name];
}
