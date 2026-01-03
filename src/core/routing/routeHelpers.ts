import type { RouteObject } from "react-router-dom";

export type SimplifiedFeatureRoute = {
  path?: string;
  name?: string;
  element?: RouteObject["element"];
  lazyImport?: string;
  skipLazy?: boolean;
  policies?: Record<string, unknown>;
  handle?: RouteObject["handle"];
  children?: SimplifiedFeatureRoute[];
};

type NamedRouteObject = RouteObject & { name?: string; handle?: RouteObject["handle"] };

export function defineFeatureRoutes(
  featureName: string,
  definitions: SimplifiedFeatureRoute[]
): NamedRouteObject[] {
  return definitions.map((definition) => {
    const route: NamedRouteObject = {
      path: definition.path,
      name: definition.name,
      element: definition.element ?? null,
      handle: {
        feature: featureName,
        ...definition.handle,
        lazyImport: definition.lazyImport ?? definition.handle?.lazyImport,
        skipLazy: definition.skipLazy ?? definition.handle?.skipLazy,
        policies: definition.policies ?? definition.handle?.policies
      },
      children: definition.children
        ? defineFeatureRoutes(featureName, definition.children)
        : undefined
    };

    return route;
  });
}
