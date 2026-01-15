import type { RouteObject } from "react-router-dom";

type NamedRouteObject = RouteObject & {
  name?: string;
  handle?: { routeName?: string };
};

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

export function verifyUniquePaths(routes: RouteObject[]) {
  const map = collectRoutes(routes);
  const duplicates = Object.entries(map).filter(
    ([, names]) => names.length > 1,
  );
  if (duplicates.length === 0) return;
  const message = duplicates
    .map(([path, names]) => `Path "${path}" is declared by ${names.join(", ")}`)
    .join("; ");
  throw new Error(`Route path conflicts detected: ${message}`);
}
