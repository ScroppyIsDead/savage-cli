import { defineFeatureRoutes } from "@savage-cli/routing/routeHelpers";

export const routePrefix = "todo";

export const routes = defineFeatureRoutes("todo", [
  {
    path: "",
    name: "todo.board",
    lazyImport: "./pages/TodoPage.tsx",
    policies: {
      auth: "optional",
      cache: "no-store",
    },
    handle: {
      prefetch: ["../user/pages/LoginPage.tsx"],
    },
  },
]);
