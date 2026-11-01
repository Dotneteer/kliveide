/*
 * Lets a Node.js script `require()` the repository's TypeScript sources directly, the way the IDE's
 * build sees them: an esbuild transform for `.ts` files, the `@common/...`-style path aliases, and
 * extension-less relative imports resolved to `.ts` (or `/index.ts`).
 *
 * Shared by the scripts that run TypeScript from `src/` (`rom-annotations.cjs`, `rom-pipeline.cjs`,
 * `rom-annotations-carry.cjs`, the benchmarks, `build-next-sd-image.cjs`). Registering twice is a
 * no-op. `benchmark-zxnext-wasm.cjs` keeps its own loader: it needs decorators, JSX and DOM shims.
 */

const { existsSync, readFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");

const ROOT = resolve(__dirname, "../..");

/** The path aliases of `build/tsconfig.web.json` and `build/tsconfig.node.json`. */
const PATHS = {
  "@abstractions/*": ["src/common/abstractions/*"],
  "@common/*": ["src/common/*"],
  "@messaging/*": ["src/common/messaging/*"],
  "@state/*": ["src/common/state/*"],
  "@utils/*": ["src/common/utils/*"],
  "@renderer/*": ["src/renderer/*"],
  "@emu/*": ["src/emu/*"],
  "@appIde/*": ["src/renderer/appIde/*"],
  "@main/*": ["src/main/*"],
  "@controls/*": ["src/renderer/controls/*"]
};

let registered = false;

/** Installs the TypeScript loader once; returns the repository root. */
function registerTsRuntime() {
  if (registered) return ROOT;
  const esbuild = require("esbuild");
  require.extensions[".ts"] = (module, filename) => {
    const result = esbuild.transformSync(readFileSync(filename, "utf8"), {
      format: "cjs",
      loader: "ts",
      platform: "node",
      target: "es2020",
      tsconfigRaw: { compilerOptions: { esModuleInterop: true, useDefineForClassFields: false } }
    });
    module._compile(result.code, filename);
  };
  require("tsconfig-paths").register({ baseUrl: ROOT, paths: PATHS });
  const Module = require("node:module");
  const original = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, opts) {
    try {
      return original.call(this, request, parent, isMain, opts);
    } catch (error) {
      if (error?.code === "MODULE_NOT_FOUND" && parent?.filename && request.startsWith(".")) {
        const base = resolve(dirname(parent.filename), request);
        for (const candidate of [`${base}.ts`, `${base}/index.ts`]) {
          if (existsSync(candidate)) return candidate;
        }
      }
      throw error;
    }
  };
  registered = true;
  return ROOT;
}

module.exports = { registerTsRuntime, ROOT };
