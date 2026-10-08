import { describe, expect, it } from "vitest";

import type { Channel, RequestMessage } from "@messaging/messages-core";
import createAppStore from "@state/store";
import { withAdvancedDebugging } from "../advanced-debugging-helper";
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
    const controller = new MachineController(withAdvancedDebugging(createAppStore("test-reverse-continue")), new ResolvingMessenger(), session.machine as any);
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

  it("publishes where the timeline stands, and a search shows progress and can be canceled (§4.4)", async () => {
    const session = (await createSp48Session()).bootToBasic();
    const program = await session.loadCode(PROGRAM);
    session.poke(0x9600, 0);
    session.machine.pc = program.symbol("Main");
    const store = withAdvancedDebugging(createAppStore("test-reverse-progress"));
    const controller = new MachineController(store, new ResolvingMessenger(), session.machine as any);
    const debugSupport = session.attachDebugSupport();
    controller.debugSupport = debugSupport;
    controller.state = MachineControllerState.Paused;
    const paused = () => controller.state === MachineControllerState.Paused;
    const reverse = () => store.getState().emulatorState?.reverseDebug;

    const bp = { address: program.symbol("Loop"), exec: true, hitCount: 400_000 };
    debugSupport.addBreakpoint(bp);
    await controller.startDebug();
    await waitFor(paused, "the loop breakpoint");
    debugSupport.removeBreakpoint(bp);
    const timeline = controller.timeline!;
    const present = timeline.position;
    expect(reverse()).toMatchObject({ active: true, mode: "live" });
    expect(reverse()!.rangeSeconds).toBeGreaterThan(0.5);

    // --- In the past: how far back, in machine time
    for (let i = 0; i < 50; i++) controller.navigateHistory("back");
    expect(reverse()).toMatchObject({ active: true, mode: "navigating" });
    expect(reverse()!.behindSeconds).toBeGreaterThanOrEqual(0);
    expect(reverse()!.behindSeconds).toBeLessThan(0.1);
    // --- A step from the past replays: no live input was pressed, so none is reported as ignored
    await controller.stepInto();
    await waitFor(paused, "a step from the past");
    expect(reverse()).toMatchObject({ active: true, mode: "navigating" });
    expect(reverse()!.inputsIgnored).toBeUndefined();
    controller.navigateHistory("present");
    expect(reverse()!.mode).toBe("live");

    // --- A watchpoint nothing hits: the search goes interval by interval, publishing its progress,
    // --- until canceled - then the machine is back where it started
    debugSupport.addBreakpoint({ address: 0xa000, memoryWrite: true });
    const searching = controller.reverseContinue();
    await waitFor(() => (reverse()?.searchedIntervals ?? 0) >= 2, "two intervals searched");
    expect(controller.cancelReverseContinue()).toBe(true);
    const result = await searching;
    expect(result.reason).toBe("canceled");
    expect(result.moved).toBe(false);
    expect(timeline.mode).toBe("live");
    expect(timeline.position).toEqual(present);
    expect(reverse()!.searchedIntervals).toBeUndefined();
    expect(controller.cancelReverseContinue()).toBe(false);
    await controller.stop();
    expect(reverse()).toBeUndefined();
  }, 600_000);

  it("reports a desync once, on the status bar's state and in the output pane (D9)", async () => {
    const session = (await createSp48Session()).bootToBasic();
    const program = await session.loadCode(PROGRAM);
    session.poke(0x9600, 0);
    session.machine.pc = program.symbol("Main");
    const store = withAdvancedDebugging(createAppStore("test-reverse-desync"));
    const sent: string[] = [];
    class RecordingMessenger extends ResolvingMessenger {
      protected override send(message: RequestMessage): void {
        sent.push(JSON.stringify(message));
        super.send(message);
      }
    }
    const controller = new MachineController(store, new RecordingMessenger(), session.machine as any);
    const debugSupport = session.attachDebugSupport();
    controller.debugSupport = debugSupport;
    controller.state = MachineControllerState.Paused;
    const paused = () => controller.state === MachineControllerState.Paused;
    const runLoops = async (n: number) => {
      const bp = { address: program.symbol("Loop"), exec: true, hitCount: n };
      debugSupport.resetHitCounts();
      debugSupport.addBreakpoint(bp);
      await controller.startDebug();
      await waitFor(paused, "the loop breakpoint");
      debugSupport.removeBreakpoint(bp);
    };
    await runLoops(30_000);
    // --- A byte changed behind the journal's back: the live run takes the other branch from here
    const raw = (controller.timeline as any).handle.raw;
    raw.sp48WriteMemory(0x9600, 1);
    await runLoops(30_000);
    controller.navigateHistory("back");
    expect(controller.timeline).toBeUndefined();
    expect(store.getState().emulatorState?.reverseDebug).toMatchObject({ active: false, mode: "live" });
    expect(store.getState().emulatorState?.reverseDebug?.desync).toMatch(/diverged/);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sent.filter((m) => m.includes("Reverse debugging stopped")).length).toBe(1);
    await controller.stop();
  }, 600_000);
});
