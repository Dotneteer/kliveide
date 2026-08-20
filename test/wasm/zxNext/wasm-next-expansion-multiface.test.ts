import { describe, expect, it } from "vitest";
import { createTestNextMachine } from "../../zxnext/TestNextMachine";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM expansion bus and multiface-adjacent state", () => {
  it("matches TypeScript expansion NextReg, port enable, propagation, and signal behavior", async () => {
    const oracle = await createTestNextMachine();
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    oracle.expansionBusDevice.nextReg80Value = 0x90;
    oracle.expansionBusDevice.nextReg81Value = 0x70;
    oracle.expansionBusDevice.setBusPortEnable(1, 0x3c);
    oracle.expansionBusDevice.ioPropagate = 0x12;
    oracle.expansionBusDevice.romcsSignal = true;
    oracle.expansionBusDevice.expansionBusNmiPending = true;
    oracle.expansionBusDevice.expansionBusIntPending = true;
    oracle.interruptDevice.expBusInterruptEnabled = true;

    exports.zxnextExpansionSetNextReg(0x80, 0x90);
    exports.zxnextExpansionSetNextReg(0x81, 0x70);
    exports.zxnextExpansionSetNextReg(0x87, 0x3c);
    exports.zxnextExpansionSetNextReg(0x8a, 0x12);
    exports.zxnextExpansionSetSignals(1, 0, 1, 1);

    expect(exports.zxnextExpansionGetNextReg(0x80)).toBe(oracle.expansionBusDevice.nextReg80Value);
    expect(exports.zxnextExpansionGetNextReg(0x81)).toBe(oracle.expansionBusDevice.nextReg81Value);
    expect(exports.zxnextExpansionEffectivePortEnable(0xf0, 1)).toBe(oracle.expansionBusDevice.effectivePortEnable(0xf0, 1));
    expect(Boolean(exports.zxnextExpansionShouldPropagateIo(4))).toBe(oracle.expansionBusDevice.shouldPropagateIo(4));
    expect(Boolean(exports.zxnextExpansionIsRomcsClaimed())).toBe(oracle.expansionBusDevice.isRomcsClaimed);
    expect(Boolean(exports.zxnextExpansionIsNmiAsserted())).toBe(oracle.expansionBusDevice.isNmiAsserted);
    expect(Boolean(exports.zxnextExpansionIsIntActive(1))).toBe(oracle.expansionBusDevice.isIntActive);
    expect(Boolean(exports.zxnextExpansionIsUlaOverride(0x00fe))).toBe(oracle.expansionBusDevice.isUlaOverride(0x00fe));
  });

  it("keeps multiface host ROM/UI/media ownership outside WASM while expansion control remains mirrored", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    exports.zxnextSetNextRegisterDirect(0x80, 0xc3);
    expect(exports.zxnextGetNextRegisterDirect(0x80)).toBe(0xc3);
    expect(exports.zxnextExpansionGetNextReg(0x80)).toBe(0xc3);
  });
});
