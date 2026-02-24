import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/core/index.ts"],
    outDir: "dist",
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: false,
    treeshake: true,
    splitting: false,
    minify: true,
    external: ["@sinclair/typebox"],
  },
]);
