import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const wasmTargets = [
  {
    name: "bitmap-demo",
    source: "src/wasm/bitmap-demo/bitmap-demo.c",
    output: "public/wasm/bitmap-demo.wasm",
    exports: ["bitmap_width", "bitmap_height", "bitmap_ptr", "render_frame"]
  },
  {
    name: "z80",
    source: "src/emu/z80/z80.c",
    output: "public/wasm/z80.wasm",
    exports: [
      "z80MemoryPtr",
      "z80Reset",
      "z80ExecuteCpuCycle",
      "z80GetTacts",
      "z80SetTacts",
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
      "z80GetLastTbBlueAddress",
      "z80GetLastTbBlueValue",
      "z80GetLastTbBlueIsWrite",
      "z80SetPortReadValue",
      "z80ClearBusEvents"
    ]
  },
  {
    name: "sp48",
    source: "src/emu/sp48/sp48.c",
    output: "public/wasm/sp48.wasm",
    exports: [
      "sp48MemoryPtr",
      "sp48PixelBufferPtr",
      "sp48AudioSamplesPtr",
      "sp48KeyboardLinesPtr",
      "sp48Reset",
      "sp48HardReset",
      "sp48ExecuteFrame",
      "sp48ExecuteInstruction",
      "sp48SetKeyStatus",
      "sp48SetAudioSampleRate",
      "sp48GetScreenWidth",
      "sp48GetScreenHeight",
      "sp48GetPixelBufferStartOffset",
      "sp48GetAudioSampleCount",
      "sp48GetAudioSampleCapacity",
      "sp48GetTactsInFrame",
      "sp48GetBaseClockFrequency",
      "sp48GetFrames",
      "sp48GetTacts",
      "sp48GetKeyboardLine",
      "sp48GetDiagnosticFlags"
    ]
  }
];

export async function buildWasm({ silent = false } = {}) {
  for (const target of wasmTargets) {
    await buildTarget(target, { silent });
  }
}

async function buildTarget(target, { silent }) {
  const outputPath = resolve(repoRoot, target.output);
  await mkdir(dirname(outputPath), { recursive: true });

  const args = [
    "--target=wasm32",
    "-O3",
    "-fno-builtin",
    "-nostdlib",
    "-Wl,--no-entry",
    "-Wl,--export-memory",
    ...target.exports.map((exportName) => `-Wl,--export=${exportName}`),
    "-o",
    target.output,
    target.source
  ];

  if (!silent) {
    console.log(`[wasm] Building ${target.name}`);
  }

  await run("clang", args);
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildWasm().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
