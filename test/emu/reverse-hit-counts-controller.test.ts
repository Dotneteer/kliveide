import { describe, expect, it } from "vitest";

import type { Channel, RequestMessage } from "@messaging/messages-core";
import createAppStore from "@state/store";
import { withAdvancedDebugging } from "../advanced-debugging-helper";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import { getBreakpointStorageKey } from "@common/utils/breakpoints";
import { comparePositions, type TimelinePosition } from "@emu/machines/reverse/timelinePosition";
import { createSp48Session } from "../harness/sp48";

/*
 * Hit counts and reverse debugging (`.plans/REVERSE_DEBUGGING_PLAN.md` D15, D16), on the real 48K:
 *
 * - a step through a breakpoint with a hit-count rule counts each visit once (it counted twice: the
 *   step decided at the breakpoint's PC, and the next step decided there again);
 * - the counters a replay restores at a keyframe are the same whichever keyframe - lasting or
 *   transient, one sitting exactly on a logged hit included - the replay starts from;
 * - so Reverse Continue with a hit-count breakpoint lands in the same place however the transient
 *   keyframes happen to lie.
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

const PROGRAM = `
      .org $8000
Main:
      ld ix,$9100
      ld hl,$9000
      ei
Loop:
      inc (hl)
      ld a,$fe
      in a,($fe)
      ld (ix+0),a
      add a,l
      ld (Store),a
      inc l
      call Sub
      jr Loop
Sub:
      ld b,a
      ret
Store:
      .defb 0
`;

async function waitPaused(controller: MachineController, what: string): Promise<void> {
  for (let i = 0; i < 400_000; i++) {
    if (controller.state === MachineControllerState.Paused) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`The machine did not pause (${what})`);
}

async function setUp() {
  const session = (await createSp48Session()).bootToBasic();
  const program = await session.loadCode(PROGRAM);
  session.machine.pc = program.symbol("Main");
  const controller = new MachineController(withAdvancedDebugging(createAppStore("test-hit-counts")), new ResolvingMessenger(), session.machine as any);
  const debugSupport = session.attachDebugSupport();
  controller.debugSupport = debugSupport;
  controller.state = MachineControllerState.Paused;
  // --- Counts every call of Sub and never stops
  const counted = { address: program.symbol("Sub"), exec: true, hitMode: "every" as const, hitCount: 1_000_000 };
  debugSupport.addBreakpoint(counted);
  const stop = { address: program.symbol("Loop"), exec: true, hitCount: 100_000 };
  debugSupport.addBreakpoint(stop);
  await controller.startDebug();
  await waitPaused(controller, "the first stop");
  debugSupport.removeBreakpoint(stop);
  const key = getBreakpointStorageKey(counted);
  const hits = () => debugSupport.listBreakpointsWithState().find((b) => getBreakpointStorageKey(b) === key)?.currentHits ?? 0;
  return { session, program, controller, debugSupport, counted, key, hits };
}

describe("hit counts and reverse debugging", () => {
  it("counts a breakpoint once per visit when stepping through it", async () => {
    const { session, program, controller, hits } = await setUp();
    const before = hits();
    let visits = 0;
    for (let i = 0; i < 300; i++) {
      await controller.stepInto();
      await waitPaused(controller, `step ${i}`);
      if (session.machine.pc === program.symbol("Sub")) visits++;
    }
    expect(visits).toBeGreaterThan(20);
    expect(hits() - before).toBe(visits);
  }, 600_000);

  it("restores the same counters from every keyframe, one exactly on a logged hit included, and Reverse Continue agrees", async () => {
    const { session, program, controller, debugSupport, counted, key, hits } = await setUp();
    for (let i = 0; i < 300; i++) {
      await controller.stepInto();
      await waitPaused(controller, `step ${i}`);
    }
    const timeline = controller.timeline!;
    const present = timeline.position;
    const presentHits = hits();
    const log = (timeline as any).hitLog as { position: TimelinePosition; key: string }[];

    // --- A transient keyframe exactly where a hit was logged: a navigation replay drops them every
    // --- 2,000 records from 18,000 before its target (Timeline's defaults), so aim 18,000 past a hit
    const target = log.filter((h) => h.key === key && h.position.sequence < present.sequence - 40_000).at(-1)!;
    expect(controller.navigateHistory({ toSequence: target.position.sequence + 18_001 }).moved).toBe(true);
    controller.navigateHistory("present");
    const aligned = timeline.store.keyframes.find((k) => k.transient && comparePositions(k.seed.position, target.position) === 0);
    expect(aligned, "a transient keyframe on the logged hit").toBeDefined();

    // --- A stop exactly at a keyframe belongs to the interval that keyframe starts: Reverse Continue
    // --- finds it there (its run makes the decision at the keyframe itself)
    const countAtTarget = log.filter((h) => h.key === key).indexOf(target) + 1;
    debugSupport.removeBreakpoint(counted);
    debugSupport.addBreakpoint({ ...counted, hitMode: "eq", hitCount: countAtTarget });
    expect(controller.navigateHistory("reverseContinue").moved).toBe(true);
    expect(timeline.position).toEqual(target.position);
    controller.navigateHistory("present");
    debugSupport.removeBreakpoint({ ...counted, hitMode: "eq", hitCount: countAtTarget });
    debugSupport.addBreakpoint(counted);

    // --- Standing in the past at the breakpoint's PC, the visit is already counted: a step on from
    // --- there does not count it again
    controller.navigateHistory({ toSequence: target.position.sequence + 1 });
    expect(session.machine.pc).toBe(program.symbol("Sub"));
    const atSub = hits();
    expect(atSub).toBe(countAtTarget);
    await controller.stepInto();
    await waitPaused(controller, "a step in the past");
    expect(session.machine.pc).not.toBe(program.symbol("Sub"));
    expect(hits()).toBe(atSub);
    controller.navigateHistory("present");

    // --- From every keyframe, Reverse Continue's collect run reaches the present with its count
    for (const keyframe of timeline.store.keyframes) {
      (controller as any).collectBreakpointHits(keyframe.seed.position, present);
      expect(hits(), `from ${keyframe.seed.position.sequence}${keyframe.transient ? " (transient)" : ""}`).toBe(presentHits);
      controller.navigateHistory("present");
    }

    // --- A hit-count stop near the present: the same landing with these keyframes and with none
    debugSupport.removeBreakpoint(counted);
    debugSupport.addBreakpoint({ ...counted, hitMode: "eq", hitCount: presentHits - 3 });
    const first = controller.navigateHistory("reverseContinue");
    expect(first.moved).toBe(true);
    const landing = timeline.position;
    expect(session.machine.pc).toBe(program.symbol("Sub"));
    controller.navigateHistory("present");
    timeline.store.dropTransient();
    expect(controller.navigateHistory("reverseContinue").moved).toBe(true);
    expect(timeline.position).toEqual(landing);
    controller.navigateHistory("present");
    for (let i = 0; i < 37; i++) controller.navigateHistory("back");
    controller.navigateHistory("present");
    expect(controller.navigateHistory("reverseContinue").moved).toBe(true);
    expect(timeline.position).toEqual(landing);
  }, 900_000);
});
