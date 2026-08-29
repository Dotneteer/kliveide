import { describe, expect, it } from "vitest";
import { UartDevice } from "@emu/machines/zxNext/UartDevice";
import { I2cDevice } from "@emu/machines/zxNext/I2cDevice";
import { createTestNextMachine } from "../../zxnext/TestNextMachine";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM UART and I2C devices", () => {
  it("matches TypeScript UART port status, FIFO, selection, prescaler, and frame behavior", async () => {
    const machine = await createTestNextMachine();
    const oracle = new UartDevice(machine);
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    oracle.pushRxByte(0, 0x42, true);
    exports.zxnextUartPushRxByte(0, 0x42, 1);
    oracle.writeTxPort(0x99);
    exports.zxnextWritePort(0x133b, 0x99);

    expect(exports.zxnextReadPort(0x133b)).toBe(oracle.readTxPort());
    expect(exports.zxnextReadPort(0x143b)).toBe(oracle.readRxPort());
    expect(exports.zxnextUartPopTxByte(0)).toBe(oracle.popTxByte(0));

    oracle.writeRxPort(0x34);
    oracle.writeRxPort(0x81);
    oracle.writeSelectPort(0x15);
    exports.zxnextWritePort(0x143b, 0x34);
    exports.zxnextWritePort(0x143b, 0x81);
    exports.zxnextWritePort(0x153b, 0x15);
    expect(exports.zxnextGetUartPrescaler(0)).toBe(oracle.channels[0].prescaler);

    oracle.writeSelectPort(0x40);
    exports.zxnextWritePort(0x153b, 0x40);
    oracle.writeFramePort(0x92);
    exports.zxnextWritePort(0x163b, 0x92);
    expect(exports.zxnextGetUartSelected()).toBe(oracle.selectedUart);
    expect(exports.zxnextGetUartFrameRegister(1)).toBe(oracle.channels[1].frameRegister);
  });

  it("matches TypeScript I2C SCL/SDA open-drain port reads while host clock remains TypeScript-owned", async () => {
    const machine = await createTestNextMachine();
    const oracle = new I2cDevice(machine);
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    oracle.writeSclPort(0);
    exports.zxnextWritePort(0x103b, 0);
    oracle.writeSdaPort(0);
    exports.zxnextWritePort(0x113b, 0);
    expect(exports.zxnextReadPort(0x103b)).toBe(oracle.readSclPort());
    expect(exports.zxnextReadPort(0x113b)).toBe(oracle.readSdaPort());

    oracle.writeSclPort(1);
    exports.zxnextWritePort(0x103b, 1);
    oracle.writeSdaPort(1);
    exports.zxnextWritePort(0x113b, 1);
    expect(exports.zxnextI2cReadSclPort()).toBe(oracle.readSclPort());
    expect(exports.zxnextI2cReadSdaPort()).toBe(oracle.readSdaPort());
  });
});
