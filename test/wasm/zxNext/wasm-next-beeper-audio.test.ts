import { describe, expect, it } from "vitest";

import { SpectrumBeeperDevice } from "@emu/machines/BeeperDevice";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM beeper audio", () => {
  it("matches TypeScript EAR/MIC transitions and weighted samples", async () => {
    const machine = { tacts: 0, setTacts(value: number) { this.tacts = value; } };
    const oracle = new SpectrumBeeperDevice(machine as any);
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    machine.setTacts(10);
    wasm.setTacts(10);
    oracle.setOutputLevel(true, false);
    exports.zxnextSetBeeperOutput(1, 0);

    machine.setTacts(30);
    wasm.setTacts(30);
    oracle.setOutputLevel(true, true);
    exports.zxnextSetBeeperOutput(1, 1);

    machine.setTacts(50);
    wasm.setTacts(50);
    const sample = oracle.getCurrentSampleValue();

    expect(exports.zxnextGetBeeperEar()).toBe(1);
    expect(exports.zxnextGetBeeperMic()).toBe(1);
    expect(exports.zxnextGetBeeperOutputLevelMilli()).toBe(1000);
    expect(exports.zxnextGetBeeperSampleLeftMilli()).toBe(Math.floor(sample.left * 1000));
    expect(exports.zxnextGetBeeperSampleRightMilli()).toBe(Math.floor(sample.right * 1000));
  });
});
