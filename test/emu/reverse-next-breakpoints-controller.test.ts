import { describe, expect, it } from "vitest";

import type { Channel, RequestMessage } from "@messaging/messages-core";
import createAppStore from "@state/store";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import { comparePositions } from "@emu/machines/reverse/timelinePosition";
import { createSession } from "../harness/zxnext";

/*
 * Reverse Continue with the Next's own breakpoint kinds (`.plans/REVERSE_DEBUGGING_PLAN.md` D15,
 * Phase 7), on the real Next through the controller. They go through the same debug loop as every
 * other kind, checked on the real past machine:
 *
 * - a NextReg write breakpoint finds the last write to a register, then the one before it;
 * - a Copper breakpoint finds the last time the Copper completed an instruction - in the frame
 *   before, then the frame before that;
 * - a sprite-attribute breakpoint finds the last port $57 write to a sprite, then the one before it.
 */

class ResolvingMessenger extends MessengerBase {
  protected send(message: RequestMessage): void {
    if (message.correlationId != null) {
      this.processResponse({ type: "ApiMethodResponse", correlationId: message.correlationId, result: undefined });
    }
  }
  get requestChannel(): Channel {
    return "EmuToMain";
  }
  get responseChannel(): Channel {
    return "EmuToMainResponse";
  }
}

/**
 * Starts a Copper list in mode 11 (restarted every frame: two MOVEs, a WAIT for line 96, two MOVEs),
 * then counts at $9000 and, every 64 passes, writes the write count to NextReg $4A and to sprite 5's
 * attr0 through port $57
 */
const PROGRAM = `
      .org $8000
Main:
      nextreg $62,0
      nextreg $61,0
      ld hl,CopperList
      ld b,CopperEnd-CopperList
Upload:
      ld a,(hl)
      nextreg $60,a
      inc hl
      djnz Upload
      nextreg $62,$c0
      ld hl,$9000
Loop:
      inc (hl)
      ld a,(hl)
      and $3f
      jr nz,Loop
      ld a,($9001)
      inc a
      ld ($9001),a
      nextreg $4a,a
AfterWrite:
      ld bc,$303b
      ld a,5
      out (c),a
      ld bc,$0057
      ld a,($9001)
      out (c),a
AfterSprite:
      jr Loop

CopperList:
      .defb $40,$10, $41,$00, $80+0,96, $40,$10, $41,$1c, $ff,$ff
CopperEnd:
`;

async function waitFor(done: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 400_000; i++) {
    if (done()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

describe("Reverse Continue with NextReg, Copper and sprite breakpoints (Phase 7)", () => {
  it("finds the last NextReg write, Copper instruction and sprite attribute write on the real past machine", async () => {
    const s = await createSession();
    const program = await s.loadCode(PROGRAM);
    s.poke(0x9000, 0);
    s.poke(0x9001, 0);
    const controller = new MachineController(createAppStore("test-reverse-next-bps"), new ResolvingMessenger(), s.machine as any);
    const debugSupport = s.attachDebugSupport();
    controller.debugSupport = debugSupport;
    controller.state = MachineControllerState.Paused;
    const machine = s.machine as unknown as { frames: number; pc: number };

    // --- A debug run of a while: keyframes on the way
    const startFrame = machine.frames;
    await controller.startDebug();
    await waitFor(() => machine.frames - startFrame >= 150, "150 frames");
    await controller.pause();
    const timeline = controller.timeline!;
    const present = timeline.position;
    const presentFrames = machine.frames;
    const writes = s.peek(0x9001);
    expect(writes).toBeGreaterThan(10);
    expect(timeline.store.keyframes.length).toBeGreaterThan(2);

    // --- The last write to NextReg $4A, then the one before it
    const nextRegBp = { nextReg: 0x4a };
    debugSupport.addBreakpoint(nextRegBp);
    const last = controller.navigateHistory("reverseContinue");
    expect(last.moved).toBe(true);
    expect(machine.pc).toBe(program.symbol("AfterWrite"));
    expect(s.peek(0x9001)).toBe(writes);
    expect(s.nextRegValue(0x4a)).toBe(writes & 0xff);
    expect(controller.navigateHistory("reverseContinue").moved).toBe(true);
    expect(machine.pc).toBe(program.symbol("AfterWrite"));
    expect(s.peek(0x9001)).toBe(writes - 1);
    expect(s.nextRegValue(0x4a)).toBe((writes - 1) & 0xff);
    debugSupport.removeBreakpoint(nextRegBp);

    // --- The Copper's MOVE after its WAIT (index 3): the frame before the present's, then one earlier
    controller.navigateHistory("present");
    expect(timeline.position).toEqual(present);
    const copperBp = { copperIndex: 3 };
    debugSupport.addBreakpoint(copperBp);
    const copper = controller.navigateHistory("reverseContinue");
    expect(copper.moved).toBe(true);
    expect(copper.breakpoint ?? "").toMatch(/copper/i);
    const firstFrame = machine.frames;
    expect(firstFrame).toBeLessThanOrEqual(presentFrames);
    expect(firstFrame).toBeGreaterThanOrEqual(presentFrames - 1);
    expect(comparePositions(timeline.position, present)).toBeLessThan(0);
    expect(controller.navigateHistory("reverseContinue").moved).toBe(true);
    expect(machine.frames).toBe(firstFrame - 1);
    debugSupport.removeBreakpoint(copperBp);

    // --- The last write to sprite 5's attributes, then the one before it
    controller.navigateHistory("present");
    const spriteBp = { spriteIndex: 5 };
    debugSupport.addBreakpoint(spriteBp);
    const sprite = controller.navigateHistory("reverseContinue");
    expect(sprite.moved).toBe(true);
    expect(sprite.breakpoint ?? "").toMatch(/^Sprite breakpoint: sprite \$05 attr 0 \(X\)/);
    expect(machine.pc).toBe(program.symbol("AfterSprite"));
    expect(s.peek(0x9001)).toBe(writes);
    expect(controller.navigateHistory("reverseContinue").moved).toBe(true);
    expect(machine.pc).toBe(program.symbol("AfterSprite"));
    expect(s.peek(0x9001)).toBe(writes - 1);
    debugSupport.removeBreakpoint(spriteBp);
    await controller.stop();
  }, 600_000);
});
