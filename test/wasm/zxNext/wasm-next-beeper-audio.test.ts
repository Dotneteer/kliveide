import { describe, expect, it } from "vitest";

import { SpectrumBeeperDevice } from "@emu/machines/BeeperDevice";
import { createTestZxNextWasmMachine, createZxNextOracleHarness } from "./wasm-next-test-helpers";

describe("ZX Next WASM beeper audio", () => {
  it("matches TypeScript EAR/MIC transitions and weighted samples", async () => {
    const machine = { machineId: "zxnext", tacts: 0, setTacts(value: number) { this.tacts = value; } };
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

  it("keeps beeper EAR/MIC state in sync with TypeScript ULA port writes", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;

    oracle.doWritePort(0x00fe, 0x18);
    wasm.doWritePort(0x00fe, 0x18);

    expect(exports.zxnextGetBeeperEar()).toBe(oracle.beeperDevice.earBit ? 1 : 0);
    expect(exports.zxnextGetBeeperMic()).toBe(1);
    expect(exports.zxnextGetBeeperOutputLevelMilli()).toBe(Math.floor(oracle.beeperDevice.outputLevel * 1000));

    oracle.doWritePort(0x00fe, 0x00);
    wasm.doWritePort(0x00fe, 0x00);

    expect(exports.zxnextGetBeeperEar()).toBe(oracle.beeperDevice.earBit ? 1 : 0);
    expect(exports.zxnextGetBeeperMic()).toBe(0);
    expect(exports.zxnextGetBeeperOutputLevelMilli()).toBe(Math.floor(oracle.beeperDevice.outputLevel * 1000));
  });
});
