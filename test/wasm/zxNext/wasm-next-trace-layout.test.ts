import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";
import { ZXNEXT_FRAME_TRACE_CAPACITY, ZXNEXT_FRAME_TRACE_HEADER_SIZE, ZXNEXT_FRAME_TRACE_RECORD_SIZE, ZXNEXT_FRAME_TRACE_TOTAL_BYTES } from "@emu/machines/zxNext/wasm/frameTraceLayout";

describe("ZX Spectrum Next WASM frame trace layout", () => {
  it("keeps the binary trace ABI fixed and matching the WASM core's trace ring", async () => {
    expect(ZXNEXT_FRAME_TRACE_HEADER_SIZE).toBe(64);
    expect(ZXNEXT_FRAME_TRACE_RECORD_SIZE).toBe(128);
    expect(ZXNEXT_FRAME_TRACE_TOTAL_BYTES).toBe(
      ZXNEXT_FRAME_TRACE_HEADER_SIZE + ZXNEXT_FRAME_TRACE_CAPACITY * ZXNEXT_FRAME_TRACE_RECORD_SIZE
    );

    // --- The loader sizes the trace view and the checkpoint skips it using these values
    const machine = await createTestZxNextWasmMachine();
    const runtime = machine.wasmV2Runtime!;
    expect(runtime.exports.zxnextTraceGetHeaderSize()).toBe(ZXNEXT_FRAME_TRACE_HEADER_SIZE);
    expect(runtime.exports.zxnextTraceGetRecordSize()).toBe(ZXNEXT_FRAME_TRACE_RECORD_SIZE);
    expect(runtime.exports.zxnextTraceGetCapacity()).toBe(ZXNEXT_FRAME_TRACE_CAPACITY);
    expect(runtime.frameTrace.byteLength).toBe(ZXNEXT_FRAME_TRACE_TOTAL_BYTES);
    expect(runtime.frameTrace.byteOffset).toBe(runtime.exports.zxnextTraceGetStartOffset());
  });
});

describe("ZX Spectrum Next WASM machine setup", () => {
  it("initializes CPU registers after hard reset", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.hardReset();

    // --- PC, IR, IFF1/IFF2 and IM 0 are the Z80 reset state; AF and SP are $FFFF on a real Z80
    // --- after power-on. The remaining values are pinned: the ones the TypeScript and WASM cores
    // --- agreed on at tag pre-zxnext-ts-removal-2026-09-19.
    expect(machine.getCpuState()).toMatchObject({
      af: 0xffff,
      bc: 0x0000,
      de: 0x0000,
      hl: 0x0000,
      af_: 0xffff,
      bc_: 0xffff,
      de_: 0xffff,
      hl_: 0xffff,
      ix: 0x0000,
      iy: 0x0000,
      ir: 0x0000,
      wz: 0x0000,
      pc: 0x0000,
      sp: 0xffff,
      iff1: false,
      iff2: false,
      interruptMode: 0,
      halted: false
    });
  });

  it("loads ROM images into WASM memory during setup and keeps them after hard reset", async () => {
    const machine = await createTestZxNextWasmMachine();
    const runtime = machine.wasmV2Runtime!;
    const romRoot = resolve(__dirname, "../../../src/public/roms");
    const nextRom = readFileSync(resolve(romRoot, "enNextZX.rom"));
    const divMmcRom = readFileSync(resolve(romRoot, "enNxtmmc.rom"));
    const multifaceRom = readFileSync(resolve(romRoot, "enNextMf.rom"));
    const altRom = readFileSync(resolve(romRoot, "enAltZX.rom"));

    expect(machine.doReadMemory(0x0000)).toBe(0xf3);
    expect(runtime.exports.zxnextReadPhysicalMemory(0x00000)).toBe(nextRom[0]);
    expect(runtime.exports.zxnextReadPhysicalMemory(0x10000)).toBe(divMmcRom[0]);
    expect(runtime.exports.zxnextReadPhysicalMemory(0x14000)).toBe(multifaceRom[0]);
    expect(runtime.exports.zxnextReadPhysicalMemory(0x18000)).toBe(altRom[0]);

    machine.hardReset();

    expect(machine.doReadMemory(0x0000)).toBe(0xf3);
    expect(runtime.exports.zxnextReadPhysicalMemory(0x00000)).toBe(0xf3);
  });
});
