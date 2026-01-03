import { defineFeatureRoutes } from "../../../src/core/routing/routeHelpers";

export const routePrefix = "{{featureName}}";

export const routes = defineFeatureRoutes("{{featureName}}", [
  {
    path: "",
    name: "{{featureName}}.index",
    lazyImport: "./pages/{{featureName}}Page.tsx"
  }
]);
