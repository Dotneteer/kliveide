import fs from "fs";
import path from "path";

/*
 * Where the main process finds a machine core's WASM file for the unit-test worker
 * (`.plans/Z80_UNIT_TESTS_PLAN.md` D6). The renderer loads a core through Vite's asset URL; the
 * worker cannot, so the main process reads the bytes itself:
 *
 * - a development build runs from the repository: the core's `wasm/dist` folder is current;
 * - a packaged app has only the renderer's hashed copy, `out/renderer/assets/<name>-<hash>.wasm`.
 */

/** The machine folder of each core under `src/emu/machines` */
const CORE_FOLDERS: Record<string, string> = {
  "zx-spectrum48.wasm": "zxSpectrum48",
  "zx-spectrum128.wasm": "zxSpectrum128",
  "zx-spectrum-p3e.wasm": "zxSpectrumP3e",
  "zx-spectrum-next.wasm": "zxNext",
  "zx-timex.wasm": "timex",
  "cambridge-z88.wasm": "z88",
  "zx8081.wasm": "zx8081"
};

/**
 * The path of a core's WASM file, or `undefined` when there is none
 * @param artifactName The core's artifact (`zx-spectrum48.wasm`)
 * @param baseDir Where the main bundle runs from (`out/main`)
 */
export function findWasmArtifact(artifactName: string, baseDir: string): string | undefined {
  // --- A development build: the sources are above the bundle
  const folder = CORE_FOLDERS[artifactName];
  if (folder) {
    let dir = baseDir;
    for (let i = 0; i < 6; i++) {
      const candidate = path.join(dir, "src/emu/machines", folder, "wasm/dist", artifactName);
      if (fs.existsSync(candidate)) return candidate;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  // --- A packaged app: the renderer's hashed asset
  const stem = artifactName.replace(/\.wasm$/, "");
  const assets = path.join(baseDir, "../renderer/assets");
  try {
    const hashed = fs
      .readdirSync(assets)
      .filter((f) => f.startsWith(`${stem}-`) && f.endsWith(".wasm") && /^[A-Za-z0-9_-]+$/.test(f.slice(stem.length + 1, -5)))
      .map((f) => path.join(assets, f));
    if (hashed.length) {
      // --- The newest, should a stale build have left another behind
      hashed.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      return hashed[0];
    }
  } catch {
    // --- No assets folder
  }
  return undefined;
}
