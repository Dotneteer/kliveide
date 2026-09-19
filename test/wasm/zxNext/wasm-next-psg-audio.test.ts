import { describe, expect, it } from "vitest";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM PSG/TurboSound audio", () => {
  it("selects a 5-bit YM register number; registers 16-31 take no write and read $FF", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    // --- The $FFFD port path (AyRegPortHandler -> selectRegister): a 5-bit register number
    // --- (ym2149.vhd ~173). Registers 16-31 take no writes and read $FF in YM mode (~188, ~222).
    exports.zxnextSetPsgRegisterIndex(0x11);
    exports.zxnextWritePsgRegisterValue(0xa5);

    expect(exports.zxnextGetPsgSelectedRegister()).toBe(0x11);
    expect(exports.zxnextGetPsgRegister(0, 1), "register 1 untouched").toBe(0);
    expect(exports.zxnextReadPsgRegisterValue()).toBe(0xff);
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
    // --- R13 = $0F attacks: the level rises (the getter returns the 5-bit envelope level)
    expect(exports.zxnextGetPsgEnvelopeStep(0)).toBeGreaterThan(envBefore);
    expect(exports.zxnextGetPsgStereoLeft(0)).toBeGreaterThan(0);
    expect(exports.zxnextGetPsgStereoRight(0)).toBeGreaterThan(0);
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
