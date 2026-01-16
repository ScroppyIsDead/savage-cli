import { defineFeatureRoutes } from "@savage-cli/routing/routeHelpers";

export const routePrefix = "user";

export const routes = defineFeatureRoutes("user", [
  {
    path: "/",
    name: "user.login",
    lazyImport: "./pages/LoginPage.tsx",
    policies: {
      auth: "optional",
      cache: "no-store",
    },
    handle: {
      prefetch: ["../todo/pages/TodoPage.tsx"],
    },
  },
]);
