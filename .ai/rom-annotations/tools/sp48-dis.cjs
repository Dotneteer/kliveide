// Lists a Spectrum ROM page through Klive's own disassembler with the decoding the IDE gives that page
// (prepareRomDisassembler: for a 48K BASIC page, RST $08 report codes and RST $28 calculator codes)
// (the D4-sanctioned source). The 48K ROM by default; another ROM by its sidecar's source.fileName,
// or ROM=<file in src/public/roms> without a sidecar.
// Usage: [PAGE=<n>] node .ai/rom-annotations/tools/sp48-dis.cjs <from hex> <to hex> [sidecar.dis]
// With a sidecar, its regions are used (data shown as .defb/.defw) - for a sidecar that `inherits`,
// merged with the inherited sidecars' byte-bound regions, as the IDE shows them; without, all code.
// Prints "ADDR BYTES INSTRUCTION [; decoder comment]" lines; grep -v '.def' leaves instruction starts.
// LABELS=<file> with an inheriting sidecar writes the merged page's labels to <file> instead: compare
// it before and after to see which inherited labels a ROM's changed bytes drop.
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
const { prepareRomDisassembler } = require(join(root, "src/renderer/appIde/annotations/romDecoder.ts"));
const { knownRomPageKind, romPageIdentity } = require(join(root, "src/common/roms/romIdentity.ts"));
const { parseAnnotations } = require(join(root, "src/renderer/appIde/annotations/programAnnotations.ts"));
const { withInheritedEntries } = require(join(root, "src/renderer/appIde/annotations/romInheritance.ts"));
const ROMS = join(root, "src/public/roms");
(async () => {
  const [from, to] = process.argv.slice(2, 4).map((x) => parseInt(x, 16));
  const sidecarFile = process.argv[4];
  const sidecar = sidecarFile ? JSON.parse(readFileSync(sidecarFile, "utf8")) : undefined;
  const romFile = sidecar?.source?.fileName ?? process.env.ROM ?? "sp48.rom";
  // --- PAGE=<n>: a page of a ROM file of several 16K pages (enNextZX.rom has four); the sidecar's bank n
  const page = Number(process.env.PAGE ?? 0);
  const bank = String(page);
  const bytes = new Uint8Array(readFileSync(join(ROMS, romFile))).subarray(page * 0x4000, (page + 1) * 0x4000);
  const types = { disassemble: MemorySectionType.Disassemble, bytes: MemorySectionType.ByteArray, words: MemorySectionType.WordArray, skip: MemorySectionType.Skip };
  let regions = sidecar?.banks[bank]?.regions;
  if (sidecar?.inherits?.length) {
    const merged = await withInheritedEntries(parseAnnotations(JSON.stringify(sidecar)).annotations, (p) => (p === page ? bytes : undefined), async (name, p) => ({
      annotations: parseAnnotations(readFileSync(join(ROMS, name), "utf8")).annotations,
      bytes: new Uint8Array(readFileSync(join(ROMS, name.replace(/\.dis$/i, "")))).subarray(p * 0x4000, (p + 1) * 0x4000)
    }));
    regions = merged.annotations.banks[bank].regions;
    // --- LABELS=<file>: write the merged page's labels ("$XXXX NAME" lines) instead of a listing
    if (process.env.LABELS) {
      const labels = merged.annotations.banks[bank].localLabels;
      require("node:fs").writeFileSync(process.env.LABELS, labels.map((l) => `$${l.value.toString(16).toUpperCase().padStart(4, "0")} ${l.name}`).join("\n") + "\n");
      return;
    }
  }
  // --- LABELS=<file> with a sidecar that inherits nothing: its own labels
  if (process.env.LABELS && sidecar && !sidecar.inherits?.length) {
    const labels = sidecar.banks[bank]?.localLabels ?? [];
    require("node:fs").writeFileSync(process.env.LABELS, labels.map((l) => `$${l.value.toString(16).toUpperCase().padStart(4, "0")} ${l.name}`).join("\n") + "\n");
    return;
  }
  const sections = regions
    ? regions.filter((r) => r.end < 0x4000).map((r) => new MemorySection(r.start, r.end, types[r.type]))
    : [new MemorySection(0, 0x3fff, MemorySectionType.Disassemble)];
  // --- The Next's pages use the Z80N's extra opcodes (romKindUsesZ80N); other ROMs do not
  const { romKindUsesZ80N } = require(join(root, "src/common/roms/romIdentity.ts"));
  const d = new Z80Disassembler(sections, bytes, undefined, {
    allowExtendedSet: romKindUsesZ80N(knownRomPageKind(romPageIdentity(bytes)))
  });
  prepareRomDisassembler(d, knownRomPageKind(romPageIdentity(bytes)));
  const out = await d.disassemble(0, 0x3fff);
  for (const it of out.outputItems) {
    if (it.address < from || it.address > to) continue;
    const ops = (it.opCodes ?? []).map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
    console.log(`${it.address.toString(16).padStart(4, "0").toUpperCase()} ${ops.padEnd(12)} ${it.instruction ?? ""}${it.hardComment ? "  ; " + it.hardComment : ""}`);
  }
})();
