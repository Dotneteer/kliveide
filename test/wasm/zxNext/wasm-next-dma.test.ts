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
});
