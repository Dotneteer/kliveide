import { describe, expect, it } from "vitest";

import type { Channel, RequestMessage } from "@messaging/messages-core";
import createAppStore from "@state/store";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import { comparePositions } from "@emu/machines/reverse/timelinePosition";
import { createSp48Session } from "../harness/sp48";

/*
 * Reverse Continue and reverse watchpoints (`.plans/REVERSE_DEBUGGING_PLAN.md` D15, Phase 5), on the
 * real 48K through the machine controller: a memory-write watchpoint finds the last write to an
 * address several keyframe intervals back - checked on the real past machine, interval by interval -
 * and the machine lands on it.
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

/** Writes the loop counter to $9500 only while the flag at $9600 is set */
const PROGRAM = `
      .org $8000
Main:
      ld hl,$9000
      ei
Loop:
      inc (hl)
      ld a,($9600)
      or a
      jr z,Skip
      ld a,(hl)
      ld ($9500),a
AfterWrite:
      nop
Skip:
      jr Loop
`;

async function waitFor(done: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 400_000; i++) {
    if (done()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

describe("Reverse Continue by replay (Phase 5)", () => {
  it("finds the last write to an address three keyframe intervals back, and the one before it", async () => {
    const session = (await createSp48Session()).bootToBasic();
    const program = await session.loadCode(PROGRAM);
    session.poke(0x9600, 0);
    session.machine.pc = program.symbol("Main");
    const controller = new MachineController(createAppStore("test-reverse-continue"), new ResolvingMessenger(), session.machine as any);
    const debugSupport = session.attachDebugSupport();
    controller.debugSupport = debugSupport;
    controller.state = MachineControllerState.Paused;
    const paused = () => controller.state === MachineControllerState.Paused;

    /** Continues to the loop's nth hit from now */
    const runLoops = async (n: number) => {
      const bp = { address: program.symbol("Loop"), exec: true, hitCount: n };
      debugSupport.resetHitCounts();
      debugSupport.addBreakpoint(bp);
      await controller.startDebug();
      await waitFor(paused, "the loop breakpoint");
      debugSupport.removeBreakpoint(bp);
    };

    await runLoops(20_000);
    // --- The writes start (a journaled memory edit) ...
    session.machine.doWriteMemory(0x9600, 1);
    await runLoops(30_000);
    // --- ... and stop: the last write is just before here
    session.machine.doWriteMemory(0x9600, 0);
    const writesOff = controller.timeline!.position;
    await runLoops(400_000);
    const timeline = controller.timeline!;
    const present = timeline.position;
    const intervalsSince = timeline.store.keyframes.filter(
      (k) => !k.transient && comparePositions(k.seed.position, writesOff) > 0
    ).length;
    expect(intervalsSince).toBeGreaterThanOrEqual(3);

    // --- Reverse Continue with a memory-write watchpoint on $9500
    const watch = { address: 0x9500, memoryWrite: true };
    debugSupport.addBreakpoint(watch);
    const result = controller.navigateHistory("reverseContinue");
    expect(result.moved).toBe(true);
    expect(result.breakpoint).toBeDefined();
    expect(timeline.mode).toBe("navigating");
    const landing = timeline.position;
    expect(comparePositions(landing, writesOff)).toBeLessThan(0);
    // --- The machine stands just after the write: memory shows it
    expect(session.machine.pc).toBe(program.symbol("AfterWrite"));
    const written = session.peek(0x9500);
    expect(written).toBe(session.peek(0x9000));
    expect(controller.historyCursor.memoryIsHistorical || timeline.mode === "navigating").toBe(true);

    // --- The one before it: an earlier write, one loop before, of the value one less
    const again = controller.navigateHistory("reverseContinue");
    expect(again.moved).toBe(true);
    const earlier = timeline.position;
    expect(comparePositions(earlier, landing)).toBeLessThan(0);
    expect(session.machine.pc).toBe(program.symbol("AfterWrite"));
    expect(session.peek(0x9500)).toBe((written - 1) & 0xff);

    // --- From the present again: the same search lands on the same write
    controller.navigateHistory("present");
    expect(timeline.mode).toBe("live");
    expect(timeline.position).toEqual(present);
    expect(controller.navigateHistory("reverseContinue").moved).toBe(true);
    expect(timeline.position).toEqual(landing);

    // --- Nothing wrote after it: Continue from there, the watchpoint still set, replays to the present
    // --- without a stop (the machine then runs on live)
    await controller.startDebug();
    await waitFor(() => timeline.mode === "live" || paused(), "the present or a stop");
    expect(timeline.mode).toBe("live");

    // --- An execution breakpoint whose condition reads memory, checked on the past machine: the last
    // --- pass through AfterWrite that wrote an even value
    await controller.pause();
    debugSupport.removeBreakpoint(watch);
    debugSupport.addBreakpoint({ address: program.symbol("AfterWrite"), exec: true, condition: "(b[$9500] & 1) == 0" });
    expect(controller.navigateHistory("reverseContinue").moved).toBe(true);
    expect(session.machine.pc).toBe(program.symbol("AfterWrite"));
    expect(session.peek(0x9500) & 1).toBe(0);
    expect(session.peek(0x9500)).toBe(written & 1 ? (written - 1) & 0xff : written);
    await controller.stop();
  }, 600_000);
});
