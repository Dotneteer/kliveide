import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { connectConditionSupport } from "@emu/machines/conditionStore";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { describePaletteStop } from "@common/zxnext/palette/paletteStops";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/**
 * Palette breakpoints (`pal:`), end to end (`dev/plans/NEXT_PALETTE_DEBUGGING_PLAN.md` §3): `DebugSupport`
 * building the entry bitmap and flags, the core latching the first watched write or flip, the debug
 * loop turning it into a stop, and the filters (`-changed`, conditions, hit counts) deciding.
 *
 * Slots are the `$43` bits 6-4 order: 0 ULA 1, 1 Layer 2 1, 2 sprites 1, 3 tilemap 1, 4-7 the second
 * banks. After a hard reset the sprite palettes hold `(i << 1) | (i & 2 ? 1 : 0)`.
 */

const START_ADDRESS = 0x8000;

// prettier-ignore
const PROGRAM = [
  0xf3,                   // 8000 DI
  0xed, 0x91, 0x43, 0x20, // 8001 NEXTREG $43,$20  ; write the first sprite palette
  0xed, 0x91, 0x40, 0x03, // 8005 NEXTREG $40,$03
  0xed, 0x91, 0x41, 0xe0, // 8009 NEXTREG $41,$E0  ; sprites 1 [$03] = $1C0
  0xed, 0x91, 0x41, 0xe0, // 800D NEXTREG $41,$E0  ; sprites 1 [$04] = $1C0
  0xed, 0x91, 0x40, 0x03, // 8011 NEXTREG $40,$03
  0xed, 0x91, 0x41, 0xe0, // 8015 NEXTREG $41,$E0  ; sprites 1 [$03] = $1C0 again: no change
  0xed, 0x91, 0x43, 0x28, // 8019 NEXTREG $43,$28  ; the sprites draw with their second bank
  0xed, 0x91, 0x6b, 0x10, // 801D NEXTREG $6B,$10  ; the tilemap draws with its second bank
  0x01, 0x3b, 0xbf,       // 8021 LD BC,$BF3B
  0x3e, 0x05,             // 8024 LD A,$05
  0xed, 0x79,             // 8026 OUT (C),A        ; ULA+ register: palette group, entry 5
  0x06, 0xff,             // 8028 LD B,$FF         ; BC = $FF3B
  0x3e, 0x1c,             // 802A LD A,$1C         ; GGGRRRBB: red 7
  0xed, 0x79,             // 802C OUT (C),A        ; ULA+ data: ULA 1 [$C5]
  0x18, 0xfe              // 802E JR $
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

describe("ZX Spectrum Next palette breakpoints", () => {
  it("stops after the NEXTREG that writes a watched entry, with the value it replaced", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, { paletteStop: "spr1:$03" });

    runToStop(wasm);
    expect(wasm.lastPaletteWrite).toEqual({
      kind: "entry",
      slot: 2,
      index: 3,
      oldValue: 0x007,
      newValue: 0x1c0,
      origin: "nextreg",
      path: "$41",
      pc: 0x8009,
      partition: wasm.lastPaletteWrite!.partition
    });
    // --- The machine stops at the end of the writing instruction
    expect(wasm.pc).toBe(0x800d);
    expect(wasm.getCpuState().lastPaletteWrite).toEqual(wasm.lastPaletteWrite);
    expect(describePaletteStop(wasm.lastPaletteWrite!, wasm.getPartitionLabels())).toMatch(
      /^Palette breakpoint: Sprites bank 1 entry \$03 \$007 -> \$1C0 through NextReg \$41, written at \$8009 in \w+$/
    );
  });

  it("stops on a write of the value already stored, unless -changed", async () => {
    const every = await createTestZxNextWasmMachine();
    initialize(every, { paletteStop: "spr1:$03" });
    runToStop(every);
    runToStop(every);
    expect(every.lastPaletteWrite).toMatchObject({ index: 3, oldValue: 0x1c0, newValue: 0x1c0, pc: 0x8015 });

    const changed = await createTestZxNextWasmMachine();
    initialize(changed, { paletteStop: "spr1:$03", paletteChanged: true });
    runToStop(changed);
    expect(changed.lastPaletteWrite).toMatchObject({ pc: 0x8009 });
    expectNoStop(changed);
  });

  it("watches every entry of a range in either bank", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, { paletteStop: "spr:$04-$10" });
    runToStop(wasm);
    expect(wasm.lastPaletteWrite).toMatchObject({ slot: 2, index: 4, pc: 0x800d });
  });

  it("does not stop for another bank, another device or a disabled breakpoint", async () => {
    for (const bp of [{ paletteStop: "spr2" }, { paletteStop: "l2" }, { paletteStop: "spr1:$03", disabled: true }]) {
      const wasm = await createTestZxNextWasmMachine();
      initialize(wasm, bp);
      expectNoStop(wasm);
    }
  });

  it("stops when a watched live bank flips, through $43 or $6B", async () => {
    const sprites = await createTestZxNextWasmMachine();
    initialize(sprites, { paletteStop: "spr:live" });
    runToStop(sprites);
    expect(sprites.lastPaletteWrite).toMatchObject({
      kind: "live",
      slot: 6,
      oldValue: 0,
      newValue: 1,
      origin: "nextreg",
      path: "$43",
      pc: 0x8019
    });
    expect(describePaletteStop(sprites.lastPaletteWrite!, sprites.getPartitionLabels())).toMatch(
      /^Palette breakpoint: Sprites now draws with bank 2 \(was bank 1\) through NextReg \$43, written at \$8019 in \w+$/
    );

    const tilemap = await createTestZxNextWasmMachine();
    initialize(tilemap, { paletteStop: "any:live" });
    runToStop(tilemap);
    expect(tilemap.lastPaletteWrite).toMatchObject({ kind: "live", slot: 6, pc: 0x8019 });
    runToStop(tilemap);
    expect(tilemap.lastPaletteWrite).toMatchObject({ kind: "live", slot: 7, path: "$6B", pc: 0x801d });
  });

  it("catches a ULA+ write through port $FF3B", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, { paletteStop: "ula1:$c5" });
    runToStop(wasm);
    expect(wasm.lastPaletteWrite).toMatchObject({
      kind: "entry",
      slot: 0,
      index: 0xc5,
      oldValue: 0x02d,
      newValue: 0x1c0,
      origin: "port",
      path: "$FF3B",
      pc: 0x802c
    });
  });

  it("applies a condition over palSlot, palIndex, palOld and palNew", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const ds = initialize(wasm, {
      paletteStop: "spr1",
      condition: "palSlot == 2 && palIndex == 4 && palOld == $008 && palNew == $1C0"
    });
    expect(ds.listBreakpointsWithState()[0].conditionError).toBeUndefined();
    runToStop(wasm);
    expect(wasm.lastPaletteWrite).toMatchObject({ index: 4, pc: 0x800d });
  });

  it("applies a hit count: -hit 3 stops on the third write", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, { paletteStop: "spr1", hitCount: 3, hitMode: "eq" });
    runToStop(wasm);
    expect(wasm.lastPaletteWrite).toMatchObject({ index: 3, pc: 0x8015 });
  });

  it("without a pal: breakpoint the core's watch is disarmed", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, { paletteStop: "spr1:$03" });
    runToStop(wasm);
    wasm.executionContext.debugSupport = new DebugSupport(undefined, []);
    expectNoStop(wasm);
    expect(wasm.lastPaletteWrite).toBeUndefined();
    expect(wasm.wasmV2Runtime!.exports.zxnextTakePaletteHit()).toBe(0);
  });
});
