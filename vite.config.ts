import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: /^@savage-cli\/routing$/,
        replacement: path.resolve(__dirname, "src/core/routing/index.ts")
      },
      {
        find: /^@savage-cli\/routing\/(.*)$/,
        replacement: path.resolve(__dirname, "src/core/routing/$1")
      }
    ]
  },
  server: {
    port: 4173
  }
});
