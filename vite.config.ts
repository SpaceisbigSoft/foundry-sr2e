import type { UserConfig } from "vite";

/**
 * Builds src/start.ts into public/index.mjs. Foundry loads the system from the
 * `public` folder (symlink it into Data/systems/sr2e during development).
 * Derived from the SRA2 build setup (CC BY-SA 4.0).
 */
const config: UserConfig = {
  publicDir: false,
  base: "/systems/sr2e/",
  build: {
    outDir: "public",
    emptyOutDir: false,
    sourcemap: true,
    // v0.90.0: minified afterwards by scripts/minify.mjs (part of `npm run build`): Vite's library build keeps the
    // whitespace of ES output, so one esbuild pass does it all, with the class names kept and the map chained.
    minify: false,
    lib: { name: "sr2e", entry: "src/start.ts", formats: ["es"], fileName: () => "index.mjs" },
  },
};

export default config;
