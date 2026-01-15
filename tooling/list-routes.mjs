#!/usr/bin/env node

import routeInspector from "./route-inspector.cjs";

const { summary, duplicates, nameDuplicates, missingLazyImports } =
  routeInspector.analyzeRoutes();

if (!summary.length) {
  console.log(
    "No routes discovered. Add a feature under `features/` to expose routes."
  );
  process.exit(0);
}

console.table(
  summary.map(({ feature, name, path }) => ({ feature, name, path }))
);

let failed = false;

if (duplicates.length) {
  failed = true;
  console.error("Route path conflicts detected:");
  for (const conflict of duplicates) {
    console.error(
      `- Path "${conflict.path}" is declared by ${conflict.names.join(", ")}`
    );
  }
}

if (nameDuplicates.length) {
  failed = true;
  console.error("Route name conflicts detected:");
  for (const conflict of nameDuplicates) {
    console.error(
      `- Name "${conflict.name}" is declared by ${conflict.paths.join(", ")}`
    );
  }
}

if (missingLazyImports.length) {
  failed = true;
  console.error("Missing lazy import references detected:");
  for (const entry of missingLazyImports) {
    console.error(
      `- Feature ${entry.feature} route ${entry.routeName} (${entry.path}) references missing lazyImport ${entry.lazyImport} (defined in ${entry.routesPath})`
    );
  }
}

if (failed) {
  process.exit(1);
}
