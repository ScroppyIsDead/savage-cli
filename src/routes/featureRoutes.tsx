import type { RouteObject } from "react-router-dom";
import { buildFeatureRoutes } from "../core/routing/featureRegistry";
import Layout from "../Layout";
import NotFound from "./NotFound";

const dynamicRoutes = buildFeatureRoutes();

const hasHomeRoute = dynamicRoutes.some(
  (route) =>
    route.index ||
    route.path === "/" ||
    route.path === "" ||
    (typeof route.path === "string" && route.path.trim() === "")
);

const notFoundElement = <NotFound />;

export const featureRoutes: RouteObject[] = [
  {
    path: "/",
    element: <Layout />,
    children: [
      ...dynamicRoutes,
      !hasHomeRoute
        ? {
            index: true,
            element: notFoundElement,
          }
        : null,
      {
        path: "*",
        element: <p>page not found</p>,
      },
    ].filter(Boolean) as RouteObject[],
  },
];
