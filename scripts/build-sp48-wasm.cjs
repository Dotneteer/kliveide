const { mkdirSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = resolve(__dirname, "..");
const source = resolve(root, "src/emu/machines/zxSpectrum48/wasm/sp48_core.c");
const z80Source = resolve(root, "src/emu/z80/wasm/z80_abi.c");
const z80CpuSource = resolve(root, "src/emu/z80/wasm/z80_cpu.c");
const output = resolve(root, "src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48.wasm");

function buildSp48Wasm({ compiler = process.env.SP48_WASM_CC || "clang", run = spawnSync } = {}) {
  mkdirSync(dirname(output), { recursive: true });
  const args = [
    "--target=wasm32",
    "-std=c11",
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
    "-Wl,--export=z80_abi_version",
    "-Wl,--export=z80_reset",
    "-Wl,--export=z80_state_block_ptr",
    "-Wl,--export=z80_state_block_size",
    "-Wl,--export=z80_state_export",
    "-Wl,--export=z80_state_import",
    "-Wl,--export=z80_execute_instruction",
    "-Wl,--export=z80_test_memory_ptr",
    "-Wl,--export=z80_test_memory_size",
    "-Wl,--export=z80_test_memory_log_capacity",
    "-Wl,--export=z80_test_io_log_capacity",
    "-Wl,--export=z80_test_tbblue_log_capacity",
    "-Wl,--export=z80_test_memory_log_count",
    "-Wl,--export=z80_test_memory_log_ptr",
    "-Wl,--export=z80_test_io_log_count",
    "-Wl,--export=z80_test_io_log_ptr",
    "-Wl,--export=z80_test_tbblue_log_count",
    "-Wl,--export=z80_test_tbblue_log_ptr",
    "-Wl,--export=z80_test_io_input_ptr",
    "-Wl,--export=z80_test_io_input_count_set",
    "-Wl,--export=z80_test_bus_reset",
    source,
    z80Source,
    z80CpuSource,
    "-o",
    output
  ];
  const result = run(compiler, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ZX Spectrum 48K WASM compilation failed (${result.status}).`);
  return { compiler, args, source, output };
}

if (require.main === module) buildSp48Wasm();

module.exports = { buildSp48Wasm, source, z80Source, z80CpuSource, output };
