import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = [
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
];

export default defineConfig({
  resolve: {
    alias,
  },
  test: {
    setupFiles: "./src/setupTests.ts",
    environment: "jsdom",
    globals: true,
    coverage: {
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx,js,jsx}"],
    },
  },
});
