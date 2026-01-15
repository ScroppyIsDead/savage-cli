const fs = require("node:fs");
const path = require("node:path");
const routeInspector = require("./route-inspector.cjs");

const manifestPath = path.resolve(__dirname, "route-manifest.json");
const routesGeneratedPath = path.resolve(__dirname, "routes-generated.cjs");

function ensureRoutesGeneratedStub() {
  if (fs.existsSync(routesGeneratedPath)) {
    return;
  }

  const stub = `// Stub created by route-manifest.js to satisfy build scripts\nmodule.exports = {};\n`;
  fs.writeFileSync(routesGeneratedPath, stub);
}

function writeRouteManifest() {
  const manifest = {
    features: routeInspector.generateRouteManifest(),
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  ensureRoutesGeneratedStub();
  return manifestPath;
}

module.exports = {
  manifestPath,
  writeRouteManifest,
};

if (require.main === module) {
  writeRouteManifest();
}
