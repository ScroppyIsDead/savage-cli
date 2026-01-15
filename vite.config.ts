import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { createRequire } from "node:module";
import { visualizer } from "rollup-plugin-visualizer";
import type { ViteDevServer } from "vite";

const require = createRequire(import.meta.url);
const { writeRouteManifest } = require("./tooling/route-manifest.cjs");

function routeManifestPlugin() {
  const regenerate = () => {
    try {
      writeRouteManifest();
    } catch (error) {
      console.error("[route-manifest] failed to regenerate manifest", error);
    }
  };

  const shouldWatchFile = (file: string) => {
    const normalized = file.replace(/\\/g, "/");
    return (
      normalized.includes("/features/") &&
      (normalized.endsWith("routes.tsx") ||
        normalized.endsWith("feature.config"))
    );
  };

  return {
    name: "route-manifest",
    buildStart() {
      regenerate();
    },
    configureServer(server: ViteDevServer) {
      regenerate();
      const handler = (file: string) => {
        if (!shouldWatchFile(file)) return;
        regenerate();
        server.ws?.send({ type: "full-reload" });
      };
      server.watcher.on("add", handler);
      server.watcher.on("change", handler);
      server.watcher.on("unlink", handler);
    },
  };
}

export default defineConfig({
  plugins: [
    routeManifestPlugin(),
    react(),
    tailwindcss(),
    visualizer({
      open: false,
      filename: "bundle-stats.html",
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: [
      {
        find: /^@savage-cli\/routing$/,
        replacement: path.resolve(__dirname, "src/core/routing/index.ts"),
      },
      {
        find: /^@savage-cli\/routing\/(.*)$/,
        replacement: path.resolve(__dirname, "src/core/routing/$1"),
      },
      {
        find: /^@savage-cli\/core$/,
        replacement: path.resolve(__dirname, "src/core/index.ts"),
      },
      {
        find: /^@savage-cli\/core\/(.*)$/,
        replacement: path.resolve(__dirname, "src/core/$1"),
      },
    ],
  },
  server: {
    port: 5173,
  },
  test: {
    globals: true,
    environment: "jsdom",
    css: true,
  },
});
