import { describe, expect, it } from "vitest";
import { DmaMode } from "@emu/machines/zxNext/DmaDevice";
import { TestZxNextMachine } from "../../zxnext/TestNextMachine";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM DMA device", () => {
  it("matches TypeScript DMA register writes, mode selection, load status, and read-mask sequence", async () => {
    const oracle = new TestZxNextMachine().dmaDevice;
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    const write = (value: number): void => {
      oracle.writePort(value);
      exports.zxnextDmaWritePort(value);
    };

    oracle.setDmaMode(DmaMode.LEGACY);
    exports.zxnextDmaSetMode(DmaMode.LEGACY);
    write(0x7c);
    write(0x34);
    write(0x12);
    write(0x78);
    write(0x56);
    write(0x8d);
    write(0xbc);
    write(0x9a);
    write(0xcf);
    write(0xbb);
    write(0x79);
    write(0xa7);

    const registers = oracle.getRegisters();
    const transfer = oracle.getTransferState();
    expect(exports.zxnextGetDmaMode()).toBe(oracle.getDmaMode());
    expect(exports.zxnextGetDmaPortAStartAddress()).toBe(registers.portAStartAddress);
    expect(exports.zxnextGetDmaPortBStartAddress()).toBe(registers.portBStartAddress);
    expect(exports.zxnextGetDmaBlockLength()).toBe(registers.blockLength);
    expect(exports.zxnextGetDmaByteCounter()).toBe(transfer.byteCounter);
    expect(exports.zxnextDmaReadStatusByte()).toBe(oracle.readStatusByte());
  });

  it("executes memory-to-memory transfers with incrementing source and destination addresses", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    const source = [0x11, 0x22, 0x33, 0x44];
    source.forEach((value, index) => wasm.doWriteMemory(0x8000 + index, value));

    configureDmaTransfer(exports, {
      directionAtoB: true,
      portAAddress: 0x8000,
      portBAddress: 0x9000,
      blockLength: source.length,
      portAConfig: 0x14,
      portBConfig: 0x10
    });

    expect(exports.zxnextDmaExecuteTransfer(16)).toBe(source.length);
    expect(Array.from({ length: source.length }, (_, index) => wasm.doReadMemory(0x9000 + index))).toEqual(source);
    expect(exports.zxnextGetDmaTransferredBytes()).toBe(source.length);
    expect(exports.zxnextGetDmaByteCounter()).toBe(source.length);
    expect(exports.zxnextGetDmaDirectionAtoB()).toBe(1);
    expect(exports.zxnextGetDmaPortAStartAddress()).toBe(0x8000 + source.length);
    expect(exports.zxnextGetDmaPortBStartAddress()).toBe(0x9000 + source.length);
  });

  it("executes memory-to-I/O transfers through the normal port layer", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    wasm.doWriteMemory(0x8100, 0x2a);
    wasm.doWriteMemory(0x8101, 0x5b);

    configureDmaTransfer(exports, {
      directionAtoB: true,
      portAAddress: 0x8100,
      portBAddress: 0x243b,
      blockLength: 2,
      portAConfig: 0x14,
      portBConfig: 0x28
    });

    expect(exports.zxnextDmaExecuteTransfer(8)).toBe(2);
    expect(exports.zxnextGetNextRegisterIndex()).toBe(0x5b);
    expect(exports.zxnextGetLastPortAddress()).toBe(0x243b);
    expect(exports.zxnextGetLastPortValue()).toBe(0x5b);
    expect(exports.zxnextGetLastPortIsWrite()).toBe(1);
    expect(exports.zxnextGetDmaPortBStartAddress()).toBe(0x243b);
  });

  it("executes I/O-to-memory transfers through the normal port layer", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    exports.zxnextWritePort(0x243b, 0x6c);

    configureDmaTransfer(exports, {
      directionAtoB: false,
      portAAddress: 0x9200,
      portBAddress: 0x243b,
      blockLength: 3,
      portAConfig: 0x14,
      portBConfig: 0x28
    });

    expect(exports.zxnextDmaExecuteTransfer(8)).toBe(3);
    expect(Array.from({ length: 3 }, (_, index) => wasm.doReadMemory(0x9200 + index))).toEqual([0x6c, 0x6c, 0x6c]);
    expect(exports.zxnextGetDmaDirectionAtoB()).toBe(0);
    expect(exports.zxnextGetDmaTransferredBytes()).toBe(3);
    expect(exports.zxnextGetDmaPortAStartAddress()).toBe(0x9203);
    expect(exports.zxnextGetDmaPortBStartAddress()).toBe(0x243b);
  });
});

type DmaTransferConfig = {
  directionAtoB: boolean;
  portAAddress: number;
  portBAddress: number;
  blockLength: number;
  portAConfig: number;
  portBConfig: number;
};

function configureDmaTransfer(exports: any, config: DmaTransferConfig): void {
  exports.zxnextDmaSetMode(DmaMode.ZXNDMA);
  exports.zxnextDmaWritePort(config.directionAtoB ? 0x7d : 0x79);
  exports.zxnextDmaWritePort(config.portAAddress & 0xff);
  exports.zxnextDmaWritePort((config.portAAddress >> 8) & 0xff);
  exports.zxnextDmaWritePort(config.blockLength & 0xff);
  exports.zxnextDmaWritePort((config.blockLength >> 8) & 0xff);
  exports.zxnextDmaWritePort(config.portAConfig);
  exports.zxnextDmaWritePort(config.portBConfig);
  exports.zxnextDmaWritePort(0xad);
  exports.zxnextDmaWritePort(config.portBAddress & 0xff);
  exports.zxnextDmaWritePort((config.portBAddress >> 8) & 0xff);
  exports.zxnextDmaWritePort(0xcf);
  exports.zxnextDmaWritePort(0x87);
}
