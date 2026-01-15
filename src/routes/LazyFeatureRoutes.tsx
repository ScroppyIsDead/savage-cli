import { useMemo } from "react";
import { useRoutes } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import NotFound from "../core/components/NotFound";
import { generatedFeatureRoutes } from "./routes.generated";

export default function LazyFeatureRoutes() {
  const routes = generatedFeatureRoutes;
  const hasHomeRoute = useMemo(
    () =>
      routes.some(
        (route) =>
          route.index ||
          route.path === "/" ||
          route.path === "" ||
          (typeof route.path === "string" && route.path.trim() === ""),
      ),
    [routes],
  );

  const composedRoutes = useMemo(() => {
    const extras: RouteObject[] = [];
    if (!hasHomeRoute) {
      extras.push({
        index: true,
        element: <NotFound />,
      });
    }
    extras.push({
      path: "*",
      element: <p>page not found</p>,
    });

    return [...routes, ...extras];
  }, [routes, hasHomeRoute]);

  return useRoutes(composedRoutes);
}
