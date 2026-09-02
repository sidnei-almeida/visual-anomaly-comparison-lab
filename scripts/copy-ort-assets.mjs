/**
 * Copy the onnxruntime-web WebAssembly binary into `public/ort/`.
 *
 * onnxruntime-web loads its WebAssembly module at runtime from `env.wasm.wasmPaths`, and
 * depending on which entry the bundler picks it fetches the Emscripten `.mjs` glue
 * alongside the `.wasm` binary. Serving both from `public/` gives them stable URLs that
 * work the same in `next dev` and on Vercel, which is what `ORT_WASM_PATH` points at.
 */

import { copyFile, mkdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ASSETS = ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"];

const require = createRequire(import.meta.url);
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const destinationDir = path.join(repoRoot, "public", "ort");

await mkdir(destinationDir, { recursive: true });

for (const asset of ASSETS) {
  const destination = path.join(destinationDir, asset);
  await copyFile(require.resolve(`onnxruntime-web/${asset}`), destination);
  const { size } = await stat(destination);
  console.log(`copied ${asset} -> public/ort/ (${(size / 1024).toFixed(0)} KB)`);
}
