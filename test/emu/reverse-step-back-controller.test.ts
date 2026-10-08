import { describe, expect, it } from "vitest";

import type { Channel, RequestMessage } from "@messaging/messages-core";
import createAppStore from "@state/store";
import { withAdvancedDebugging } from "../advanced-debugging-helper";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import { readWasmLayout } from "@emu/machines/state/wasmLayout";
import { captureWasmImage } from "@emu/machines/state/wasmStateImage";
import type { TimelinePosition } from "@emu/machines/reverse/timelinePosition";
import { createSp48Session } from "../harness/sp48";

/*
 * Full reverse debugging through the machine controller (`.plans/REVERSE_DEBUGGING_PLAN.md` Phase 4),
 * on the real 48K core:
 *
 * - G4.3's Step Back now puts the machine itself in the past (D10): 1,000 steps back, and at every one
 *   the whole machine - registers, memory, devices, the picture - equals what the recorded forward
 *   run had at that point;
 * - Step Into from the past runs one instruction in replay mode (D11), Continue from the past stops
 *   at the same breakpoint the recorded run would have, and goes live at the present;
 * - Take over here (D12) discards the recorded future, and the new future is reachable like the old.
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

/** A busy loop with a DD-prefixed store, a call, and the ROM's IM 1 interrupt every frame */
const PROGRAM = `
      .org $8000
Main:
      ld ix,$9100
      ld hl,$9000
      ei
Loop:
      inc (hl)
      ld a,(hl)
      add a,l
      ld (ix+0),a
      inc l
      call Sub
      jr Loop
Sub:
      ld b,a
      ret
`;

const key = (p: TimelinePosition) => `${p.sequence}/${p.sub}/${p.phase}`;

/** The machine's whole state as a hash: volatile statics, the stack, the bus-event fields (T15) and the audio scratch (T5) out */
function stateHash(machine: { wasmV2Runtime?: any }): number {
  const runtime = machine.wasmV2Runtime;
  const image = captureWasmImage("sp48", runtime.module, runtime.exports.memory.buffer).image;
  const layout = readWasmLayout(runtime.module)!;
  image.fill(0, layout.stack!.address, layout.stack!.address + layout.stack!.size);
  for (const s of layout.scratch ?? []) image.fill(0, s.address, s.address + s.size);
  const bus = runtime.exports.z80HistoryBusEventFieldsPtr();
  image.fill(0, bus, bus + runtime.exports.z80HistoryBusEventFieldsSize());
  const words = new Uint32Array(image.buffer, image.byteOffset, image.byteLength >> 2);
  let h = 0x811c9dc5;
  for (let i = 0; i < words.length; i++) h = Math.imul(h ^ words[i], 0x01000193);
  return h >>> 0;
}

async function waitPaused(controller: MachineController, what: string): Promise<void> {
  for (let i = 0; i < 200_000; i++) {
    if (controller.state === MachineControllerState.Paused) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`The machine did not pause (${what})`);
}

async function setUp() {
  const session = (await createSp48Session()).bootToBasic();
  const program = await session.loadCode(PROGRAM);
  session.machine.pc = program.symbol("Main");
  const controller = new MachineController(withAdvancedDebugging(createAppStore("test-reverse")), new ResolvingMessenger(), session.machine as any);
  const debugSupport = session.attachDebugSupport();
  controller.debugSupport = debugSupport;
  controller.state = MachineControllerState.Paused;
  // --- Continue to a breakpoint some frames in: the run loop takes keyframes on the way
  const stopAt = { address: program.symbol("Loop"), exec: true, hitCount: 120_000 };
  debugSupport.addBreakpoint(stopAt);
  await controller.startDebug();
  await waitPaused(controller, "the first breakpoint");
  debugSupport.removeBreakpoint(stopAt);
  const timeline = controller.timeline!;
  expect(timeline).toBeDefined();
  expect(timeline.store.keyframes.length).toBeGreaterThan(2);
  return { session, program, controller, debugSupport, timeline };
}

/** Steps forward through the controller, logging every position's state */
async function stepForward(
  controller: MachineController,
  machine: any,
  count: number,
  log: Map<string, { hash: number; pc: number }>
): Promise<void> {
  const timeline = controller.timeline!;
  log.set(key(timeline.position), { hash: stateHash(machine), pc: machine.pc });
  for (let i = 0; i < count; i++) {
    await controller.stepInto();
    await waitPaused(controller, `step ${i}`);
    log.set(key(timeline.position), { hash: stateHash(machine), pc: machine.pc });
  }
}

describe("full reverse debugging through the controller (Phase 4)", () => {
  it("steps back 1,000 steps, each the whole machine as the forward run had it; forward and to the present again", async () => {
    const { session, controller, timeline } = await setUp();
    const forward = new Map<string, { hash: number; pc: number }>();
    await stepForward(controller, session.machine, 1300, forward);
    const present = timeline.position;
    const presentHash = stateHash(session.machine);

    let matched = 0;
    for (let k = 1; k <= 1000; k++) {
      const result = controller.navigateHistory("back");
      expect(result.moved, `step back ${k}`).toBe(true);
      expect(controller.historyCursor.memoryIsHistorical).toBe(true);
      const at = forward.get(key(timeline.position));
      expect(at, `step back ${k}: the forward run passed ${key(timeline.position)}`).toBeDefined();
      expect(stateHash(session.machine), `step back ${k}`).toBe(at!.hash);
      expect(session.machine.pc).toBe(at!.pc);
      // --- The cursor's record is the machine's next instruction
      expect(controller.historyCursor.state()!.record.regs.pc).toBe(session.machine.pc);
      matched++;
    }
    expect(matched).toBe(1000);

    // --- Step Forward walks the same points the other way
    for (let k = 0; k < 50; k++) {
      controller.navigateHistory("forward");
      expect(stateHash(session.machine)).toBe(forward.get(key(timeline.position))!.hash);
    }
    // --- Return to Present
    controller.navigateHistory("present");
    expect(timeline.mode).toBe("live");
    expect(timeline.position).toEqual(present);
    expect(stateHash(session.machine)).toBe(presentHash);
    expect(controller.historyCursor.memoryIsHistorical).toBe(false);
    await controller.stop();
  }, 300_000);

  it("Step Into and Continue from the past replay toward the present; Take over here forks", async () => {
    const { session, program, controller, debugSupport, timeline } = await setUp();
    const forward = new Map<string, { hash: number; pc: number }>();
    await stepForward(controller, session.machine, 400, forward);
    const presentHash = stateHash(session.machine);
    const journalAtPresent = timeline.journal.length;

    // --- Step Into from the past: one instruction in replay mode, the same state as the forward run
    for (let k = 0; k < 300; k++) controller.navigateHistory("back");
    for (let k = 0; k < 20; k++) {
      await controller.stepInto();
      await waitPaused(controller, `step into ${k}`);
      expect(timeline.mode).toBe("navigating");
      expect(stateHash(session.machine), `step into ${k} from the past`).toBe(forward.get(key(timeline.position))!.hash);
    }

    // --- Continue from the past to a breakpoint: where the recorded run met it first (off the
    // --- breakpoint's own address first, where a continue would stop at once)
    const sub = program.symbol("Sub");
    while (session.machine.pc === sub) {
      await controller.stepInto();
      await waitPaused(controller, "stepping off Sub");
    }
    const from = timeline.position.sequence;
    const firstSub = [...forward.entries()]
      .map(([k, v]) => ({ seq: Number(k.split("/")[0]), ...v }))
      .filter((e) => e.seq > from && e.pc === sub)
      .sort((a, b) => a.seq - b.seq)[0];
    const bp = { address: sub, exec: true };
    debugSupport.addBreakpoint(bp);
    await controller.startDebug();
    await waitPaused(controller, "the breakpoint in the past");
    expect(timeline.mode).toBe("navigating");
    expect(session.machine.pc).toBe(sub);
    expect(timeline.position.sequence).toBe(firstSub.seq);
    expect(stateHash(session.machine)).toBe(firstSub.hash);
    debugSupport.removeBreakpoint(bp);

    // --- Step into the present: live again, and the machine is the present's
    while (timeline.mode !== "live") {
      await controller.stepInto();
      await waitPaused(controller, "stepping to the present");
    }
    expect(stateHash(session.machine)).toBe(presentHash);
    expect(timeline.journal.length).toBe(journalAtPresent);

    // --- Take over 200 steps back: the future goes; a new one is recorded
    for (let k = 0; k < 200; k++) controller.navigateHistory("back");
    const forkAt = timeline.position;
    const forkHash = stateHash(session.machine);
    expect(await controller.takeOverHere()).toBe(true);
    expect(timeline.mode).toBe("live");
    expect(controller.historyCursor.position).toBe(0);
    expect(timeline.store.keyframes.every((k) => k.seed.position.sequence <= forkAt.sequence)).toBe(true);
    // --- A journaled edit, then new steps: a future the old run never had
    session.machine.doWriteMemory(0x9100, 0xee);
    const newFuture = new Map<string, { hash: number; pc: number }>();
    await stepForward(controller, session.machine, 60, newFuture);
    const newPresentHash = stateHash(session.machine);
    // --- Back through the new future, and on past the fork into the old past
    for (let k = 0; k < 40; k++) {
      controller.navigateHistory("back");
      expect(stateHash(session.machine), `back ${k} in the new future`).toBe(newFuture.get(key(timeline.position))!.hash);
    }
    while (timeline.position.sequence > forkAt.sequence) controller.navigateHistory("back");
    controller.navigateHistory("back");
    expect(stateHash(session.machine), "before the fork point").toBe(forward.get(key(timeline.position))!.hash);
    void forkHash;
    controller.navigateHistory("present");
    expect(stateHash(session.machine)).toBe(newPresentHash);
    await controller.stop();
  }, 300_000);
});
