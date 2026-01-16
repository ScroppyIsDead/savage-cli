import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const js = require("@eslint/js");
const tsParser = require("@typescript-eslint/parser");
const routePathsPlugin = require("./.eslint-plugins/route-paths");

const compat = new FlatCompat({
  baseDirectory: path.resolve("."),
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    ignores: ["dist/**"],
  },

  ...compat.extends(
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ),

  ...compat.env({
    browser: true,
    es2024: true,
    node: true,
  }),

  {
    files: ["src/**/*", "features/**/*"],
    ignores: ["node_modules/**"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        tsconfigRootDir: path.resolve("."),
        project: ["./tsconfig.eslint.json"],
      },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      "route-paths": routePathsPlugin,
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "route-paths/no-duplicate-route-paths": "error",
      "route-paths/no-cross-feature-imports": "error",
      "react/prop-types": "off",
    },
  },

  {
    files: [".eslint-plugins/**/*", "tooling/**/*"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];
