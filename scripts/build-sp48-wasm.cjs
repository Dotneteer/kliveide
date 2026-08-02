const { mkdirSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = resolve(__dirname, "..");
const source = resolve(root, "src/emu/machines/zxSpectrum48/wasm/sp48_core.c");
const output = resolve(root, "src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48.wasm");

function buildSp48Wasm({ compiler = process.env.SP48_WASM_CC || "clang", run = spawnSync } = {}) {
  mkdirSync(dirname(output), { recursive: true });
  const args = [
    "--target=wasm32",
    "-O3",
    "-nostdlib",
    "-Wl,--no-entry",
    "-Wl,--export-memory",
    "-Wl,--initial-memory=262144",
    "-Wl,--max-memory=262144",
    "-Wl,--export=sp48_abi_version",
    "-Wl,--export=sp48_create",
    "-Wl,--export=sp48_reset",
    "-Wl,--export=sp48_load_rom_byte",
    "-Wl,--export=sp48_read_memory",
    "-Wl,--export=sp48_write_memory",
    "-Wl,--export=sp48_read_port",
    "-Wl,--export=sp48_write_port",
    source,
    "-o",
    output
  ];
  const result = run(compiler, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ZX Spectrum 48K WASM compilation failed (${result.status}).`);
  return { compiler, args, source, output };
}

if (require.main === module) buildSp48Wasm();

module.exports = { buildSp48Wasm, source, output };
