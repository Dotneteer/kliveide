// Runs the IDE's own readiness check (checkRomSidecar, the "Ready" chip / rom-ann-check) on a sidecar.
// Usage: node .ai/rom-annotations/tools/check-annotations.cjs <sidecar.dis> [full.json]   ("problems": [] is clean)
// The console gets the first 3000 characters; with full.json the whole result (every unlabelled target) is written there.
const { existsSync, readFileSync } = require("node:fs");
const { dirname, join, resolve } = require("node:path");
const root = resolve(__dirname, "../../..");
process.chdir(root);
module.paths.unshift(join(root, "node_modules"));
function registerTsRuntime() {
  const esbuild = require(join(root,"node_modules/esbuild"));
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
  require(join(root,"node_modules/tsconfig-paths")).register({
    baseUrl: root,
    paths: {
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
    }
  });
  const Module = require("node:module");
  const original = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, opts) {
    try {
      return original.call(this, request, parent, isMain, opts);
    } catch (error) {
      if (error?.code === "MODULE_NOT_FOUND" && parent?.filename) {
        const base = request.startsWith(".") ? resolve(dirname(parent.filename), request) : undefined;
        for (const candidate of base ? [`${base}.ts`, `${base}/index.ts`] : []) {
          if (existsSync(candidate)) return candidate;
        }
      }
      throw error;
    }
  };
}

registerTsRuntime();
const { checkRomSidecar } = require(join(root, "src/renderer/appIde/annotations/romSidecarCheck.ts"));
(async () => {
  const text = readFileSync(process.argv[2], "utf8");
  const romFile = JSON.parse(text).source?.fileName ?? "zx81.rom"; // the ROM the sidecar names
  const rom = new Uint8Array(readFileSync(join(root, "src/public/roms", romFile)));
  // --- Inherited sidecars as the IDE reads them: the working copy when there is one, else the shipped
  // --- file; the bytes of the shipped ROM each was written for
  const { parseAnnotations } = require(join(root, "src/renderer/appIde/annotations/programAnnotations.ts"));
  const home = join(require("node:os").homedir(), "Klive/RomAnnotations");
  const inherited = async (sidecar, page) => {
    const working = join(home, sidecar);
    const file = existsSync(working) ? working : join(root, "src/public/roms", sidecar);
    const described = new Uint8Array(readFileSync(join(root, "src/public/roms", sidecar.replace(/\.dis$/i, ""))));
    return {
      annotations: parseAnnotations(readFileSync(file, "utf8")).annotations,
      bytes: described.subarray(page * 0x4000, (page + 1) * 0x4000)
    };
  };
  const result = await checkRomSidecar(text, (page) => (page === 0 ? rom.subarray(0, 0x4000) : undefined), inherited);
  if (process.argv[3]) require("node:fs").writeFileSync(process.argv[3], JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result, null, 1).slice(0, 3000));
})();
