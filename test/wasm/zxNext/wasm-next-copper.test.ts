import { describe, expect, it } from "vitest";

import { createTestNextMachine } from "../../zxnext/TestNextMachine";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM advanced video copper", () => {
  it("matches instruction memory, control state, WAIT, and MOVE output", async () => {
    const oracle = await createTestNextMachine();
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    const copper = oracle.copperDevice;
    const write = (reg: number, value: number): void => {
      oracle.nextRegDevice.directSetRegValue(reg, value);
      exports.zxnextSetNextRegisterDirect(reg, value);
    };

    write(0x61, 0x00);
    write(0x60, 0x80);
    write(0x60, 0x05);
    write(0x60, 0x12);
    write(0x60, 0x34);
    write(0x62, 0x40);

    expect(exports.zxnextCopperRead(0)).toBe(copper.readMemory(0));
    expect(exports.zxnextCopperRead(1)).toBe(copper.readMemory(1));
    expect(exports.zxnextCopperRead(2)).toBe(copper.readMemory(2));
    expect(exports.zxnextCopperRead(3)).toBe(copper.readMemory(3));
    expect(exports.zxnextGetCopperStartMode()).toBe(copper.startMode);
    expect(exports.zxnextGetCopperInstructionAddress()).toBe(copper.instructionAddress);

    copper.executeTick(5, 11);
    exports.zxnextCopperTick(5, 11, oracle.composedScreenDevice.config.totalVC);
    expect(exports.zxnextGetCopperListAddress()).toBe((copper as any)._copperListAddr);

    copper.executeTick(5, 12);
    exports.zxnextCopperTick(5, 12, oracle.composedScreenDevice.config.totalVC);
    expect(exports.zxnextGetCopperListAddress()).toBe((copper as any)._copperListAddr);

    copper.executeTick(5, 13);
    exports.zxnextCopperTick(5, 13, oracle.composedScreenDevice.config.totalVC);
    expect(exports.zxnextGetCopperDout()).toBe((copper as any)._copperDout ? 1 : 0);
    expect(exports.zxnextGetCopperListData()).toBe((copper as any)._copperListData);

    copper.executeTick(5, 14);
    exports.zxnextCopperTick(5, 14, oracle.composedScreenDevice.config.totalVC);
    expect(exports.zxnextGetNextRegisterDirect(0x12)).toBe(0x34);
  });
});
