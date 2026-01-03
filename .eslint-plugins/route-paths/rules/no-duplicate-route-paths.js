"use strict";

const path = require("node:path");
const routeInspector = require(path.resolve(
  __dirname,
  "../../../tooling/route-inspector.cjs"
));

let duplicates = [];
let nameDuplicates = [];
let inspectionError = null;
let reported = false;

try {
  const analysis = routeInspector.analyzeRoutes();
  duplicates = analysis.duplicates;
  nameDuplicates = analysis.nameDuplicates;
} catch (error) {
  inspectionError = error;
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
        if (reported) return;

        if (inspectionError) {
          reported = true;
          context.report({
            node,
            message: `Route analysis failed: ${inspectionError.message}`,
          });
          return;
        }

        if (!duplicates.length && !nameDuplicates.length) return;

        reported = true;
        const messages = [];

        if (duplicates.length) {
          messages.push(
            duplicates
              .map(
                (conflict) =>
                  `Path "${conflict.path}" is declared by ${conflict.names.join(
                    ", "
                  )}`
              )
              .join("; ")
          );
        }

        if (nameDuplicates.length) {
          messages.push(
            nameDuplicates
              .map(
                (conflict) =>
                  `Name "${conflict.name}" is declared by ${conflict.paths.join(
                    ", "
                  )}`
              )
              .join("; ")
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
