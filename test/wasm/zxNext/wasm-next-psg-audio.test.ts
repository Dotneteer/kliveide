import { describe, expect, it } from "vitest";

import { TurboSoundDevice } from "@emu/machines/zxNext/TurboSoundDevice";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM PSG/TurboSound audio", () => {
  it("matches TypeScript chip selection, panning, mono mode, and YM register readback", async () => {
    const oracle = new TurboSoundDevice();
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    oracle.enableTurbosound = true;
    exports.zxnextSetPsgTurbosoundEnabled(1);

    oracle.setPsgRegisterIndex(0xfd);
    exports.zxnextSetPsgRegisterIndex(0xfd);
    oracle.setPsgRegisterIndex(0x01);
    exports.zxnextSetPsgRegisterIndex(0x01);
    oracle.writePsgRegisterValue(0xf5);
    exports.zxnextWritePsgRegisterValue(0xf5);

    oracle.setAyStereoMode(true);
    oracle.setChipMonoMode(2, true);
    exports.zxnextSetPsgAyStereoMode(1);
    exports.zxnextSetPsgChipMonoMode(2, 1);

    expect(exports.zxnextGetPsgSelectedChip()).toBe(oracle.getSelectedChipId());
    expect(exports.zxnextGetPsgSelectedRegister()).toBe(oracle.getSelectedRegister());
    expect(exports.zxnextGetPsgChipPanning(2)).toBe(oracle.getChipPanning(2));
    expect(exports.zxnextGetPsgChipMonoMode(2)).toBe(oracle.getChipMonoMode(2) ? 1 : 0);
    expect(exports.zxnextGetPsgRegister(2, 1)).toBe(oracle.getChip(2).readPsgRegisterValue());
    expect(exports.zxnextReadPsgRegisterValue()).toBe(oracle.readPsgRegisterValue());
  });

  it("matches TypeScript high-bit YM register alias selection", async () => {
    const oracle = new TurboSoundDevice();
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    oracle.setPsgRegisterIndex(0x11);
    oracle.writePsgRegisterValue(0xa5);
    exports.zxnextSetPsgRegisterIndex(0x11);
    exports.zxnextWritePsgRegisterValue(0xa5);

    expect(exports.zxnextGetPsgSelectedRegister()).toBe(oracle.getSelectedRegister());
    expect(exports.zxnextGetPsgRegister(0, 1)).toBe(oracle.getChip(0).readPsgRegisterValue());
    expect(exports.zxnextReadPsgRegisterValue()).toBe(oracle.readPsgRegisterValue());
  });

  it("exposes deterministic noise/envelope movement and stereo samples", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    exports.zxnextSetPsgRegisterIndex(0x08);
    exports.zxnextWritePsgRegisterValue(0x1f);
    exports.zxnextSetPsgRegisterIndex(0x09);
    exports.zxnextWritePsgRegisterValue(0x10);
    exports.zxnextSetPsgRegisterIndex(0x0a);
    exports.zxnextWritePsgRegisterValue(0x08);
    exports.zxnextSetPsgRegisterIndex(0x0d);
    exports.zxnextWritePsgRegisterValue(0x0f);

    const rngBefore = exports.zxnextGetPsgNoiseRng(0);
    const envBefore = exports.zxnextGetPsgEnvelopeStep(0);
    exports.zxnextGeneratePsgOutput(0);
    exports.zxnextGeneratePsgOutput(0);

    expect(exports.zxnextGetPsgNoiseRng(0)).not.toBe(rngBefore);
    expect(exports.zxnextGetPsgEnvelopeStep(0)).toBeLessThan(envBefore);
    expect(exports.zxnextGetPsgStereoLeft(0)).toBeGreaterThan(0);
    expect(exports.zxnextGetPsgStereoRight(0)).toBeGreaterThan(0);
  });

  it("matches TypeScript YM tone output and TurboSound stereo routing", async () => {
    const oracle = new TurboSoundDevice();
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    writePsgBoth(oracle, exports, 0x00, 0x01);
    writePsgBoth(oracle, exports, 0x01, 0x00);
    writePsgBoth(oracle, exports, 0x07, 0x3e);
    writePsgBoth(oracle, exports, 0x08, 0x0f);

    oracle.generateChipOutputValue(0);
    exports.zxnextGeneratePsgOutput(0);

    expect(exports.zxnextGetPsgOutputA(0)).toBe(oracle.getChip(0).currentOutputA);
    expect(exports.zxnextGetPsgOutputB(0)).toBe(oracle.getChip(0).currentOutputB);
    expect(exports.zxnextGetPsgOutputC(0)).toBe(oracle.getChip(0).currentOutputC);
    expect(exports.zxnextGetPsgStereoLeft(0)).toBe(oracle.getChipStereoOutput(0).left);
    expect(exports.zxnextGetPsgStereoRight(0)).toBe(oracle.getChipStereoOutput(0).right);
  });

  it("averages PSG output over the exact WASM sample window", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports as any;

    exports.zxnextSetPsgRegisterIndex(0x00);
    exports.zxnextWritePsgRegisterValue(0x01);
    exports.zxnextSetPsgRegisterIndex(0x01);
    exports.zxnextWritePsgRegisterValue(0x00);
    exports.zxnextSetPsgRegisterIndex(0x07);
    exports.zxnextWritePsgRegisterValue(0x3e);
    exports.zxnextSetPsgRegisterIndex(0x08);
    exports.zxnextWritePsgRegisterValue(0x0f);

    exports.zxnextPreparePsgAudioSample(256);

    expect(exports.zxnextGetPsgSampleLeft()).toBe(32_768);
    expect(exports.zxnextGetPsgSampleRight()).toBe(0);
  });

  it("matches TypeScript YM envelope and noise progression", async () => {
    const oracle = new TurboSoundDevice();
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    writePsgBoth(oracle, exports, 0x06, 0x02);
    writePsgBoth(oracle, exports, 0x07, 0x37);
    writePsgBoth(oracle, exports, 0x08, 0x10);
    writePsgBoth(oracle, exports, 0x0b, 0x01);
    writePsgBoth(oracle, exports, 0x0c, 0x00);
    writePsgBoth(oracle, exports, 0x0d, 0x0b);

    for (let i = 0; i < 12; i++) {
      oracle.generateChipOutputValue(0);
      exports.zxnextGeneratePsgOutput(0);
    }

    const oracleState = oracle.getChipState(0);
    expect(exports.zxnextGetPsgNoiseRng(0)).toBe(oracleState.noiseSeed);
    expect(exports.zxnextGetPsgEnvelopeStep(0)).toBe((oracle.getChip(0).getState() as any).envStep);
    expect(exports.zxnextGetPsgOutputA(0)).toBe(oracle.getChip(0).currentOutputA);
  });

  it("advances PSG during normal WASM frame execution", async () => {
    const samples = await renderWasmToneFrame(0);
    expect(samples.length).toBeGreaterThan(10);
    expect(countSampleEdges(samples)).toBeGreaterThan(0);
  });

  it("keeps PSG pitch stable when the WASM ZX Next CPU speed changes", async () => {
    const baseEdges = countSampleEdges(await renderWasmToneFrame(0));
    const fastEdges = countSampleEdges(await renderWasmToneFrame(3));

    expect(baseEdges).toBeGreaterThan(0);
    expect(Math.abs(fastEdges - baseEdges)).toBeLessThanOrEqual(1);
  });
});

function writePsgBoth(
  oracle: TurboSoundDevice,
  exports: {
    zxnextSetPsgRegisterIndex: (value: number) => number;
    zxnextWritePsgRegisterValue: (value: number) => number;
  },
  reg: number,
  value: number
): void {
  oracle.setPsgRegisterIndex(reg);
  oracle.writePsgRegisterValue(value);
  exports.zxnextSetPsgRegisterIndex(reg);
  exports.zxnextWritePsgRegisterValue(value);
}

async function renderWasmToneFrame(speed: number) {
  const wasm = await createTestZxNextWasmMachine();
  const exports = wasm.wasmV2Runtime!.exports;

  wasm.hardReset();
  wasm.doWriteMemory(0x8000, 0x76);
  wasm.pc = 0x8000;

  exports.zxnextSetNextRegisterIndex(0x07);
  exports.zxnextSetNextRegisterValue(speed);

  exports.zxnextSetPsgRegisterIndex(0x00);
  exports.zxnextWritePsgRegisterValue(0x20);
  exports.zxnextSetPsgRegisterIndex(0x01);
  exports.zxnextWritePsgRegisterValue(0x00);
  exports.zxnextSetPsgRegisterIndex(0x07);
  exports.zxnextWritePsgRegisterValue(0x3e);
  exports.zxnextSetPsgRegisterIndex(0x08);
  exports.zxnextWritePsgRegisterValue(0x0f);

  wasm.executeMachineFrame();
  return wasm.getAudioSamples().map(sample => sample.left);
}

function countSampleEdges(samples: number[]): number {
  let edges = 0;
  let previous = samples[0] ?? 0;
  for (const sample of samples.slice(1)) {
    if (Math.abs(sample - previous) > 0.001) {
      edges++;
      previous = sample;
    }
  }
  return edges;
}
