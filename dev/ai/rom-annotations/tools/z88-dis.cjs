// Lists a 16K bank of a Cambridge Z88 OZ ROM through Klive's own disassembler, with the decoding romDecoder.ts
// gives the "z88-oz" page kind: Z88CustomDisassembler, which lists RST 20h with its OZ call's one or two bytes
// ("oz OS_..."), RST 18h with its floating-point operation ("fpp ..."). An OZ bank holds code for different
// segments (bank $0A: EazyLink at $8000, the Filer at $E400), so each run is decoded at the address of the
// segment it runs in: the sidecar page's "segments" ([{ "start": offset, "segment": 0-3 }]), else segment 3
// ($C000) for the whole bank. The low 14 bits of an OZ address are its offset in the bank.
// Rows print the bank offset first (what the sidecar's keys and the other tools use), then "@" and the address.
// Usage: PAGE=<bank> node dev/ai/rom-annotations/tools/z88-dis.cjs <from hex> <to hex> [sidecar.dis]
// The ROM is the sidecar's source.fileName, else $ROM, else z88v47.rom; PAGE (default 0) is the bank ($00-$1F).
// With a sidecar, the bank's regions shape the listing (data as .defb/.defw); without, the whole bank is code.
// Prints "OFFS @ADDR BYTES INSTRUCTION [; decoder comment]" lines; grep -v '.def' leaves instruction starts.
const { existsSync, readFileSync } = require("node:fs");
const { dirname, join, resolve } = require("node:path");
const root = resolve(__dirname, "../../../..");
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
const { MemorySectionType } = require(join(root, "src/common/abstractions/MemorySection.ts"));
const { MemorySection } = require(join(root, "src/renderer/appIde/disassemblers/common-types.ts"));
const { Z80Disassembler } = require(join(root, "src/renderer/appIde/disassemblers/z80-disassembler/z80-disassembler.ts"));
const { prepareRomDisassembler, romRunOrigin } = require(join(root, "src/renderer/appIde/annotations/romDecoder.ts"));
const { knownRomPageKind, romPageIdentity } = require(join(root, "src/common/roms/romIdentity.ts"));
(async () => {
  const [from, to] = process.argv.slice(2, 4).map((x) => parseInt(x, 16));
  const sidecarFile = process.argv[4];
  const sidecar = sidecarFile ? JSON.parse(readFileSync(sidecarFile, "utf8")) : undefined;
  const romName = sidecar?.source?.fileName ?? process.env.ROM ?? "z88v47.rom";
  const PAGE = Number(process.env.PAGE ?? 0);
  const file = new Uint8Array(readFileSync(join(root, "src/public/roms", romName)));
  const bytes = file.subarray(PAGE * 0x4000, (PAGE + 1) * 0x4000);
  if (bytes.length === 0) throw new Error(`${romName} has no bank ${PAGE}`);
  const END = bytes.length - 1;
  const kind = knownRomPageKind(romPageIdentity(bytes));
  if (kind !== "z88-oz") throw new Error(`${romName} bank ${PAGE} is not a known OZ ROM bank (kind ${kind})`);
  const segments = sidecar?.pages?.[String(PAGE)]?.segments;
  // --- The runs: from each segment entry's start to the next one's (one run, the whole bank, without any)
  const starts = [...new Set([0, ...(segments ?? []).map((s) => s.start)])].filter((s) => s <= END).sort((a, b) => a - b);
  const types = { disassemble: MemorySectionType.Disassemble, bytes: MemorySectionType.ByteArray, words: MemorySectionType.WordArray, skip: MemorySectionType.Skip };
  const regions = sidecar?.banks?.[String(PAGE)]?.regions ?? [{ start: 0, end: END, type: "disassemble" }];
  for (let i = 0; i < starts.length; i++) {
    const runStart = starts[i];
    const runEnd = i + 1 < starts.length ? starts[i + 1] - 1 : END;
    if (runEnd < from || runStart > to) continue;
    const origin = romRunOrigin(kind, segments, runStart);
    const sections = regions
      .filter((r) => r.start <= runEnd && r.end >= runStart)
      .map((r) => new MemorySection(origin + Math.max(r.start, runStart), origin + Math.min(r.end, runEnd), types[r.type]));
    if (sections.length === 0) continue;
    const memory = new Uint8Array(origin + bytes.length);
    memory.set(bytes, origin);
    const d = new Z80Disassembler(sections, memory, undefined, { allowExtendedSet: false });
    prepareRomDisassembler(d, kind);
    const out = await d.disassemble(origin + runStart, origin + runEnd);
    for (const it of out.outputItems) {
      const offset = it.address - origin;
      if (offset < from || offset > to) continue;
      const ops = (it.opCodes ?? []).map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
      const at = `@${it.address.toString(16).padStart(4, "0").toUpperCase()} `;
      console.log(`${offset.toString(16).padStart(4, "0").toUpperCase()} ${at}${ops.padEnd(12)} ${it.instruction ?? ""}${it.hardComment ? "  ; " + it.hardComment : ""}`);
    }
  }
})();
