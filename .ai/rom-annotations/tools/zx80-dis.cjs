// Lists the ZX80 ROM through Klive's own disassembler (the D4-sanctioned source), with the one custom
// decoding the ROM's bytes call for: the handler at $0008 pops its return address and reads the byte
// there (POP HL / LD L,(HL)), so the byte after every RST $08 is data, shown as ".defb" with its
// report: the code + 1, as RUN_STOP ($0492-$04A8) prints it. RST $28 is plain code: the ZX80 has
// no calculator. Klive's IDE decodes the same way (Zx80CustomDisassembler, romDecoder.ts).
// Usage: node .ai/rom-annotations/tools/zx80-dis.cjs <from hex> <to hex> [sidecar.dis]
// With a sidecar, its regions are used (data shown as .defb/.defw); without, the ROM is all code.
// Prints "ADDR BYTES INSTRUCTION [; decoder comment]" lines; grep -v '.def' leaves instruction starts.
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
const { MemorySectionType } = require(join(root, "src/common/abstractions/MemorySection.ts"));
const { MemorySection } = require(join(root, "src/renderer/appIde/disassemblers/common-types.ts"));
const { Z80Disassembler } = require(join(root, "src/renderer/appIde/disassemblers/z80-disassembler/z80-disassembler.ts"));
const { CUSTOM_Z80_DISASSEMBLY_TOOL } = require(join(root, "src/renderer/appIde/disassemblers/z80-disassembler/custom-disassembly.ts"));
class Zx80Rst08Decoder {
  toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;
  pending = false;
  setDisassemblyApi(api) { this.api = api; }
  startSectionDisassembly() { this.pending = false; }
  beforeInstruction(fetchResult) {
    if (!this.pending) return false;
    this.pending = false;
    const code = this.api.fetch().opcode;
    this.api.addDisassemblyItem({ address: fetchResult.offset, instruction: `.defb $${code.toString(16).padStart(2, "0").toUpperCase()}`, hardComment: `(report ${code + 1})` });
    return true;
  }
  afterInstruction(item) { if (item.opCodes?.[0] === 0xcf) { this.pending = true; item.hardComment = "(error)"; } }
}
(async () => {
  const [from, to] = process.argv.slice(2, 4).map((x) => parseInt(x, 16));
  const sidecarFile = process.argv[4];
  const bytes = readFileSync(join(root, "src/public/roms/zx80.rom"));
  const types = { disassemble: MemorySectionType.Disassemble, bytes: MemorySectionType.ByteArray, words: MemorySectionType.WordArray, skip: MemorySectionType.Skip };
  const sections = sidecarFile
    ? JSON.parse(readFileSync(sidecarFile, "utf8")).banks["0"].regions.filter((r) => r.start < 0x1000).map((r) => new MemorySection(r.start, Math.min(r.end, 0x0fff), types[r.type]))
    : [new MemorySection(0, 0x0fff, MemorySectionType.Disassemble)];
  const d = new Z80Disassembler(sections, new Uint8Array(bytes), undefined, { allowExtendedSet: false });
  d.setCustomDisassembler(new Zx80Rst08Decoder());
  const out = await d.disassemble(0, 0x0fff);
  for (const it of out.outputItems) {
    if (it.address < from || it.address > to) continue;
    const ops = (it.opCodes ?? []).map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
    console.log(`${it.address.toString(16).padStart(4, "0").toUpperCase()} ${ops.padEnd(12)} ${it.instruction ?? ""}${it.hardComment ? "  ; " + it.hardComment : ""}`);
  }
})();
