import { describe, expect, it } from "vitest";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Spectrum Next WASM v2 DMA", () => {
  it("parses MAME-style follow bytes for WR0, WR1, WR2, WR4, and WR6", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    writeZxnDma(machine, 0x7d, 0x34, 0x12, 0x04, 0x00);
    writeZxnDma(machine, 0x14);
    writeZxnDma(machine, 0x68, 0x23, 0x09);
    writeZxnDma(machine, 0xad, 0x78, 0x56);
    writeZxnDma(machine, 0xbb, 0x7f);

    expect(wasm.zxnextGetDmaRawReg(0, 0)).toBe(0x7d);
    expect(wasm.zxnextGetDmaRawReg(0, 1)).toBe(0x34);
    expect(wasm.zxnextGetDmaRawReg(0, 2)).toBe(0x12);
    expect(wasm.zxnextGetDmaRawReg(0, 3)).toBe(0x04);
    expect(wasm.zxnextGetDmaRawReg(0, 4)).toBe(0x00);
    expect(wasm.zxnextGetDmaRawReg(1, 0)).toBe(0x14);
    expect(wasm.zxnextGetDmaRawReg(2, 0)).toBe(0x68);
    expect(wasm.zxnextGetDmaRawReg(2, 1)).toBe(0x23);
    expect(wasm.zxnextGetDmaRawReg(2, 2)).toBe(0x09);
    expect(wasm.zxnextGetDmaRawReg(4, 0)).toBe(0xad);
    expect(wasm.zxnextGetDmaRawReg(4, 1)).toBe(0x78);
    expect(wasm.zxnextGetDmaRawReg(4, 2)).toBe(0x56);
    expect(wasm.zxnextGetDmaRawReg(6, 1)).toBe(0x7f);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      dmaPortAStart: 0x1234,
      dmaPortBStart: 0x5678,
      dmaBlockLength: 4,
      dmaDirectionAtoB: true,
      dmaPortAAddressMode: 1,
      dmaPortBAddressMode: 2,
      dmaTransferMode: 1,
      dmaPortBPrescaler: 0x09
    });
  });

  it("loads addresses and exposes read-mask status sequences", async () => {
    const machine = await createTestZxNextWasmMachine();

    configureMemoryToMemory(machine, 0x8123, 0x9234, 3);
    writeZxnDma(machine, 0xcf);
    writeZxnDma(machine, 0xbb, 0x78);
    writeZxnDma(machine, 0xa7);

    expect(readZxnDma(machine)).toBe(0x23);
    expect(readZxnDma(machine)).toBe(0x81);
    expect(readZxnDma(machine)).toBe(0x34);
    expect(readZxnDma(machine)).toBe(0x92);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      dmaAddressA: 0x8123,
      dmaAddressB: 0x9234,
      dmaStatus: 0x30
    });
  });

  it("transfers memory to memory through C-owned memory", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;
    const bytes = [0x11, 0x22, 0x33, 0x44];

    bytes.forEach((value, index) => machine.writeTestMemory(0x8000 + index, value));
    configureMemoryToMemory(machine, 0x8000, 0x9000, bytes.length);
    writeZxnDma(machine, 0xcf);
    writeZxnDma(machine, 0x87);

    expect(wasm.zxnextRunDma(0)).toBe(bytes.length);
    bytes.forEach((value, index) => expect(machine.readTestMemory(0x9000 + index)).toBe(value));
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      dmaEnabled: true,
      dmaSeq: 0,
      dmaBusRequested: false,
      dmaTransferCount: bytes.length,
      dmaBlockCompletionCount: 1,
      dmaStatus: 0x19
    });
  });

  it("steps bus request and acknowledgement before the first byte", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.writeTestMemory(0x8200, 0x5a);
    configureMemoryToMemory(machine, 0x8200, 0x9200, 1);
    writeZxnDma(machine, 0xcf);
    writeZxnDma(machine, 0x87);

    expect(wasm.zxnextStepDma()).toBe(0);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      dmaSeq: 3,
      dmaBusRequested: true,
      dmaBusAcknowledged: false
    });

    wasm.zxnextAcknowledgeDmaBus();
    expect(wasm.zxnextStepDma()).toBe(6);
    expect(machine.readTestMemory(0x9200)).toBe(0x5a);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      dmaSeq: 0,
      dmaBusRequested: false,
      dmaTransferCount: 1
    });
  });

  it("routes memory-to-port DMA writes through the C port manager", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.writeTestMemory(0x8300, 0x7e);
    configureMemoryToPort(machine, 0x8300, 0x001f, 1);
    writeZxnDma(machine, 0xcf);
    writeZxnDma(machine, 0x87);
    machine.wasmV2Runtime!.exports.zxnextRunDma(0);

    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      dacA: 0x7e,
      dmaTransferDataByte: 0x7e,
      dmaLastStepTicks: 7
    });
  });

  it("selects legacy Z80 DMA mode through port 0x0b", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.doWritePort(0x000b, 0x87);

    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      dmaMode: 1,
      dmaEnabled: true,
      dmaByteCounter: 0xffff
    });
  });

  it("auto-restarts completed blocks when WR5 enables it", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.writeTestMemory(0x8400, 0xa1);
    machine.writeTestMemory(0x8401, 0xb2);
    configureMemoryToMemory(machine, 0x8400, 0x9400, 2);
    writeZxnDma(machine, 0xa2);
    writeZxnDma(machine, 0xcf);
    writeZxnDma(machine, 0x87);

    machine.wasmV2Runtime!.exports.zxnextRunDma(6);

    expect(machine.readTestMemory(0x9400)).toBe(0xa1);
    expect(machine.readTestMemory(0x9401)).toBe(0xb2);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      dmaAutoRestart: true,
      dmaBlockCompletionCount: 2,
      dmaSeq: 1
    });
  });
});

function configureMemoryToMemory(machine: { doWritePort: (address: number, value: number) => void }, source: number, dest: number, length: number): void {
  writeZxnDma(machine, 0x7d, source & 0xff, source >> 8, length & 0xff, length >> 8);
  writeZxnDma(machine, 0x14);
  writeZxnDma(machine, 0x10);
  writeZxnDma(machine, 0xad, dest & 0xff, dest >> 8);
}

function configureMemoryToPort(machine: { doWritePort: (address: number, value: number) => void }, source: number, port: number, length: number): void {
  writeZxnDma(machine, 0x7d, source & 0xff, source >> 8, length & 0xff, length >> 8);
  writeZxnDma(machine, 0x14);
  writeZxnDma(machine, 0x28);
  writeZxnDma(machine, 0xad, port & 0xff, port >> 8);
}

function writeZxnDma(machine: { doWritePort: (address: number, value: number) => void }, ...bytes: number[]): void {
  for (const byte of bytes) machine.doWritePort(0x006b, byte & 0xff);
}

function readZxnDma(machine: { doReadPort: (address: number) => number }): number {
  return machine.doReadPort(0x006b);
}
