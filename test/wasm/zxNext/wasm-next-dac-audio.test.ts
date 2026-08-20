import { describe, expect, it } from "vitest";

import { DacDevice } from "@emu/machines/zxNext/DacDevice";
import { DacNextRegDevice } from "@emu/machines/zxNext/DacNextRegDevice";
import { DacPortDevice } from "@emu/machines/zxNext/DacPortDevice";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM DAC audio", () => {
  it("matches TypeScript NextReg and port DAC routing", async () => {
    const dac = new DacDevice();
    const nextReg = new DacNextRegDevice(dac);
    const ports = new DacPortDevice(dac);
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    nextReg.writeNextReg(0x2c, 0x11);
    exports.zxnextSetNextRegisterDirect(0x2c, 0x11);
    nextReg.writeNextReg(0x2d, 0x22);
    exports.zxnextSetNextRegisterDirect(0x2d, 0x22);
    nextReg.writeNextReg(0x2e, 0x33);
    exports.zxnextSetNextRegisterDirect(0x2e, 0x33);
    ports.writePort(0x00b3, 0x44);
    exports.zxnextWritePort(0x00b3, 0x44);
    ports.writePort(0x005f, 0x55);
    exports.zxnextWritePort(0x005f, 0x55);

    expect([0, 1, 2, 3].map(i => exports.zxnextGetDacChannel(i))).toEqual(dac.getChannelValues());
    expect(exports.zxnextGetDacStereoLeft()).toBe(dac.getStereoOutput().left);
    expect(exports.zxnextGetDacStereoRight()).toBe(dac.getStereoOutput().right);
  });
});
