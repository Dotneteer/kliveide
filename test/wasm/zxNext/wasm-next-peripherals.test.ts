import { describe, expect, it } from "vitest";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

const DS1307_ADDR = 0x68;

class WasmI2cDriver {
  constructor(private readonly machine: Awaited<ReturnType<typeof createTestZxNextWasmMachine>>) {}

  start(): void {
    this.writeSda(1);
    this.writeScl(1);
    this.writeSda(0);
    this.writeScl(0);
  }

  stop(): void {
    this.writeSda(0);
    this.writeScl(1);
    this.writeSda(1);
  }

  writeBit(bit: boolean): void {
    this.writeSda(bit ? 1 : 0);
    this.writeScl(1);
    this.writeScl(0);
  }

  readBit(): boolean {
    this.writeSda(1);
    this.writeScl(1);
    const value = this.machine.doReadPort(0x113b) & 0x01;
    this.writeScl(0);
    return value !== 0;
  }

  writeByte(value: number): boolean {
    for (let bit = 7; bit >= 0; bit--) {
      this.writeBit((value & (1 << bit)) !== 0);
    }
    return !this.readBit();
  }

  readByte(ack: boolean): number {
    let value = 0;
    for (let bit = 7; bit >= 0; bit--) {
      if (this.readBit()) value |= 1 << bit;
    }
    this.writeBit(!ack);
    return value;
  }

  address(addr: number, read: boolean): boolean {
    return this.writeByte((addr << 1) | (read ? 1 : 0));
  }

  private writeScl(value: number): void {
    this.machine.doWritePort(0x103b, value);
  }

  private writeSda(value: number): void {
    this.machine.doWritePort(0x113b, value);
  }
}

describe("ZX Spectrum Next WASM v2 UART and I2C peripherals", () => {
  it("decodes UART defaults, select, prescaler, frame, TX, RX, and status ports", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    expect(machine.doReadPort(0x133b)).toBe(0x10);
    expect(machine.doReadPort(0x153b)).toBe(0x00);
    expect(machine.doReadPort(0x163b)).toBe(0x18);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      uartSelected: 0,
      uart0Prescaler: 243,
      uart1Prescaler: 243,
      uart0FrameRegister: 0x18,
      uart1FrameRegister: 0x18,
      uart0RxCount: 0,
      uart0TxCount: 0
    });

    machine.doWritePort(0x143b, 0x33);
    machine.doWritePort(0x143b, 0x80 | 0x22);
    machine.doWritePort(0x153b, 0x53);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      uartSelected: 1,
      uart0Prescaler: (3 << 14) | (0x22 << 7) | 0x33,
      uart1Prescaler: 243
    });

    machine.doWritePort(0x163b, 0x3b);
    machine.doWritePort(0x133b, 0xbb);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      uart1FrameRegister: 0x3b,
      uart1TxCount: 1
    });
    expect(wasm.zxnextPopUartTxByte(1)).toBe(0xbb);
    expect(wasm.zxnextPopUartTxByte(1)).toBe(-1);

    wasm.zxnextPushUartRxByte(1, 0xab, 1);
    expect(machine.doReadPort(0x133b) & 0x21).toBe(0x21);
    expect(machine.doReadPort(0x143b)).toBe(0xab);
    expect(machine.doReadPort(0x143b)).toBe(0x00);
  });

  it("handles UART selected-channel independence, frame reset, and per-frame TX drain", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.doWritePort(0x133b, 0x11);
    machine.doWritePort(0x133b, 0x22);
    machine.doWritePort(0x153b, 0x40);
    machine.doWritePort(0x133b, 0x33);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      uart0TxCount: 2,
      uart1TxCount: 1
    });

    wasm.zxnextUartOnNewFrame();
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      uart0TxCount: 0,
      uart1TxCount: 0
    });

    wasm.zxnextPushUartRxByte(0, 0xaa, 0);
    wasm.zxnextPushUartRxByte(1, 0xbb, 0);
    machine.doWritePort(0x163b, 0x80);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      uart0RxCount: 1,
      uart1RxCount: 0,
      uart1FrameRegister: 0x00
    });
  });

  it("gates UART and I2C ports through NR $83 bit 4 and bit 2", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.nextRegDevice.directSetRegValue(0x83, 0xef);
    machine.doWritePort(0x133b, 0xaa);
    expect(machine.doReadPort(0x133b)).toBe(0xff);
    expect(machine.getWasmV2Diagnostics().uart0TxCount).toBe(0);

    machine.nextRegDevice.directSetRegValue(0x83, 0xfb);
    machine.doWritePort(0x103b, 0x00);
    machine.doWritePort(0x113b, 0x00);
    expect(machine.doReadPort(0x103b)).toBe(0xff);
    expect(machine.doReadPort(0x113b)).toBe(0xff);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      i2cSclOut: true,
      i2cSdaOut: true
    });
  });

  it("decodes I2C SCL/SDA line ports and DS1307 address ACK/NACK", async () => {
    const machine = await createTestZxNextWasmMachine();
    const drv = new WasmI2cDriver(machine);

    expect(machine.doReadPort(0x103b)).toBe(0xff);
    expect(machine.doReadPort(0x113b)).toBe(0xff);
    machine.doWritePort(0x103b, 0xfe);
    machine.doWritePort(0x113b, 0xfe);
    expect(machine.doReadPort(0x103b)).toBe(0xfe);
    expect(machine.doReadPort(0x113b)).toBe(0xfe);

    drv.start();
    expect(machine.getWasmV2Diagnostics().i2cState).toBe(1);
    expect(drv.address(DS1307_ADDR, false)).toBe(true);
    drv.stop();
    expect(machine.getWasmV2Diagnostics().i2cState).toBe(0);

    drv.start();
    expect(drv.address(0x50, false)).toBe(false);
    expect(machine.getWasmV2Diagnostics().i2cState).toBe(0);
  });

  it("reads and writes DS1307 CMOS through I2C with pointer auto-increment", async () => {
    const machine = await createTestZxNextWasmMachine();
    const drv = new WasmI2cDriver(machine);

    drv.start();
    expect(drv.address(DS1307_ADDR, false)).toBe(true);
    expect(drv.writeByte(0x08)).toBe(true);
    expect(drv.writeByte(0xca)).toBe(true);
    expect(drv.writeByte(0xfe)).toBe(true);
    drv.stop();

    expect(machine.wasmV2Runtime!.exports.zxnextGetI2cCmosByte(0x08)).toBe(0xca);
    expect(machine.wasmV2Runtime!.exports.zxnextGetI2cCmosByte(0x09)).toBe(0xfe);
    expect(machine.getWasmV2Diagnostics().i2cRegPointer).toBe(0x0a);

    drv.start();
    drv.address(DS1307_ADDR, false);
    drv.writeByte(0x08);
    drv.stop();

    drv.start();
    drv.address(DS1307_ADDR, true);
    expect(drv.readByte(true)).toBe(0xca);
    expect(drv.readByte(false)).toBe(0xfe);
    drv.stop();
  });

  it("advances the DS1307 clock explicitly and from per-frame ticks", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    wasm.zxnextSetI2cCmosByte(0x00, 0x59);
    wasm.zxnextSetI2cCmosByte(0x01, 0x59);
    wasm.zxnextSetI2cCmosByte(0x02, 0x23);
    wasm.zxnextSetI2cCmosByte(0x03, 0x07);
    wasm.zxnextSetI2cCmosByte(0x04, 0x31);
    wasm.zxnextSetI2cCmosByte(0x05, 0x12);
    wasm.zxnextSetI2cCmosByte(0x06, 0x25);

    wasm.zxnextAdvanceI2cClock();
    expect(wasm.zxnextGetI2cCmosByte(0x00)).toBe(0x00);
    expect(wasm.zxnextGetI2cCmosByte(0x01)).toBe(0x00);
    expect(wasm.zxnextGetI2cCmosByte(0x02)).toBe(0x00);
    expect(wasm.zxnextGetI2cCmosByte(0x03)).toBe(0x01);
    expect(wasm.zxnextGetI2cCmosByte(0x04)).toBe(0x01);
    expect(wasm.zxnextGetI2cCmosByte(0x05)).toBe(0x01);
    expect(wasm.zxnextGetI2cCmosByte(0x06)).toBe(0x26);

    wasm.zxnextSetI2cFrameRate(2);
    wasm.zxnextI2cOnNewFrame();
    expect(machine.getWasmV2Diagnostics().i2cFrameCounter).toBe(1);
    wasm.zxnextI2cOnNewFrame();
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      i2cFrameCounter: 0,
      i2cClockAdvanceCount: 2
    });
  });
});
