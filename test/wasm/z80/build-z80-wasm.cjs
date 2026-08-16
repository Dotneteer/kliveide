const { mkdirSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = resolve(__dirname, "../../..");
const source = resolve(root, "src/emu/z80/wasm/z80.c");
const output = resolve(__dirname, "dist/z80-test.wasm");

const productionExports = [
  "memory",
  "z80Reset",
  "z80ExecuteCpuCycle",
  "z80MemoryPtr",
  "z80GetAf",
  "z80SetAf",
  "z80GetBc",
  "z80SetBc",
  "z80GetDe",
  "z80SetDe",
  "z80GetHl",
  "z80SetHl",
  "z80GetAfAlt",
  "z80SetAfAlt",
  "z80GetBcAlt",
  "z80SetBcAlt",
  "z80GetDeAlt",
  "z80SetDeAlt",
  "z80GetHlAlt",
  "z80SetHlAlt",
  "z80GetIx",
  "z80SetIx",
  "z80GetIy",
  "z80SetIy",
  "z80GetIr",
  "z80SetIr",
  "z80GetWz",
  "z80SetWz",
  "z80GetPc",
  "z80SetPc",
  "z80GetSp",
  "z80SetSp",
  "z80GetTacts",
  "z80SetTacts",
  "z80GetPrefix",
  "z80GetHalted",
  "z80GetZ80NMode",
  "z80SetZ80NMode",
  "z80GetSigInt",
  "z80SetSigInt",
  "z80GetSigNmi",
  "z80SetSigNmi",
  "z80GetSigRst",
  "z80SetSigRst",
  "z80GetInterruptMode",
  "z80SetInterruptMode",
  "z80SetInterruptVector",
  "z80GetIff1",
  "z80SetIff1",
  "z80GetIff2",
  "z80SetIff2",
  "z80GetEiBacklog",
  "z80SetEiBacklog",
  "z80GetRetExecuted",
  "z80SetRetExecuted",
  "z80GetRetnExecuted",
  "z80SetRetnExecuted",
  "z80TactPlusN",
  "z80PeekMemory",
  "z80PokeMemory",
  "z80GetLastMemAddress",
  "z80GetLastMemValue",
  "z80GetLastMemIsWrite",
  "z80GetLastPortAddress",
  "z80GetLastPortValue",
  "z80GetLastPortIsWrite",
  "z80SetPortReadValue",
  "z80GetLastTbBlueAddress",
  "z80GetLastTbBlueValue",
  "z80GetLastTbBlueIsWrite",
  "z80ClearBusEvents"
];

function buildZ80Wasm ({
  compiler = process.env.Z80_WASM_CC || "clang",
  outputPath = output,
  run = spawnSync
} = {}) {
  mkdirSync(dirname(outputPath), { recursive: true });
  const args = [
    "--target=wasm32",
    "-std=c11",
    "-O3",
    "-Wl,--strip-all",
    "-ffreestanding",
    "-fno-builtin",
    "-nostdlib",
    "-Wl,--no-entry",
    "-Wl,--export-memory",
    "-Wl,--initial-memory=1048576",
    "-Wl,--max-memory=1048576",
    ...productionExports.filter(name => name !== "memory").map(name => `-Wl,--export=${name}`),
    source,
    "-o",
    outputPath
  ];
  const result = run(compiler, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Z80 WASM test compilation failed (${result.status}).`);
  return {
    compiler,
    args,
    exports: productionExports,
    output: outputPath,
    source
  };
}

if (require.main === module) buildZ80Wasm();

module.exports = {
  buildZ80Wasm,
  output,
  productionExports,
  source
};
