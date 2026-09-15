import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/**
 * The step-out shadow stack, in the core the Next actually runs.
 *
 * `test/emu/step-out-stack.test.ts` exercises the same algorithm on the interpreted `Z80Cpu`, which
 * is where the model is written down — but the ZX Spectrum Next executes inside `z80.c`, and the C
 * is a hand transcription of the TypeScript. A bug in the transcription alone would pass every test
 * there and still break the debugger, which is exactly the gap this file closes.
 *
 * The case is the one reported against ScrollNutter: a routine reached once by `call` and again by
 * `jp`. See `Z80Cpu.popFromStepOutStack`.
 */

const CALL = 0xcd;
const JP = 0xc3;
const RET = 0xc9;

// --- Mirrors `writeLoadedByte` in `wasm-next-debug-step.test.ts`: `getPartition` already answers in
// --- the index space `getMemoryPartition` expects, so there is nothing to convert.
function writeByte(machine: ZxNextWasmV2Machine, address: number, value: number): void {
  const partition = machine.getPartition(address);
  if (partition != null) {
    const partitionBytes = machine.getMemoryPartition(partition);
    partitionBytes[address & (partition < 0 ? 0x3fff : 0x1fff)] = value;
  } else {
    machine.doWriteMemory(address, value);
  }
}

function loadAt(machine: ZxNextWasmV2Machine, address: number, code: number[]): void {
  code.forEach((b, i) => writeByte(machine, (address + i) & 0xffff, b));
}

/** Run exactly one instruction. */
function step(machine: ZxNextWasmV2Machine): void {
  machine.executionContext.debugStepMode = DebugStepMode.StepInto;
  machine.executionContext.frameTerminationMode = FrameTerminationMode.DebugEvent;
  machine.executionContext.lastTerminationReason = undefined;
  machine.executeMachineFrame();
}

describe("ZX Next WASM core: step-out shadow stack", () => {
  it("targets the caller's caller after a tail call", async () => {
    const machine = await createTestZxNextWasmMachine();
    machine.hardReset();

    // --- $8000: CALL $9000   (the `call $A600`, returning to $8003)
    loadAt(machine, 0x8000, [CALL, 0x00, 0x90]);
    // --- $9000: CALL $9100   (the `call InitPaletteRamp`, returning to $9003)
    loadAt(machine, 0x9000, [CALL, 0x00, 0x91]);
    // --- $9003: JP $9100     (the `jp InitPaletteRamp` tail call — pushes nothing)
    loadAt(machine, 0x9003, [JP, 0x00, 0x91]);
    // --- $9100: RET
    loadAt(machine, 0x9100, [RET]);

    machine.pc = 0x8000;
    machine.sp = 0x7a80;
    machine.setTacts(0);
    machine.executionContext.debugSupport = new DebugSupport(undefined, []);

    step(machine); // --- CALL $9000
    expect(machine.pc).toBe(0x9000);

    step(machine); // --- CALL $9100, first entry to the routine
    expect(machine.pc).toBe(0x9100);

    // --- Entered by CALL, so it returns to the instruction after it.
    machine.markStepOutAddress();
    expect(machine.stepOutAddress).toBe(0x9003);

    step(machine); // --- RET
    expect(machine.pc).toBe(0x9003);

    step(machine); // --- JP $9100, second entry — this time by tail call
    expect(machine.pc).toBe(0x9100);

    /*
     * The `jp` pushed nothing, so this RET returns past the caller, to $8003.
     *
     * Before the core popped on RET this read $9003 — the *first* entry's return address, still on
     * top because nothing had removed it. Step Out then waited for an address the program never
     * reached again and ran on to the next breakpoint, which is the reported symptom.
     */
    machine.markStepOutAddress();
    expect(machine.stepOutAddress).toBe(0x8003);
  });

  it("targets the outer routine once an inner call has returned", async () => {
    const machine = await createTestZxNextWasmMachine();
    machine.hardReset();

    loadAt(machine, 0x8000, [CALL, 0x00, 0x90]); // --- returns to $8003
    loadAt(machine, 0x9000, [CALL, 0x00, 0x91]); // --- returns to $9003
    loadAt(machine, 0x9003, [RET]);
    loadAt(machine, 0x9100, [RET]);

    machine.pc = 0x8000;
    machine.sp = 0x7a80;
    machine.setTacts(0);
    machine.executionContext.debugSupport = new DebugSupport(undefined, []);

    step(machine); // --- CALL $9000
    step(machine); // --- CALL $9100
    expect(machine.pc).toBe(0x9100);

    step(machine); // --- RET, back into the outer routine
    expect(machine.pc).toBe(0x9003);

    // --- The inner call's entry is spent; the outer routine returns to $8003.
    machine.markStepOutAddress();
    expect(machine.stepOutAddress).toBe(0x8003);
  });
});
