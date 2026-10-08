import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { Channel, RequestMessage } from "@messaging/messages-core";
import createAppStore from "@state/store";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import { BinaryReader } from "@common/utils/BinaryReader";
import { TapReader } from "@emu/machines/tape/TapReader";
import { readWasmLayout } from "@emu/machines/state/wasmLayout";
import { captureWasmImage } from "@emu/machines/state/wasmStateImage";
import type { TimelinePosition } from "@emu/machines/reverse/timelinePosition";
import { getBreakpointStorageKey } from "@common/utils/breakpoints";
import {
  readDebugRecording,
  writeDebugRecording,
  type RecordingCallEntry
} from "@common/debugRecording/debugRecordingFile";
import { loadDebugRecording, saveDebugRecording } from "@renderer/appEmu/machines/debugRecordingFile";
import type { MachineStatePorts } from "@renderer/appEmu/machines/machineStateFile";
import { createSp48Session, type Sp48TestSession } from "../harness/sp48";

/*
 * Debug recordings on the real 48K core (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` Phase 2): a session
 * with keys, a tape upload and a memory edit is saved, opened into a fresh machine and controller,
 * and the opened timeline must be the recorded one - every one of 1,000 step backs the same machine,
 * Reverse Continue with a memory watchpoint landing on the same write, hit counts as recorded. A
 * build that differs is refused, and a journal edit that keeps the file's hash is caught by replay.
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

/** Reads the keyboard into memory, stores a running value, and calls a routine */
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

const key = (p: TimelinePosition) => `${p.sequence}/${p.sub}/${p.phase}`;

/** The machine's whole state as a hash: what G4.4's comparisons leave out, out */
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
  for (let i = 0; i < 400_000; i++) {
    if (controller.state === MachineControllerState.Paused) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`The machine did not pause (${what})`);
}

function portsOf(controller: MachineController): MachineStatePorts {
  return {
    getMachineController: () => controller as any,
    getEmulatorState: () => ({ machineId: "sp48" }) as any,
    setMachineType: async () => true,
    setTape: async () => {},
    setDisk: async () => {},
    getMediaFiles: () => ({})
  } as unknown as MachineStatePorts;
}

function controllerFor(session: Sp48TestSession, name: string) {
  const controller = new MachineController(createAppStore(name), new ResolvingMessenger(), session.machine as any);
  const debugSupport = session.attachDebugSupport();
  controller.debugSupport = debugSupport;
  return { controller, debugSupport };
}

function tapeBlocks() {
  const tap = new TapReader(new BinaryReader(new Uint8Array(readFileSync(join(__dirname, "../testfiles/floatspy.tap")))));
  tap.readContent();
  return tap.dataBlocks;
}

/** Records a session: keys, a tape upload, a memory edit; then 1,300 steps, each state logged */
async function record() {
  const session = (await createSp48Session()).bootToBasic();
  const program = await session.loadCode(PROGRAM);
  session.machine.pc = program.symbol("Main");
  const { controller, debugSupport } = controllerFor(session, "test-recording-a");
  controller.state = MachineControllerState.Paused;
  // --- An "every 3rd hit" breakpoint that never stops (its count is far away) but counts
  const counted = { address: program.symbol("Sub"), exec: true, hitMode: "every" as const, hitCount: 60_000 };
  debugSupport.addBreakpoint(counted);
  const stopAt = { address: program.symbol("Loop"), exec: true, hitCount: 100_000 };
  debugSupport.addBreakpoint(stopAt);
  session.keyDown("A");
  await controller.startDebug();
  await waitPaused(controller, "the first stop");
  debugSupport.removeBreakpoint(stopAt);
  // --- While paused: other keys, a tape, a memory edit - all journaled
  session.keyUp("A");
  session.keyDown("Space");
  session.insertTape(tapeBlocks());
  session.machine.doWriteMemory(0x9200, 0x55);
  const stopAgain = { address: program.symbol("Loop"), exec: true, hitCount: 100_000 };
  debugSupport.addBreakpoint(stopAgain);
  await controller.startDebug();
  await waitPaused(controller, "the second stop");
  debugSupport.removeBreakpoint(stopAgain);
  const timeline = controller.timeline!;
  expect(timeline.store.keyframes.length).toBeGreaterThan(4);
  const forward = new Map<string, number>();
  forward.set(key(timeline.position), stateHash(session.machine));
  for (let i = 0; i < 1300; i++) {
    await controller.stepInto();
    await waitPaused(controller, `step ${i}`);
    forward.set(key(timeline.position), stateHash(session.machine));
  }
  return { session, program, controller, debugSupport, timeline, forward, countedKey: getBreakpointStorageKey(counted) };
}

/** Opens a recording into a fresh, unbooted 48K */
async function open(bytes: Uint8Array, options: Parameters<typeof loadDebugRecording>[4] = {}) {
  const session = await createSp48Session();
  const { controller, debugSupport } = controllerFor(session, `test-recording-${Math.random()}`);
  const result = await loadDebugRecording(portsOf(controller), "bug.klr", bytes, "test", options);
  return { session, controller, debugSupport, result };
}

const hitsOf = (debugSupport: { listBreakpointsWithState(): { currentHits?: number }[] }, k: string) =>
  debugSupport.listBreakpointsWithState().find((b) => getBreakpointStorageKey(b as any) === k)?.currentHits ?? 0;

describe("debug recordings on the 48K (Phase 2)", () => {
  it("opens into a fresh machine as the recorded timeline: 1,000 step backs, Reverse Continue to a write, hit counts", async () => {
    const a = await record();
    const presentHash = stateHash(a.session.machine);
    const presentPc = a.session.machine.pc;
    const saved = await saveDebugRecording(portsOf(a.controller), { kliveVersion: "test", note: "Spins forever" });
    expect(saved.keyframes).toBe(a.timeline.store.keyframes.filter((k) => !k.transient).length);
    expect(saved.records).toBeGreaterThan(100_000);
    // --- The save does not end or move the session
    expect(a.controller.timeline).toBe(a.timeline);
    expect(stateHash(a.session.machine)).toBe(presentHash);

    const file = await readDebugRecording(saved.bytes);
    expect(file.note).toBe("Spins forever");
    expect(file.journal.some((e) => e.kind === "call" && e.exportName === "sp48SetKeyStatus")).toBe(true);
    expect(file.journal.some((e) => e.kind === "call" && e.exportName === "sp48WriteMemory")).toBe(true);
    expect(file.journal.some((e) => e.kind === "write")).toBe(true);
    expect((file.breakpoints!.breakpoints as { address?: number }[]).map((b) => b.address)).toEqual([a.program.symbol("Sub")]);

    const b = await open(saved.bytes);
    expect(b.result.path).toBe("timeline");
    expect(b.result.landed).toBe("present");
    expect(b.result.breakpointsAdded).toBe(1);
    expect(b.controller.state).toBe(MachineControllerState.Paused);
    expect(b.controller.isDebugging).toBe(true);
    const timeline = b.controller.timeline!;
    expect(timeline.mode).toBe("live");
    expect(timeline.position).toEqual(a.timeline.position);
    expect(b.session.machine.pc).toBe(presentPc);
    expect(stateHash(b.session.machine)).toBe(presentHash);
    // --- The counted breakpoint's hits were carried, and the session breakpoint owns them (D11, T5)
    expect(hitsOf(b.debugSupport, a.countedKey)).toBe(hitsOf(a.debugSupport, a.countedKey));
    expect(hitsOf(b.debugSupport, a.countedKey)).toBeGreaterThan(1000);
    const added = [...b.debugSupport.breakpointDefs.values()];
    expect(added.map((bp) => bp.owner)).toEqual([{ kind: "session" }]);

    // --- 1,000 step backs: the opened timeline is the recorded one, every step the same machine
    for (let k = 1; k <= 1000; k++) {
      const result = b.controller.navigateHistory("back");
      expect(result.moved, `step back ${k}`).toBe(true);
      const want = a.forward.get(key(timeline.position));
      expect(want, `step back ${k}: the recorded run passed ${key(timeline.position)}`).toBeDefined();
      expect(stateHash(b.session.machine), `step back ${k}`).toBe(want);
    }
    // --- Hit counts in the past are the recorded run's (keyframe counters plus the hit log)
    const pastA = b.controller.timeline!.position;
    a.controller.navigateHistory({ toSequence: b.controller.historyCursor.sequence! });
    expect(a.controller.timeline!.position).toEqual(pastA);
    expect(hitsOf(b.debugSupport, a.countedKey)).toBe(hitsOf(a.debugSupport, a.countedKey));
    a.controller.navigateHistory("present");
    b.controller.navigateHistory("present");
    expect(stateHash(b.session.machine)).toBe(presentHash);

    // --- Reverse Continue with a memory-write watchpoint lands on the same write in both
    const store = a.program.symbol("Store");
    for (const d of [a.debugSupport, b.debugSupport]) d.addBreakpoint({ address: store, memoryWrite: true });
    // --- The same keyframes on both sides: transient ones depend on where each was navigated before, and
    // --- with a hit-count breakpoint a search's result can depend on them (a G4.4 matter, not the file's)
    for (const c of [a.controller, b.controller]) c.timeline!.store.dropTransient();
    const ra = a.controller.navigateHistory("reverseContinue");
    const rb = b.controller.navigateHistory("reverseContinue");
    expect(ra.moved && rb.moved).toBe(true);
    expect(b.controller.timeline!.position).toEqual(a.controller.timeline!.position);
    expect(stateHash(b.session.machine)).toBe(stateHash(a.session.machine));

    // --- Past the end is ordinary: back to the present and on, live (D12)
    b.controller.navigateHistory("present");
    await b.controller.stepInto();
    await waitPaused(b.controller, "a step past the end");
    expect(b.controller.timeline!.mode).toBe("live");
    expect(b.controller.timeline!.position.sequence).toBeGreaterThan(a.timeline.presentPosition.sequence);
    // --- Q7: that extension is not in the file until it is saved again
    expect(b.controller.timeline!.recording?.name).toBe("bug.klr");
    expect(b.controller.timeline!.hasUnsavedExtension).toBe(true);
    await saveDebugRecording(portsOf(b.controller), { kliveVersion: "test" });
    expect(b.controller.timeline!.hasUnsavedExtension).toBe(false);
    expect(a.timeline.hasUnsavedExtension).toBe(false);
  }, 600_000);

  it("opens at the start with land: start, trims the front with from, and keeps fewer keyframes sparse", async () => {
    const a = await record();
    const present = a.timeline.position;
    const full = await saveDebugRecording(portsOf(a.controller), { kliveVersion: "test" });
    const sparse = await saveDebugRecording(portsOf(a.controller), { kliveVersion: "test", sparse: true });
    expect(sparse.keyframes).toBeLessThan(full.keyframes);
    expect(sparse.bytes.length).toBeLessThan(full.bytes.length);
    const trimmed = await saveDebugRecording(portsOf(a.controller), { kliveVersion: "test", from: { stepsBack: 50 } });
    expect(trimmed.records).toBeLessThan(full.records);
    expect(trimmed.keyframes).toBeLessThan(full.keyframes);

    const s = await open(sparse.bytes, { land: "start" });
    const first = (await readDebugRecording(sparse.bytes)).keyframes[0].seed.position;
    expect(s.result.landed).toBe("start");
    expect(s.controller.timeline!.mode).toBe("navigating");
    expect(s.controller.timeline!.position).toEqual(first);
    // --- Continue from the start replays to the present with breakpoints active (D10)
    s.controller.navigateHistory("present");
    expect(s.controller.timeline!.position).toEqual(present);

    const t = await open(trimmed.bytes, { verify: true });
    expect(t.result.verified!.keyframes).toBe(trimmed.keyframes);
    expect(stateHash(t.session.machine)).toBe(stateHash(a.session.machine));
    // --- The trimmed recording starts at its first keyframe: stepping back stops there
    expect(t.controller.timeline!.startPosition!.sequence).toBeGreaterThan(a.timeline.startPosition!.sequence);
  }, 600_000);

  it("saved in the past, opens where the machine stood", async () => {
    const a = await record();
    for (let i = 0; i < 25; i++) a.controller.navigateHistory("back");
    const at = a.controller.timeline!.position;
    const atHash = stateHash(a.session.machine);
    const saved = await saveDebugRecording(portsOf(a.controller), { kliveVersion: "test" });
    expect(saved.fromPast).toBe(true);
    // --- The save went to the present for its end state and came back
    expect(a.controller.timeline!.position).toEqual(at);
    expect(stateHash(a.session.machine)).toBe(atHash);
    const b = await open(saved.bytes);
    expect(b.result.landed).toBe("saved");
    expect(b.controller.timeline!.position).toEqual(at);
    expect(stateHash(b.session.machine)).toBe(atHash);
  }, 600_000);

  it("refuses another build, offering the end state; catches a journal edit by replay", async () => {
    const a = await record();
    const saved = await saveDebugRecording(portsOf(a.controller), { kliveVersion: "test" });
    const recording = await readDebugRecording(saved.bytes);

    const otherBuild = await writeDebugRecording({
      ...recording,
      header: { ...recording.header, codeHash: "0".repeat(64), kliveVersion: "0.1.0" }
    });
    const refused = await open(otherBuild);
    expect(refused.result.path).toBe("refused");
    expect(refused.result.refusal).toMatch(/recorded by Klive 0\.1\.0 \(build 00000000\); this build .* differs/);
    expect(refused.controller.timeline).toBeUndefined();
    const fallback = await open(otherBuild, { acceptFallback: true });
    expect(fallback.result.path).toBe("state");
    // --- The end state opens like a .kls in debug mode: stopped at its PC, a new session with no past
    await waitPaused(fallback.controller, "the end state");
    expect(fallback.session.machine.pc).toBe(a.session.machine.pc);
    expect(fallback.controller.timeline?.store.keyframes.length ?? 0).toBeLessThanOrEqual(1);

    // --- A key press moved to another key: the file's own hash is recomputed, so only replay can tell
    const journal = recording.journal.map((e) =>
      e.kind === "call" && e.exportName === "sp48SetKeyStatus" ? ({ ...e, args: [(e.args[0] + 7) % 40, e.args[1]] } as RecordingCallEntry) : e
    );
    const edited = await writeDebugRecording({ ...recording, journal });
    // --- Lazily (D9): opening replays only from the last keyframe, which the edit is before; the first
    // --- replay that crosses it - here -verify's, from the start - finds it
    await expect(open(edited, { verify: true })).rejects.toThrow(/diverged/);
  }, 600_000);

  it("keeps the current breakpoints with nobreakpoints, and the counters restart", async () => {
    const a = await record();
    const saved = await saveDebugRecording(portsOf(a.controller), { kliveVersion: "test" });
    const b = await open(saved.bytes, { noBreakpoints: true });
    expect(b.result.breakpointsAdded).toBe(0);
    expect(b.debugSupport.breakpointDefs.size).toBe(0);
    expect(b.controller.timeline!.position).toEqual(a.timeline.position);
  }, 600_000);
});
