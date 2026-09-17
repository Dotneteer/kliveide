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
    // --- MAME (and DmaDevice.ts) leave the counter one past the block length.
    expect(exports.zxnextGetDmaByteCounter()).toBe(source.length + 1);
    expect(exports.zxnextGetDmaDirectionAtoB()).toBe(1);
    // --- The running addresses advance; the programmed start addresses stay as written.
    expect(exports.zxnextGetDmaAddressA()).toBe(0x8000 + source.length);
    expect(exports.zxnextGetDmaAddressB()).toBe(0x9000 + source.length);
    expect(exports.zxnextGetDmaPortAStartAddress()).toBe(0x8000);
    expect(exports.zxnextGetDmaPortBStartAddress()).toBe(0x9000);
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
    expect(exports.zxnextGetDmaAddressA()).toBe(0x9203);
    expect(exports.zxnextGetDmaAddressB()).toBe(0x243b);
  });

  it("matches TypeScript for RESET, command bytes, and read sequence restarts", async () => {
    const oracle = new TestZxNextMachine().dmaDevice;
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    const write = (value: number): void => {
      oracle.writePort(value);
      exports.zxnextDmaWritePort(value);
    };
    const readBoth = (): void => {
      expect(exports.zxnextDmaReadStatusByte()).toBe(oracle.readStatusByte());
    };
    oracle.setDmaMode(DmaMode.ZXNDMA);
    exports.zxnextDmaSetMode(DmaMode.ZXNDMA);

    for (const value of [0xc3, 0xc3, 0x7d, 0x34, 0x12, 0x03, 0x00, 0xad, 0x78, 0x56, 0xcf]) write(value);
    write(0xbb);
    write(0x7f);
    for (let i = 0; i < 3; i++) readBoth();
    write(0xa7); // INITIALIZE_READ_SEQUENCE: back to the status byte
    for (let i = 0; i < 9; i++) readBoth();
    write(0xbf); // READ_STATUS_BYTE: status only, forever
    for (let i = 0; i < 3; i++) readBoth();
    for (const value of [0xd3, 0xab, 0xa3, 0x8b, 0xc7, 0xcb, 0xb3, 0x83]) {
      write(value);
      expect(exports.zxnextGetDmaStatus()).toBe(oracle.getStatus());
      expect(exports.zxnextGetDmaCount()).toBe(oracle.getMameCount());
      expect(exports.zxnextGetDmaByteCounter()).toBe(oracle.getTransferState().byteCounter);
      expect(exports.zxnextGetDmaRawRegister(24)).toBe(oracle.getRawReg(3, 0));
    }
  });

  /*
   * Follow bytes after WR1..WR4 that a program can send and the transfer must not mistake for new
   * commands. Real programs send them: ScrollNutter's DmaCopy (`$54 $01 $50 $01`, timing bytes) used
   * to have its `$01` read as a WR0 base byte, which cleared the direction bit and turned a copy from
   * $C000 to $4000 into one from $4000 to $C000.
   */
  it("runs ScrollNutter's DmaCopy program: WR1/WR2 timing bytes do not flip the direction", async () => {
    const oracle = new TestZxNextMachine().dmaDevice;
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    const source = [0x11, 0x22, 0x33, 0x44, 0x55];
    source.forEach((value, index) => wasm.doWriteMemory(0x8000 + index, value));

    oracle.setDmaMode(DmaMode.ZXNDMA);
    exports.zxnextDmaSetMode(DmaMode.ZXNDMA);
    // --- The program at $9071, with DmaSource = $8000, DmaLength = 5, DmaDest = $9000.
    const program = [
      0x83, 0x7d, 0x00, 0x80, 0x05, 0x00, 0x54, 0x01, 0x50, 0x01, 0xad, 0x00, 0x90, 0x82, 0xcf, 0x87
    ];
    for (const value of program) {
      oracle.writePort(value);
      exports.zxnextDmaWritePort(value);
    }

    const registers = oracle.getRegisters();
    expect(registers.directionAtoB).toBe(true);
    expect(exports.zxnextGetDmaDirectionAtoB()).toBe(1);
    expect(exports.zxnextGetDmaPortAStartAddress()).toBe(registers.portAStartAddress);
    expect(exports.zxnextGetDmaPortBStartAddress()).toBe(registers.portBStartAddress);
    expect(exports.zxnextGetDmaBlockLength()).toBe(registers.blockLength);
    expect(exports.zxnextGetDmaPortAConfig()).toBe(0x54);
    expect(exports.zxnextGetDmaPortBConfig()).toBe(0x50);
    expect(exports.zxnextGetDmaEnabled()).toBe(1);

    expect(exports.zxnextDmaExecuteTransfer(16)).toBe(source.length);
    expect(Array.from({ length: source.length }, (_, i) => wasm.doReadMemory(0x9000 + i))).toEqual(source);
    // --- ...and the source is left alone, rather than overwritten from the destination.
    expect(Array.from({ length: source.length }, (_, i) => wasm.doReadMemory(0x8000 + i))).toEqual(source);
  });

  it("runs a memory-to-I/O program whose WR2 has a timing byte and a fixed I/O port", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    wasm.doWriteMemory(0x8100, 0x2a);
    wasm.doWriteMemory(0x8101, 0x5b);

    exports.zxnextDmaSetMode(DmaMode.ZXNDMA);
    // --- The shape of ScrollNutter's DmaNextRegProg: `$54 $02 $68 $02`, port B = $243B.
    for (const value of [
      0x83, 0x7d, 0x00, 0x81, 0x02, 0x00, 0x54, 0x02, 0x68, 0x02, 0xad, 0x3b, 0x24, 0x82, 0xcf, 0x87
    ]) {
      exports.zxnextDmaWritePort(value);
    }

    expect(exports.zxnextGetDmaDirectionAtoB()).toBe(1);
    expect(exports.zxnextGetDmaPortBConfig()).toBe(0x68);
    expect(exports.zxnextDmaExecuteTransfer(8)).toBe(2);
    expect(exports.zxnextGetNextRegisterIndex()).toBe(0x5b);
    expect(exports.zxnextGetDmaPortBStartAddress()).toBe(0x243b);
  });

  it("consumes the zxnDMA prescaler byte that WR2's timing byte announces with D5", async () => {
    const oracle = new TestZxNextMachine().dmaDevice;
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    oracle.setDmaMode(DmaMode.ZXNDMA);
    exports.zxnextDmaSetMode(DmaMode.ZXNDMA);

    // --- WR2 + timing ($22: D5 set) + prescaler ($7f, which would otherwise be a WR0 base byte
    // --- announcing four follow bytes), then WR4 with port B = $1234.
    for (const value of [0x7d, 0x00, 0x80, 0x01, 0x00, 0x50, 0x22, 0x7f, 0xad, 0x34, 0x12]) {
      oracle.writePort(value);
      exports.zxnextDmaWritePort(value);
    }

    const registers = oracle.getRegisters();
    expect(registers.portBPrescalar).toBe(0x7f);
    expect(exports.zxnextGetDmaPortBStartAddress()).toBe(0x1234);
    expect(exports.zxnextGetDmaPortBStartAddress()).toBe(registers.portBStartAddress);
    expect(exports.zxnextGetDmaPortAStartAddress()).toBe(registers.portAStartAddress);
    expect(exports.zxnextGetDmaBlockLength()).toBe(registers.blockLength);
    expect(exports.zxnextGetDmaDirectionAtoB()).toBe(1);
  });

  it("consumes WR3 mask/match bytes and WR4 interrupt control, pulse and vector bytes", async () => {
    const oracle = new TestZxNextMachine().dmaDevice;
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    oracle.setDmaMode(DmaMode.ZXNDMA);
    exports.zxnextDmaSetMode(DmaMode.ZXNDMA);

    for (const value of [
      0x7d, 0x00, 0x80, 0x03, 0x00,
      // --- WR3 with mask ($1c) and match ($79) bytes: both would otherwise be base bytes.
      0x98, 0x1c, 0x79,
      // --- WR4: port B $4321, interrupt control $18 announcing pulse ($3d) and vector ($7e).
      0xbd, 0x21, 0x43, 0x18, 0x3d, 0x7e,
      // --- A WR1 afterwards must still be read as WR1.
      0x14
    ]) {
      oracle.writePort(value);
      exports.zxnextDmaWritePort(value);
    }

    const registers = oracle.getRegisters();
    expect(exports.zxnextGetDmaPortAStartAddress()).toBe(registers.portAStartAddress);
    expect(exports.zxnextGetDmaPortBStartAddress()).toBe(0x4321);
    expect(exports.zxnextGetDmaPortBStartAddress()).toBe(registers.portBStartAddress);
    expect(exports.zxnextGetDmaBlockLength()).toBe(registers.blockLength);
    expect(exports.zxnextGetDmaDirectionAtoB()).toBe(1);
    expect(exports.zxnextGetDmaPortAConfig()).toBe(0x14);
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
