import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export default {
  root: resolve(here, "web"),
  base: "./",
  resolve: { alias: [
    { find: /^@cornerstonejs\/core$/, replacement: resolve(here, "node_modules/@cornerstonejs/core/dist/esm/index.js") },
    { find: /^@cornerstonejs\/dicom-image-loader$/, replacement: resolve(here, "node_modules/@cornerstonejs/dicom-image-loader/dist/esm/index.js") },
    { find: /^comlink$/, replacement: resolve(here, "node_modules/comlink/dist/esm/comlink.mjs") },
  ] },
  worker: { format: "es" },
  build: { outDir: resolve(here, "dist"), emptyOutDir: true },
};
