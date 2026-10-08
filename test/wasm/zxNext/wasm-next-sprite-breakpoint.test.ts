import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { connectConditionSupport } from "@emu/machines/conditionStore";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { describeSpriteStop } from "@common/zxnext/sprites/spriteBreakpoints";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/**
 * Sprite-attribute breakpoints (`sp:`), end to end: `DebugSupport` authoring the per-sprite
 * attribute mask, the core latching the first watched write, and the debug loop turning it into a
 * stop (`.plans/SPRITE_ATTRIBUTE_BREAKPOINTS_PLAN.md`). `test/zxnext-hw/sprites/attribute-watch.test.ts`
 * covers the core's half on its own, the DMA and Copper writers included.
 *
 * The program selects sprite 12 through $303B, writes its five attributes through port $57, writes
 * attr2 again through the $37 NextReg mirror, then spins.
 */

const START_ADDRESS = 0x8000;

// prettier-ignore
const PROGRAM = [
  0x01, 0x3b, 0x30,       // 8000 LD BC,$303B
  0x3e, 0x0c,             // 8003 LD A,12
  0xed, 0x79,             // 8005 OUT (C),A      ; upload index -> sprite 12
  0x01, 0x57, 0x00,       // 8007 LD BC,$0057
  0x3e, 0x40,             // 800A LD A,$40
  0xed, 0x79,             // 800C OUT (C),A      ; attr0
  0x3e, 0x50,             // 800E LD A,$50
  0xed, 0x79,             // 8010 OUT (C),A      ; attr1
  0x3e, 0x00,             // 8012 LD A,$00
  0xed, 0x79,             // 8014 OUT (C),A      ; attr2
  0x3e, 0xc0,             // 8016 LD A,$C0
  0xed, 0x79,             // 8018 OUT (C),A      ; attr3: visible, 5-byte
  0x3e, 0x00,             // 801A LD A,$00
  0xed, 0x79,             // 801C OUT (C),A      ; attr4
  0xed, 0x91, 0x34, 0x0c, // 801E NEXTREG $34,12
  0xed, 0x91, 0x37, 0x08, // 8022 NEXTREG $37,$08 ; attr2 through the mirror
  0x18, 0xfe              // 8026 JR $
];

function initialize(machine: ZxNextWasmV2Machine, ...breakpoints: BreakpointInfo[]): DebugSupport {
  machine.hardReset();
  PROGRAM.forEach((byte, offset) => machine.doWriteMemory(START_ADDRESS + offset, byte));
  machine.pc = START_ADDRESS;
  machine.sp = 0xff00;
  machine.setTacts(0);
  machine.frameTacts = 0;
  machine.currentFrameTact = 0;
  machine.frames = 0;
  machine.frameCompleted = false;
  machine.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;
  machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
  const debugSupport = new DebugSupport();
  connectConditionSupport(debugSupport, machine);
  breakpoints.forEach((bp) => debugSupport.addBreakpoint(bp));
  machine.executionContext.debugSupport = debugSupport;
  machine.executionContext.lastTerminationReason = undefined;
  return debugSupport;
}

/** Runs frames until a debug event, failing after `maxFrames`. */
function runToStop(machine: ZxNextWasmV2Machine, maxFrames = 4): void {
  for (let frame = 0; frame < maxFrames; frame++) {
    if (machine.executeMachineFrame() === FrameTerminationMode.DebugEvent) return;
  }
  throw new Error(`No debug stop in ${maxFrames} frames`);
}

function expectNoStop(machine: ZxNextWasmV2Machine, frames = 3): void {
  for (let i = 0; i < frames; i++) {
    expect(machine.executeMachineFrame()).not.toBe(FrameTerminationMode.DebugEvent);
  }
}

describe("ZX Spectrum Next sprite-attribute breakpoints", () => {
  it("stops after the OUT that writes a watched sprite, with the byte it replaced", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, { spriteIndex: 12 });

    runToStop(wasm);
    expect(wasm.lastSpriteWrite).toEqual({
      sprite: 12,
      attribute: 0,
      oldValue: 0,
      newValue: 0x40,
      origin: "port",
      pc: 0x800c,
      partition: wasm.lastSpriteWrite!.partition
    });
    // --- The machine stops at the end of the writing instruction
    expect(wasm.pc).toBe(0x800e);
    expect(wasm.getCpuState().lastSpriteWrite).toEqual(wasm.lastSpriteWrite);
    expect(describeSpriteStop(wasm.lastSpriteWrite!, wasm.getPartitionLabels())).toMatch(
      /^Sprite breakpoint: sprite \$0C attr 0 \(X\) \$00 -> \$40 through port \$57, written at \$800C in \w+$/
    );
  });

  it("resuming clears the write and stops on the next one", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, { spriteIndex: 12 });
    runToStop(wasm);
    runToStop(wasm);
    expect(wasm.lastSpriteWrite).toMatchObject({ attribute: 1, newValue: 0x50, pc: 0x8010 });
  });

  it("watches only the selected attribute bytes", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, { spriteIndex: 12, spriteAttrMask: 1 << 3 });
    runToStop(wasm);
    expect(wasm.lastSpriteWrite).toMatchObject({ attribute: 3, newValue: 0xc0, pc: 0x8018 });
  });

  it("catches the NextReg mirror too, with the byte the port wrote before it", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, { spriteIndex: 12, spriteAttrMask: 1 << 2 });
    runToStop(wasm);
    expect(wasm.lastSpriteWrite).toMatchObject({ attribute: 2, origin: "port", pc: 0x8014 });
    runToStop(wasm);
    expect(wasm.lastSpriteWrite).toMatchObject({
      attribute: 2,
      oldValue: 0x00,
      newValue: 0x08,
      origin: "nextreg",
      pc: 0x8022
    });
  });

  it("applies a condition: ADDR is the attribute byte and VAL the value written", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const ds = initialize(wasm, { spriteIndex: 12, condition: "ADDR == 1 && VAL == $50" });
    expect(ds.listBreakpointsWithState()[0].conditionError).toBeUndefined();
    runToStop(wasm);
    expect(wasm.lastSpriteWrite).toMatchObject({ attribute: 1, pc: 0x8010 });
  });

  it("applies a hit count: -hit 3 stops on the third write", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, { spriteIndex: 12, hitCount: 3, hitMode: "eq" });
    runToStop(wasm);
    expect(wasm.lastSpriteWrite).toMatchObject({ attribute: 2, pc: 0x8014 });
  });

  it("does not stop for another sprite, or when disabled", async () => {
    const other = await createTestZxNextWasmMachine();
    initialize(other, { spriteIndex: 13 });
    expectNoStop(other);

    const disabled = await createTestZxNextWasmMachine();
    initialize(disabled, { spriteIndex: 12, disabled: true });
    expectNoStop(disabled);
  });

  it("a one-shot run-to is consumed when it fires", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const ds = initialize(wasm, { spriteIndex: 12, oneShot: true, runTo: true, owner: { kind: "session" } });
    runToStop(wasm);
    expect(wasm.lastSpriteWrite).toMatchObject({ attribute: 0 });
    expect(ds.consumeFiredOneShots()).toBe(1);
    expect(ds.hasSpriteBreakpoints()).toBe(false);
  });

  it("without an sp: breakpoint the core's watch is disarmed", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, { spriteIndex: 12 });
    runToStop(wasm);
    wasm.executionContext.debugSupport = new DebugSupport(undefined, []);
    expectNoStop(wasm);
    expect(wasm.lastSpriteWrite).toBeUndefined();
    expect(wasm.wasmV2Runtime!.exports.zxnextTakeSpriteHit()).toBe(0);
  });
});
