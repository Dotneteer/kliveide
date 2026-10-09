import { describe, expect, it } from "vitest";

import type { Channel, RequestMessage } from "@messaging/messages-core";
import createAppStore from "@state/store";
import { withAdvancedDebugging } from "../advanced-debugging-helper";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import type { ProfileTouchedByte } from "@common/profile/profileTypes";
import { createSp48Session } from "../harness/sp48";

/*
 * The access profile through the machine controller (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md`
 * D6, D10, T4), on the real 48K core with the reverse-debugging timeline:
 *
 * - stepping back 1,000 instructions and forward again (replays) leaves every flag and count alone;
 * - Step Into from the past replays without counting;
 * - Take over here keeps the abandoned future's counts and says how many instructions they were;
 * - the switch is the session's: on, off and the status go through the controller, and with the
 *   advanced-debugging switch off there is no profile at all.
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
      ld hl,$9000
      ei
Loop:
      inc (hl)
      ld a,(hl)
      inc l
      call Sub
      jr Loop
Sub:
      ld b,a
      ret
`;

async function waitPaused(controller: MachineController, what: string): Promise<void> {
  for (let i = 0; i < 200_000; i++) {
    if (controller.state === MachineControllerState.Paused) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`The machine did not pause (${what})`);
}

async function setUp(advanced = true) {
  const session = (await createSp48Session()).bootToBasic();
  const program = await session.loadCode(PROGRAM);
  session.machine.pc = program.symbol("Main");
  const store = createAppStore("test-profile");
  const controller = new MachineController(advanced ? withAdvancedDebugging(store) : store, new ResolvingMessenger(), session.machine as any);
  const debugSupport = session.attachDebugSupport();
  controller.debugSupport = debugSupport;
  controller.state = MachineControllerState.Paused;
  return { session, program, controller, debugSupport, store };
}

/** Every touched byte, as a comparable snapshot */
function snapshot(controller: MachineController): ProfileTouchedByte[] {
  return (controller.machine as any).readProfileTouched();
}

describe("the access profile through the controller", () => {
  it("is not there with the advanced-debugging switch off", async () => {
    const { controller } = await setUp(false);
    expect(controller.getProfileStatus()).toBeUndefined();
    expect(controller.setProfiling(true)).toBe(false);
  });

  it("switches on for the session, with counters by default, and publishes the state", async () => {
    const { controller, store } = await setUp();
    expect(controller.setProfiling(true)).toBe(true);
    expect(controller.getProfileStatus()).toMatchObject({ enabled: true, counters: true, abandonedInstructions: 0 });
    expect(store.getState().emulatorState.profiling).toEqual({ enabled: true, counters: true });
    const version = store.getState().emulatorState.profileVersion ?? 0;
    controller.resetProfile();
    expect(store.getState().emulatorState.profileVersion).toBeGreaterThan(version);
    controller.setProfiling(false);
    expect(store.getState().emulatorState.profiling).toEqual({ enabled: false, counters: true });
  });

  it("does not count replays: back 1,000, forward, Step Into from the past (T4, D10)", async () => {
    const { controller, program, debugSupport, session } = await setUp();
    controller.setProfiling(true);
    const stopAt = { address: program.symbol("Loop"), exec: true, hitCount: 20_000 };
    debugSupport.addBreakpoint(stopAt);
    await controller.startDebug();
    await waitPaused(controller, "the first breakpoint");
    debugSupport.removeBreakpoint(stopAt);
    for (let i = 0; i < 1200; i++) {
      await controller.stepInto();
      await waitPaused(controller, `step ${i}`);
    }
    const timeline = controller.timeline!;
    expect(timeline).toBeDefined();
    const present = snapshot(controller);
    const presentInfo = controller.getProfileStatus()!;
    expect(presentInfo.instructions).toBeGreaterThan(20_000);

    for (let k = 0; k < 1000; k++) expect(controller.navigateHistory("back").moved).toBe(true);
    expect(snapshot(controller)).toEqual(present);
    for (let k = 0; k < 50; k++) controller.navigateHistory("forward");
    expect(snapshot(controller)).toEqual(present);

    // --- Step Into from the past runs in replay mode: the present's counts stay as they are
    for (let k = 0; k < 20; k++) {
      await controller.stepInto();
      await waitPaused(controller, `step into ${k} from the past`);
    }
    expect(timeline.mode).toBe("navigating");
    expect(snapshot(controller)).toEqual(present);
    expect(controller.getProfileStatus()!.instructions).toBe(presentInfo.instructions);

    // --- Take over here: the abandoned future's counts stay, and the status says how many
    const abandoned = timeline.presentPosition.sequence - timeline.position.sequence;
    expect(abandoned).toBeGreaterThan(0);
    expect(await controller.takeOverHere()).toBe(true);
    expect(controller.getProfileStatus()!.abandonedInstructions).toBe(abandoned);
    expect(snapshot(controller)).toEqual(present);

    // --- The new future counts; a reset forgets the abandoned one too
    await controller.stepInto();
    await waitPaused(controller, "a step in the new future");
    expect(controller.getProfileStatus()!.instructions).toBe(presentInfo.instructions + 1);
    controller.resetProfile();
    expect(controller.getProfileStatus()!).toMatchObject({ abandonedInstructions: 0, instructions: 0 });
    void session;
    await controller.stop();
  }, 300_000);

  it("profiles one pass of a loop between its armed markers (PROFILER_PLAN D2)", async () => {
    const { controller, program, debugSupport, store } = await setUp();
    const loop = program.symbol("Loop");
    expect(controller.startProfiling({ calls: true, at: loop, until: loop })).toBe(true);
    expect(store.getState().emulatorState.profiling).toEqual({ enabled: true, counters: true, calls: true });
    expect(controller.getProfileStatus()).toMatchObject({ enabled: true, callsOn: true, armedStart: loop, armedStop: loop });

    const stopAt = { address: loop, exec: true, hitCount: 50 };
    debugSupport.addBreakpoint(stopAt);
    await controller.startDebug();
    await waitPaused(controller, "the loop's 50th pass");
    debugSupport.removeBreakpoint(stopAt);

    // --- The second arrival at Loop closed the window inside the core; the switch followed it
    const status = controller.getProfileStatus()!;
    expect(status).toMatchObject({ enabled: false, windowClosed: 1, armedStart: -1, armedStop: -1 });
    expect(store.getState().emulatorState.profiling?.enabled).toBe(false);
    // --- D5: a frame and the clock in the profile's unit
    expect(status.frameTicks).toBe(69888);
    expect(status.clockHz).toBe(3_500_000);
    // --- Exactly one pass: inc (hl), ld a,(hl), inc l, call Sub, Sub, jr Loop
    const machine = controller.machine as any;
    expect(machine.readProfileCounts(loop, 1).exec[0]).toBe(1);
    expect(machine.readProfileCounts(program.symbol("Sub"), 1).exec[0]).toBe(1);
    expect(status.instructions).toBe(7);
    const edges = machine.readProfileEdges();
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ callee: program.symbol("Sub"), calls: 1, inclusive: 4 + 10 });

    // --- Stopping keeps the data; a new start resets it
    expect(controller.stopProfiling()).toBe(true);
    expect(controller.getProfileStatus()!.instructions).toBe(7);
    controller.startProfiling();
    expect(controller.getProfileStatus()!).toMatchObject({ instructions: 0, callsOn: false, enabled: true });
    controller.stopProfiling();
    await controller.stop();
  }, 300_000);
});
