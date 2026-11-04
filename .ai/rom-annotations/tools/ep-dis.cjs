// Lists a 16K page of an Enterprise 64/128 ROM through Klive's own disassembler (the D4-sanctioned
// source), with the decoding romDecoder.ts gives the Enterprise page kinds: EpCustomDisassembler, which
// shows the byte after every RST 30h (the EXOS call) as data, with the function's name. Every page is
// decoded at $C000, where EXOS runs its own segments and enters an extension ROM (romKindOrigin).
// Rows print the page offset first (what the sidecar's keys and the other tools use), then "@" and the
// address. A jump below $C000 (into the page 0-2 RAM, or EXOS's code at $0000-$003F) is not the page's.
// Usage: PAGE=<n> node .ai/rom-annotations/tools/ep-dis.cjs <from hex> <to hex> [sidecar.dis]
// The ROM is the sidecar's source.fileName, else $ROM, else ep-exos21.rom; PAGE (default 0) picks the 16K
// page of a 32K file (EXOS's segments 00h/01h, EXDOS's 20h/21h). With a sidecar, the page's regions shape
// the listing (data as .defb/.defw); without, the whole page is code.
// Prints "OFFS @ADDR BYTES INSTRUCTION [; decoder comment]" lines; grep -v '.def' leaves instruction starts.
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
const { knownRomPageKind, romKindOrigin, romPageIdentity } = require(join(root, "src/common/roms/romIdentity.ts"));
(async () => {
  const [from, to] = process.argv.slice(2, 4).map((x) => parseInt(x, 16));
  const sidecarFile = process.argv[4];
  const sidecar = sidecarFile ? JSON.parse(readFileSync(sidecarFile, "utf8")) : undefined;
  const romName = sidecar?.source?.fileName ?? process.env.ROM ?? "ep-exos21.rom";
  const PAGE = Number(process.env.PAGE ?? 0);
  const file = new Uint8Array(readFileSync(join(root, "src/public/roms", romName)));
  const bytes = file.subarray(PAGE * 0x4000, (PAGE + 1) * 0x4000);
  if (bytes.length === 0) throw new Error(`${romName} has no page ${PAGE}`);
  const END = bytes.length - 1;
  const kind = knownRomPageKind(romPageIdentity(bytes));
  if (!kind?.startsWith("ep-")) throw new Error(`${romName} page ${PAGE} is not a known Enterprise ROM page (kind ${kind})`);
  const origin = romKindOrigin(kind);
  const types = { disassemble: MemorySectionType.Disassemble, bytes: MemorySectionType.ByteArray, words: MemorySectionType.WordArray, skip: MemorySectionType.Skip };
  const sections = sidecar
    ? (sidecar.banks[String(PAGE)]?.regions ?? [{ start: 0, end: END, type: "disassemble" }]).filter((r) => r.start <= END).map((r) => new MemorySection(origin + r.start, origin + Math.min(r.end, END), types[r.type]))
    : [new MemorySection(origin, origin + END, MemorySectionType.Disassemble)];
  const memory = new Uint8Array(origin + bytes.length);
  memory.set(bytes, origin);
  const d = new Z80Disassembler(sections, memory, undefined, { allowExtendedSet: false });
  prepareRomDisassembler(d, kind);
  const out = await d.disassemble(origin, origin + END);
  for (const it of out.outputItems) {
    const offset = it.address - origin;
    if (offset < from || offset > to) continue;
    const ops = (it.opCodes ?? []).map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
    const at = origin ? `@${it.address.toString(16).padStart(4, "0").toUpperCase()} ` : "";
    console.log(`${offset.toString(16).padStart(4, "0").toUpperCase()} ${at}${ops.padEnd(12)} ${it.instruction ?? ""}${it.hardComment ? "  ; " + it.hardComment : ""}`);
  }
})();
