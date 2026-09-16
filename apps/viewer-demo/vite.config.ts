import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const configDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  base: mode === "hosted" ? "./" : undefined,
  build: mode === "hosted" ? hostedBuildOptions() : undefined,
  define: mode === "hosted" ? hostedDefines() : undefined,
  plugins: [react()],
  worker: {
    format: "es",
  },
}));

function hostedDefines() {
  return {
    "process.env.NODE_ENV": JSON.stringify("production"),
  };
}

function hostedBuildOptions() {
  return {
    cssCodeSplit: false,
    emptyOutDir: true,
    lib: {
      entry: resolve(configDir, "src/hosted.tsx"),
      fileName: () => "edgepy-viewer-hosted.iife.js",
      formats: ["iife"],
      name: "EdgepyViewerHosted",
    },
    outDir: "dist-hosted/clinical-viewer",
    rollupOptions: {
      output: {
        assetFileNames(assetInfo) {
          const assetName = assetInfo.names[0] ?? "";
          return assetName.endsWith(".css") ? "edgepy-viewer-hosted.css" : "assets/[name]-[hash][extname]";
        },
      },
    },
  };
}
