import type { RouteObject } from "react-router-dom";
import Layout from "../Layout";
import NotFound from "../core/components/NotFound";
import { generatedFeatureRoutes } from "./routes.generated";

const hasHomeRoute = generatedFeatureRoutes.some(
  (route) =>
    route.index ||
    route.path === "/" ||
    route.path === "" ||
    (typeof route.path === "string" && route.path.trim() === ""),
);

const rootChildren: RouteObject[] = [...generatedFeatureRoutes];

if (!hasHomeRoute) {
  rootChildren.unshift({
    index: true,
    element: <NotFound />,
  });
}

rootChildren.push({
  path: "*",
  element: <NotFound />,
});

export const featureRoutes: RouteObject[] = [
  {
    path: "/",
    element: <Layout />,
    children: rootChildren,
  },
];
