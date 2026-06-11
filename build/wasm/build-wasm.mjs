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
      "sp48TapeDataPtr",
      "sp48TapeFileNamePtr",
      "sp48Reset",
      "sp48HardReset",
      "sp48ExecuteFrame",
      "sp48ExecuteInstruction",
      "sp48RenderInstantScreen",
      "sp48DelayAddressBusAccess",
      "sp48DelayPortAccess",
      "sp48DelayPortRead",
      "sp48DelayPortWrite",
      "sp48ResetContentionCounters",
      "sp48SetTacts",
      "sp48UploadRomByte",
      "sp48ReadMemory",
      "sp48WriteMemory",
      "sp48ReadScreenMemoryOffset",
      "sp48SetKeyStatus",
      "sp48ReadPort",
      "sp48ReadFloatingBus",
      "sp48WritePort",
      "sp48SetAudioSampleRate",
      "sp48GetScreenWidth",
      "sp48GetScreenHeight",
      "sp48GetPixelBufferStartOffset",
      "sp48GetRomSize",
      "sp48GetRomUploadCount",
      "sp48GetRomChecksum",
      "sp48GetAudioSampleCount",
      "sp48GetAudioSampleCapacity",
      "sp48GetTactsInFrame",
      "sp48GetBaseClockFrequency",
      "sp48GetFrames",
      "sp48GetTacts",
      "sp48GetCurrentFrameTact",
      "sp48GetRasterLines",
      "sp48GetScreenLineTime",
      "sp48GetTimingScreenWidth",
      "sp48GetTimingScreenLines",
      "sp48GetFirstDisplayLine",
      "sp48GetFirstVisibleLine",
      "sp48GetFirstVisibleBorderTact",
      "sp48GetContentionValue",
      "sp48GetRenderingPhase",
      "sp48GetRenderingPixelAddress",
      "sp48GetRenderingAttributeAddress",
      "sp48GetRenderingPixelIndex",
      "sp48GetTotalContentionDelaySinceStart",
      "sp48GetContentionDelaySincePause",
      "sp48GetNextFrameStartTact",
      "sp48GetFrameCompleted",
      "sp48GetInterruptsRaised",
      "sp48GetInterruptLineActive",
      "sp48GetCpuInstructionsExecuted",
      "sp48GetCpuFrameSliceInstructions",
      "sp48GetCpuTacts",
      "sp48GetCpuAf",
      "sp48SetCpuAf",
      "sp48GetCpuBc",
      "sp48SetCpuBc",
      "sp48GetCpuDe",
      "sp48SetCpuDe",
      "sp48GetCpuHl",
      "sp48SetCpuHl",
      "sp48GetCpuIx",
      "sp48SetCpuIx",
      "sp48GetCpuIy",
      "sp48SetCpuIy",
      "sp48GetCpuAfAlt",
      "sp48SetCpuAfAlt",
      "sp48GetCpuBcAlt",
      "sp48GetCpuDeAlt",
      "sp48GetCpuHlAlt",
      "sp48GetCpuIr",
      "sp48GetCpuWz",
      "sp48GetCpuPc",
      "sp48SetCpuPc",
      "sp48GetCpuSp",
      "sp48SetCpuSp",
      "sp48TapeClear",
      "sp48TapeSetFileNameByte",
      "sp48TapeBeginUpload",
      "sp48TapeSetBlock",
      "sp48TapeWriteData",
      "sp48TapeFinishUpload",
      "sp48TapeRewind",
      "sp48TapeSetMode",
      "sp48TapeSetFastLoad",
      "sp48TapeGetFastLoad",
      "sp48TapeGetMaxBlocks",
      "sp48TapeGetDataCapacity",
      "sp48TapeGetFileNameCapacity",
      "sp48TapeGetBlockCount",
      "sp48TapeGetDataLength",
      "sp48TapeGetCurrentBlockIndex",
      "sp48TapeGetLoaded",
      "sp48TapeGetEof",
      "sp48TapeGetUploadActive",
      "sp48TapeGetMode",
      "sp48TapeGetPlayPhase",
      "sp48TapeGetCurrentEarBit",
      "sp48TapeGetCurrentDataIndex",
      "sp48TapeGetCurrentBitMask",
      "sp48TapeGetStartTact",
      "sp48TapeGetModeChangeCount",
      "sp48TapeGetLastModeChangeTact",
      "sp48TapeGetLastModeChangePc",
      "sp48TapeGetLoadStartCount",
      "sp48TapeGetSaveStartCount",
      "sp48TapeClassifySavePulse",
      "sp48TapeGetSavePhase",
      "sp48TapeGetSaveLastPulse",
      "sp48TapeGetSaveMicBit",
      "sp48TapeGetSaveLastMicBitTact",
      "sp48TapeGetSavePilotPulseCount",
      "sp48TapeGetSavedBlockCount",
      "sp48TapeGetSavedDataLength",
      "sp48TapeGetSavedRevision",
      "sp48TapeGetSaveDataCapacity",
      "sp48TapeGetSaveMaxBlocks",
      "sp48TapeGetSavedBlockOffset",
      "sp48TapeGetSavedBlockLength",
      "sp48TapeClearSavedBlocks",
      "sp48TapeSaveDataPtr",
      "sp48TapeGetEarBit",
      "sp48TapeGetBlockOffset",
      "sp48TapeGetBlockLength",
      "sp48TapeGetBlockPauseAfter",
      "sp48TapeGetBlockPilotPulseLength",
      "sp48TapeGetBlockSync1PulseLength",
      "sp48TapeGetBlockSync2PulseLength",
      "sp48TapeGetBlockZeroBitPulseLength",
      "sp48TapeGetBlockOneBitPulseLength",
      "sp48TapeGetBlockEndSyncPulseLength",
      "sp48TapeGetBlockLastByteUsedBits",
      "sp48TapeGetBlockPilotPulseCount",
      "sp48GetCpuHalted",
      "sp48GetCpuPrefix",
      "sp48GetCpuIff1",
      "sp48SetCpuIff1",
      "sp48GetCpuInterruptMode",
      "sp48SetCpuInterruptMode",
      "sp48GetCpuRetExecuted",
      "sp48GetCpuRetnExecuted",
      "sp48GetLastMemoryAddress",
      "sp48GetLastMemoryValue",
      "sp48GetLastMemoryIsWrite",
      "sp48GetLastPortAddress",
      "sp48GetLastPortValue",
      "sp48GetLastPortIsWrite",
      "sp48GetKeyboardLine",
      "sp48GetPortFeValue",
      "sp48GetBorderColor",
      "sp48GetEarBit",
      "sp48GetMicBit",
      "sp48GetBeeperLevel",
      "sp48GetEarBitChangedFrom0Tacts",
      "sp48GetEarBitChangedFrom1Tacts",
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
