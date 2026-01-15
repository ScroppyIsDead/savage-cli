"use strict";

const path = require("node:path");
const routeInspector = require(
  path.resolve(__dirname, "../../../tooling/route-inspector.cjs"),
);

let duplicates = [];
let nameDuplicates = [];
let missingLazyImports = [];
let missingPrefetchImports = [];
let inspectionError = null;
let conflictsReported = false;
const missingLazyImportsByFile = new Map();
const missingPrefetchImportsByFile = new Map();
const reportedMissingFiles = new Set();
const reportedMissingPrefetchFiles = new Set();

try {
  const analysis = routeInspector.analyzeRoutes();
  duplicates = analysis.duplicates;
  nameDuplicates = analysis.nameDuplicates;
  missingLazyImports = analysis.missingLazyImports ?? [];
  missingPrefetchImports = analysis.missingPrefetchImports ?? [];
} catch (error) {
  inspectionError = error;
}

for (const entry of missingLazyImports) {
  const filePath = path.resolve(entry.routesPath);
  const pending = missingLazyImportsByFile.get(filePath) ?? [];
  pending.push(entry);
  missingLazyImportsByFile.set(filePath, pending);
}

for (const entry of missingPrefetchImports) {
  const filePath = path.resolve(entry.routesPath);
  const pending = missingPrefetchImportsByFile.get(filePath) ?? [];
  pending.push(entry);
  missingPrefetchImportsByFile.set(filePath, pending);
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "disallow duplicated route paths across features",
      recommended: true,
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        const filename = path.resolve(context.getFilename());
        const missingEntries = missingLazyImportsByFile.get(filename);
        if (missingEntries && !reportedMissingFiles.has(filename)) {
          reportedMissingFiles.add(filename);
          for (const entry of missingEntries) {
            const routePathDescription = entry.path ?? "unknown path";
            const routeName = entry.routeName ?? "unnamed route";
            context.report({
              node,
              message: `Feature ${entry.feature} route ${routeName} (${routePathDescription}) references a missing lazyImport (${entry.lazyImport}) defined in ${entry.routesPath}`,
            });
          }
        }
        const missingPrefetchEntries =
          missingPrefetchImportsByFile.get(filename);
        if (
          missingPrefetchEntries &&
          !reportedMissingPrefetchFiles.has(filename)
        ) {
          reportedMissingPrefetchFiles.add(filename);
          for (const entry of missingPrefetchEntries) {
            const routePathDescription = entry.path ?? "unknown path";
            const routeName = entry.routeName ?? "unnamed route";
            context.report({
              node,
              message: `Feature ${entry.feature} route ${routeName} (${routePathDescription}) references a missing prefetch entry (${entry.prefetchPath}) defined in ${entry.routesPath}`,
            });
          }
        }

        if (inspectionError) {
          if (!conflictsReported) {
            conflictsReported = true;
            context.report({
              node,
              message: `Route analysis failed: ${inspectionError.message}`,
            });
          }
          return;
        }

        if (conflictsReported) return;

        if (!duplicates.length && !nameDuplicates.length) return;

        conflictsReported = true;
        const messages = [];

        if (duplicates.length) {
          messages.push(
            duplicates
              .map(
                (conflict) =>
                  `Path "${conflict.path}" is declared by ${conflict.names.join(
                    ", ",
                  )}`,
              )
              .join("; "),
          );
        }

        if (nameDuplicates.length) {
          messages.push(
            nameDuplicates
              .map(
                (conflict) =>
                  `Name "${conflict.name}" is declared by ${conflict.paths.join(
                    ", ",
                  )}`,
              )
              .join("; "),
          );
        }

        context.report({
          node,
          message: `Route conflicts detected: ${messages.join(" | ")}`,
        });
      },
    };
  },
};
