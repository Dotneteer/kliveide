import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/**
 * NextReg write breakpoints, end to end: `DebugSupport` authoring the watch table, the core
 * matching against it, and the debug loop turning a hit into a stop.
 *
 * `test/zxnext-hw/nextreg/write-watch.test.ts` covers the core's half on its own; this is about the
 * three parts agreeing. The stop comes *after* the instruction that wrote, exactly as it does for a
 * memory or I/O watchpoint (see `wasm-next-access-breakpoint.test.ts`), which is why every case
 * checks `lastNextRegWrite` rather than the register's live value: the pair of old and new values is
 * what makes the stop readable as "before".
 *
 * `$7F` is the user register - plain 8-bit storage with no side effects and no reset branch.
 */

const START_ADDRESS = 0x8000;
const USER_REG = 0x7f;

/** LD A,value / NEXTREG $7F,A / NOP — a NextReg write that never touches the port layer. */
const writeUserRegViaOpcode = (value: number) => [0x3e, value, 0xed, 0x92, USER_REG, 0x00];

/** LD BC,$243B / LD A,$7F / OUT (C),A / LD BC,$253B / LD A,value / OUT (C),A / NOP */
const writeUserRegViaPort = (value: number) => [
  0x01, 0x3b, 0x24, 0x3e, USER_REG, 0xed, 0x79,
  0x01, 0x3b, 0x25, 0x3e, value, 0xed, 0x79,
  0x00
];

describe("ZX Spectrum Next NextReg write breakpoints", () => {
  it("stops on a NEXTREG opcode writing a watched register", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, writeUserRegViaOpcode(0x33), { nextReg: USER_REG });
    // --- Read rather than assumed: $7F powers on at $FF (zxnext.vhd:1210, no reset branch), and
    // --- the invariant under test is "oldValue is what the register held", not any one constant.
    const before = wasm.wasmV2Runtime!.exports.zxnextGetNextRegisterDirect(USER_REG);

    expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    expect(wasm.lastNextRegWrite).toEqual({
      reg: USER_REG,
      oldValue: before,
      newValue: 0x33,
      origin: "cpu",
      // --- The instruction that wrote, and the paging it wrote under. `toEqual` rather than
      // --- `toMatchObject` on purpose: this is the whole event, so a field added without thought
      // --- fails here.
      pc: 0x8002,
      partition: wasm.getPartition(0x8002)
    });
    // --- The write landed: the breakpoint observes, it does not withhold.
    expect(wasm.wasmV2Runtime!.exports.zxnextGetNextRegisterDirect(USER_REG)).toBe(0x33);
  });

  it("stops on a $253B port write, the other CPU path to the same register", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, writeUserRegViaPort(0x44), { nextReg: USER_REG });

    expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    expect(wasm.lastNextRegWrite).toMatchObject({ reg: USER_REG, newValue: 0x44 });
  });

  it("reports the write against the instruction that performed it", async () => {
    // --- `opStartAddress` is what the Breakpoints panel shows beside a watchpoint hit, and it is
    // --- only tracked while something is watching - so the loop's gate has to include this kind.
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, writeUserRegViaOpcode(0x33), { nextReg: USER_REG });

    wasm.executeMachineFrame();

    // --- LD A,$33 occupies $8000-$8001; the NEXTREG that wrote begins at $8002.
    expect(wasm.getCpuState().opStartAddress).toBe(0x8002);
  });

  it("runs the whole frame when nothing watches the register that was written", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, writeUserRegViaOpcode(0x33), { nextReg: 0x4c });

    expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.Normal);
    expect(wasm.lastNextRegWrite).toBeUndefined();
  });

  it("runs the whole frame when the breakpoint is disabled", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, writeUserRegViaOpcode(0x33), { nextReg: USER_REG, disabled: true });

    expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.Normal);
  });

  it("clears the last write when the machine resumes", async () => {
    // --- Resuming starts a new search. A stale value would keep the panel highlighting a row that
    // --- is no longer the one that fired.
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, writeUserRegViaOpcode(0x33), { nextReg: USER_REG });
    wasm.executeMachineFrame();
    expect(wasm.lastNextRegWrite).toBeDefined();

    wasm.executeMachineFrame();

    expect(wasm.lastNextRegWrite).toBeUndefined();
  });

  describe("value filters", () => {
    it("stops on the value it was armed for", async () => {
      const wasm = await createTestZxNextWasmMachine();
      initialize(wasm, writeUserRegViaOpcode(0x03), { nextReg: USER_REG, nextRegValue: 0x03 });

      expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
      expect(wasm.lastNextRegWrite).toMatchObject({ newValue: 0x03 });
    });

    it("ignores a write of any other value", async () => {
      const wasm = await createTestZxNextWasmMachine();
      initialize(wasm, writeUserRegViaOpcode(0x05), { nextReg: USER_REG, nextRegValue: 0x03 });

      expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.Normal);
    });

    it("compares only the masked bits", async () => {
      const wasm = await createTestZxNextWasmMachine();
      initialize(wasm, writeUserRegViaOpcode(0xf3), {
        nextReg: USER_REG,
        nextRegValue: 0x03,
        nextRegMask: 0x0f
      });

      expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
      expect(wasm.lastNextRegWrite).toMatchObject({ newValue: 0xf3 });
    });

    it("does not stop on a value the widened table let through", async () => {
      /*
       * The case the host-side approximation exists for. Two filters on one register collapse the
       * core's single slot to "catch every write to $7F", so the core reports a write of $05 that
       * neither breakpoint asked for - and `hasNextRegWrite` has to refuse it, or the machine would
       * pause on a write nobody was watching.
       */
      const wasm = await createTestZxNextWasmMachine();
      initialize(
        wasm,
        writeUserRegViaOpcode(0x05),
        { nextReg: USER_REG, nextRegValue: 0x00 },
        { nextReg: USER_REG, nextRegValue: 0x03 }
      );

      expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.Normal);
      expect(wasm.lastNextRegWrite).toBeUndefined();
    });

    it("still stops on a value one of those two breakpoints did ask for", async () => {
      const wasm = await createTestZxNextWasmMachine();
      initialize(
        wasm,
        writeUserRegViaOpcode(0x03),
        { nextReg: USER_REG, nextRegValue: 0x00 },
        { nextReg: USER_REG, nextRegValue: 0x03 }
      );

      expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
      expect(wasm.lastNextRegWrite).toMatchObject({ newValue: 0x03 });
    });
  });

  describe("a write that asks the machine to reset", () => {
    /*
     * NextReg $02 bits 0 and 1 request a soft and a hard reset. The core only *raises* the request;
     * the TypeScript wrapper performs the reset. That makes this the case where a NextReg
     * breakpoint is worth the most and is hardest to get right: the write is the last thing that
     * happens before the machine's PC and paging are thrown away, so a stop that arrives after the
     * reset has been applied tells the user nothing about who wrote it.
     */

    /** LD A,value / NEXTREG $02,A / NOP */
    const requestReset = (value: number) => [0x3e, value, 0xed, 0x92, 0x02, 0x00];

    it("stops on a soft-reset request, with the machine still where the write happened", async () => {
      const wasm = await createTestZxNextWasmMachine();
      initialize(wasm, requestReset(0x01), { nextReg: 0x02 });

      expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
      // --- `pc` is the whole point: NEXTREG $02,A begins at $8002, and after the reset is applied
      // --- there is nothing left on the machine to read it from.
      expect(wasm.lastNextRegWrite).toMatchObject({
        reg: 0x02,
        newValue: 0x01,
        origin: "cpu",
        pc: 0x8002
      });
      // --- And the paging that address was under, for the same reason.
      expect(wasm.lastNextRegWrite!.partition).toBe(wasm.getPartition(0x8002));
      expect(wasm.getCpuState().opStartAddress).toBe(0x8002);
      expect(wasm.pc).not.toBe(0x0000);
    });

    it("stops on a hard-reset request too", async () => {
      /*
       * The case that used not to fire at all. A hard reset re-initialises the core's NextReg
       * state, which cleared the latch before the loop could read it - so the one breakpoint a user
       * would most want on `$02` was silently dead.
       */
      const wasm = await createTestZxNextWasmMachine();
      initialize(wasm, requestReset(0x02), { nextReg: 0x02 });

      expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
      expect(wasm.lastNextRegWrite).toMatchObject({ reg: 0x02, newValue: 0x02 });
      expect(wasm.getCpuState().opStartAddress).toBe(0x8002);
      expect(wasm.pc).not.toBe(0x0000);
    });

    it("carries out the deferred reset when the machine resumes, without running an extra instruction", async () => {
      /*
       * Stopping in front of the reset leaves the request standing in the core. The loop entry has
       * to honour it before executing anything, or the program would get one instruction further
       * than it really did.
       */
      const wasm = await createTestZxNextWasmMachine();
      initialize(wasm, requestReset(0x02), { nextReg: 0x02 });
      expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
      expect(wasm.pc).not.toBe(0x0000);

      wasm.executeMachineFrame();

      // --- The reset landed: a Next starts from $0000 after one.
      expect(wasm.getCpuState().opStartAddress).not.toBe(0x8002);
    });
  });

  it("leaves an ordinary program alone once the last NextReg breakpoint is gone", async () => {
    /*
     * The stale-table case. The core keeps the watch across runs, so a loop that entered with a
     * NextReg breakpoint and then re-entered without one must actively clear it - otherwise the
     * machine goes on stopping at a breakpoint the user deleted.
     */
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, writeUserRegViaOpcode(0x33), { nextReg: USER_REG });
    expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);

    wasm.executionContext.debugSupport = new DebugSupport(undefined, []);
    wasm.pc = START_ADDRESS;
    wasm.frameCompleted = false;

    expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.Normal);
    expect(wasm.lastNextRegWrite).toBeUndefined();
  });
});

function initialize(
  machine: ZxNextWasmV2Machine,
  code: number[],
  ...breakpoints: BreakpointInfo[]
): void {
  machine.hardReset();
  code.forEach((byte, offset) => machine.doWriteMemory(START_ADDRESS + offset, byte));
  machine.pc = START_ADDRESS;
  machine.sp = 0xff00;
  machine.setTacts(0);
  machine.frameTacts = 0;
  machine.currentFrameTact = 0;
  machine.frames = 0;
  machine.frameCompleted = false;
  machine.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;
  machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
  machine.executionContext.debugSupport = new DebugSupport(undefined, breakpoints);
  machine.executionContext.lastTerminationReason = undefined;
}
