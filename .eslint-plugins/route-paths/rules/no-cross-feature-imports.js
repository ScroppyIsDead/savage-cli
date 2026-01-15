const path = require("node:path");

const FEATURE_SEGMENT = `${path.sep}features${path.sep}`;

function getFeatureName(filePath) {
  if (!filePath || filePath === "<input>") return null;
  const normalized = path.normalize(filePath);
  const idx = normalized.indexOf(FEATURE_SEGMENT);
  if (idx === -1) return null;
  const rest = normalized.slice(idx + FEATURE_SEGMENT.length);
  const parts = rest.split(path.sep);
  return parts[0] || null;
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow importing directly from another feature's internal modules; use the public API instead.",
      recommended: "error",
    },
    schema: [],
    messages: {
      crossFeatureImport:
        "Importing from '{{targetFeature}}' must go through its public exports (use a path containing '/public/').",
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (!source || typeof source !== "string") return;
        if (!source.startsWith(".")) return;
        const currentFile = context.getFilename();
        const currentFeature = getFeatureName(currentFile);
        if (!currentFeature) return;
        const importPath = path.resolve(path.dirname(currentFile), source);
        const targetFeature = getFeatureName(importPath);
        if (!targetFeature || targetFeature === currentFeature) return;
        if (
          importPath.includes(`${path.sep}public${path.sep}`) ||
          importPath.endsWith(`${path.sep}public`)
        ) {
          return;
        }
        context.report({
          node,
          messageId: "crossFeatureImport",
          data: { targetFeature },
        });
      },
    };
  },
};
