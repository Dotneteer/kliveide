import { describe, expect, it } from "vitest";

import type { Z80CpuState } from "@common/messaging/EmuApi";

import { createZx81Session, type Zx81TestSession } from "../harness/zx81";

/**
 * The debugger on the ZX81 (`.plans/ZX8081_WASM_PLAN.md` Phase 6), driven as the IDE drives it:
 * breakpoints in the ROM and in RAM, step into/over/out, memory and I/O breakpoints, and stepping
 * through the display file, where the ULA turns the bytes the CPU fetches into NOPs.
 */

/*
 *   $6000  DI
 *   $6001  LD SP,$7F00
 *   $6004  CALL $6010
 *   $6007  LD A,1          <- after
 *   $6009  JR $6009        <- done
 *   $6010  LD IX,$1234     <- routine (a prefixed instruction)
 *   $6014  CALL $6020
 *   $6017  LD ($6100),A
 *   $601A  OUT ($FD),A
 *   $601C  RET
 *   $6020  NOP             <- leaf
 *   $6021  RET
 */
const CODE: [number, number[]][] = [
  [0x6000, [0xf3, 0x31, 0x00, 0x7f, 0xcd, 0x10, 0x60, 0x3e, 0x01, 0x18, 0xfe]],
  [0x6010, [0xdd, 0x21, 0x34, 0x12, 0xcd, 0x20, 0x60, 0x32, 0x00, 0x61, 0xd3, 0xfd, 0xc9]],
  [0x6020, [0x00, 0xc9]]
];

async function withProgram(): Promise<Zx81TestSession> {
  const s = await createZx81Session();
  s.bootToBasic();
  for (const [address, bytes] of CODE) s.poke(address, bytes);
  s.attachDebugSupport();
  s.machine.pc = 0x6000;
  return s;
}

describe("ZX81 debugger", () => {
  it("stops at a breakpoint in the ROM: the keyboard scan, once a frame", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    s.breakpoint(0x02bb);
    expect(s.debug("continue")).toBe(0x02bb);
    expect(s.debug("continue")).toBe(0x02bb);
  });

  it("steps into, over and out", async () => {
    const s = await withProgram();
    expect(s.debug("stepInto")).toBe(0x6001);
    expect(s.debug("stepInto")).toBe(0x6004);
    expect(s.debug("stepInto")).toBe(0x6010);
    // --- A prefixed instruction is one step
    expect(s.debug("stepInto")).toBe(0x6014);
    expect(s.machine.ix).toBe(0x1234);
    // --- Over the CALL to leaf
    expect(s.debug("stepOver")).toBe(0x6017);
    // --- Out of routine, to after the CALL
    expect(s.debug("stepOut")).toBe(0x6007);
  });

  it("stops after an instruction that writes a watched address, or a watched port", async () => {
    const s = await withProgram();
    s.watch(0x6100, "memoryWrite");
    expect(s.debug("continue")).toBe(0x601a);
    expect(s.machine.lastMemoryWritesCount).toBe(1);
    // --- OUT (n),A puts A on the high half of the port address
    s.watch((s.machine.a << 8) | 0xfd, "ioWrite");
    expect(s.debug("continue")).toBe(0x601c);
    expect(s.machine.lastIoWritePort).toBe((s.machine.a << 8) | 0xfd);
  });

  it("stops at a breakpoint in RAM and shows the registers there", async () => {
    const s = await withProgram();
    s.breakpoint(0x6020);
    expect(s.debug("continue")).toBe(0x6020);
    const cpu = s.machine.getCpuState() as Z80CpuState;
    expect(cpu.ix).toBe(0x1234);
    expect(cpu.sp).toBe(0x7efc);
  });

  it("steps through the display file: the CPU executes the NOPs the ULA forced, at the upper echo", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    // --- The first character of the bottom row: the K cursor's cell, D_FILE + 23 * 33 + 1 ($B0)
    const dfile = s.peekWord(0x400c);
    const cursor = dfile + 23 * 33 + 1;
    expect(s.peek(cursor)).toBe(0xb0);
    s.breakpoint(cursor | 0x8000);
    expect(s.debug("continue", { maxFrames: 5 })).toBe(cursor | 0x8000);
    expect(s.debug("stepInto")).toBe((cursor + 1) | 0x8000);
    // --- Memory holds the cursor; the CPU executed a NOP ($00)
    expect(s.peek(cursor | 0x8000)).toBe(0xb0);
    expect(s.machine.opCode).toBe(0x00);
  });
});
