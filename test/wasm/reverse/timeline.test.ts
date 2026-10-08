/*
 * The reverse-debugging timeline (`.plans/REVERSE_DEBUGGING_PLAN.md` Phase 2, `reverse/Timeline.ts`)
 * on the real 48K and Next cores:
 *
 * - stepping back to past positions puts the whole machine where it was (every panel would show it);
 * - Return to Present comes back to exactly the live state; Take over here (fork) drops the future;
 * - keyframes come at the adaptive interval (D5);
 * - hit counters follow the timeline, and a breakpoint with "every 3rd hit" stops at the same hits
 *   after a step back and a fork as in the recorded run (D16, T8);
 * - a deliberately unjournaled change is caught by the replay's self-check and ends the timeline (D9).
 */
import { describe, expect, it } from "vitest";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { ReplayDesyncError } from "@emu/machines/reverse/ReplayEngine";
import { Timeline } from "@emu/machines/reverse/Timeline";
import { comparePositions, positionAfter, type TimelinePosition } from "@emu/machines/reverse/timelinePosition";
import { readWasmLayout } from "@emu/machines/state/wasmLayout";
import { captureWasmImage } from "@emu/machines/state/wasmStateImage";
import { createSp48Session, type Sp48TestSession } from "../../harness/sp48";
import { createSession as createNextSession } from "../../harness/zxnext";
import { seededRandom } from "../../harness/reverseSupport";
import { expectSameBytes } from "../../expectBytes";

/**
 * A program that HALTs every frame, counts at $9000, adds the byte at $9100 (the desync test pokes
 * it behind the journal's back), stores the sum and the keyboard, and branches on a key.
 */
const PROGRAM = `
      .org $8000
Main:
      ld hl,$9000
Loop:
      halt
      ld a,($9100)
      ld b,a
Count:
      inc (hl)
      ld a,(hl)
      add a,b
      ld ($9001),a
      in a,($fe)
      ld ($9002),a
      bit 0,a
      jr z,Loop
      nop
      jr Loop
`;

type Machine = Sp48TestSession["machine"];

async function sp48WithProgram() {
  const s = await createSp48Session();
  s.bootToBasic();
  const program = await s.loadCode(PROGRAM);
  s.poke(0x9100, 0);
  s.machine.pc = program.symbol("Main");
  const debugSupport = s.attachDebugSupport();
  s.machine.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;
  return { s, program, debugSupport };
}

/**
 * The image replay must reproduce: volatile statics, the stack and the CPU's bus-event fields out, and
 * the audio buffers' scratch, whose tails past the frame's samples are leftovers nothing reads (T5).
 * The picture stays in: a step back shows the past screen (D18).
 */
function image(machine: Machine): Uint8Array {
  const runtime = machine.wasmV2Runtime!;
  const out = captureWasmImage("sp48", runtime.module, runtime.exports.memory.buffer).image;
  const layout = readWasmLayout(runtime.module)!;
  const stack = layout.stack!;
  out.fill(0, stack.address, stack.address + stack.size);
  for (const s of layout.scratch ?? []) if (s.symbol !== "sp48PixelBuffer") out.fill(0, s.address, s.address + s.size);
  const bus = runtime.exports.z80HistoryBusEventFieldsPtr();
  out.fill(0, bus, bus + runtime.exports.z80HistoryBusEventFieldsSize());
  return out;
}

/** One frame as the controller runs it in a debug session, then the timeline's keyframe check */
function frame(machine: Machine, timeline: Timeline): FrameTerminationMode {
  const termination = machine.executeMachineFrame();
  timeline.afterFrame(termination === FrameTerminationMode.Normal && machine.frameJustCompleted);
  return termination;
}

describe("reverse debugging: the timeline", () => {
  it("48K: steps back exactly, returns to the present, forks", async () => {
    const { s, debugSupport } = await sp48WithProgram();
    const timeline = Timeline.start(s.machine, { budgetBytes: 1 << 28, debugSupport, minFrames: 2, maxFrames: 6 });
    const rnd = seededRandom(5);
    const saved: { position: TimelinePosition; image: Uint8Array }[] = [];
    let held = false;
    for (let f = 0; f < 120; f++) {
      if (f % 9 === 4) {
        held = !held;
        held ? s.keyDown("Space") : s.keyUp("Space");
      }
      frame(s.machine, timeline);
      // --- Some points mid-frame too: a few hundred instructions into the next frame
      if (f % 11 === 5) {
        s.machine.executionContext.debugStepMode = DebugStepMode.StepInto;
        for (let i = 0; i < 1 + Math.floor(rnd() * 300); i++) s.machine.executeMachineFrame();
        s.machine.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;
      }
      // --- Not where the next frame's entry pushes a key change: several states share that position,
      // --- and a replay lands after the inputs there (what the next instruction sees)
      if (f % 7 === 3 && f % 9 !== 3) saved.push({ position: timeline.position, image: image(s.machine) });
    }
    const present = { position: timeline.position, image: image(s.machine) };
    expect(timeline.store.keyframes.length).toBeGreaterThanOrEqual(120 / 6);
    expect(timeline.journal.length).toBeGreaterThan(10);

    // --- Step back to saved points, in any order
    expect(saved.length).toBeGreaterThanOrEqual(12);
    for (const k of [9, 3, 11, 0, 6]) {
      const point = saved[k];
      timeline.replayTo(point.position);
      expect(timeline.mode).toBe("navigating");
      expect(timeline.position).toEqual(point.position);
      expectSameBytes(image(s.machine), point.image, `the machine at saved point ${k}`);
      // --- The wrapper reads the past too
      expect(s.machine.pc).toBe(s.machine.wasmV2Runtime!.exports.sp48GetCpuPc());
    }
    // --- Live input while in the past is dropped, and counted
    const dropped = timeline.journal.dropped;
    s.machine.wasmV2Runtime!.exports.sp48SetKeyStatus(0, 1);
    expect(timeline.journal.dropped).toBe(dropped + 1);

    timeline.returnToPresent();
    expect(timeline.mode).toBe("live");
    expect(timeline.position).toEqual(present.position);
    expectSameBytes(image(s.machine), present.image, "the machine back at the present");

    // --- Take over at saved point 10: the future goes, the past stays reachable
    timeline.replayTo(saved[10].position);
    timeline.fork();
    expect(timeline.mode).toBe("live");
    expect(timeline.store.keyframes.every((k) => comparePositions(k.seed.position, saved[10].position) <= 0)).toBe(true);
    for (let f = 0; f < 20; f++) frame(s.machine, timeline);
    timeline.replayTo(saved[4].position);
    expectSameBytes(image(s.machine), saved[4].image, "an earlier point after the fork");
    timeline.end();
  }, 60_000);

  it("48K: a fork names the host files the discarded future wrote, and the host hears before the present is left (T4, D13)", async () => {
    const { s, debugSupport } = await sp48WithProgram();
    let leaving = 0;
    const timeline = Timeline.start(s.machine, {
      budgetBytes: 1 << 28,
      debugSupport,
      minFrames: 2,
      maxFrames: 6,
      beforeLeavePresent: () => leaving++
    });
    for (let f = 0; f < 10; f++) frame(s.machine, timeline);
    timeline.noteHostFile("early.tzx");
    const point = timeline.position;
    for (let f = 0; f < 10; f++) frame(s.machine, timeline);
    timeline.noteHostFile("late1.tzx");
    for (let f = 0; f < 10; f++) frame(s.machine, timeline);
    timeline.noteHostFile("late2.tzx");
    expect(timeline.forkPreview()).toEqual({ sdWrites: 0, hostFiles: [] });

    timeline.replayTo(point);
    expect(leaving).toBe(1);
    // --- A replay does not save anything: notes in the past are ignored
    timeline.noteHostFile("replayed.tzx");
    expect(timeline.forkPreview()).toEqual({ sdWrites: 0, hostFiles: ["late1.tzx", "late2.tzx"] });
    // --- Moving within the past does not leave the present again
    timeline.replayTo({ ...point, sequence: point.sequence - 5 });
    expect(leaving).toBe(1);
    timeline.replayTo(point);
    expect(timeline.fork()).toEqual({ sdReverts: [], hostFiles: ["late1.tzx", "late2.tzx"] });
    // --- The fork point's own past keeps its files: a later fork does not name them
    for (let f = 0; f < 10; f++) frame(s.machine, timeline);
    timeline.replayTo(point);
    expect(leaving).toBe(2);
    expect(timeline.forkPreview().hostFiles).toEqual([]);
    timeline.end();
  });

  it("48K: repeated step backs replay from transient keyframes near the target (§4.3)", async () => {
    const { s, debugSupport } = await sp48WithProgram();
    // --- The program HALTs every frame, so a frame is a few hundred records: transient keyframes
    // --- every 50 records over the last 500
    const timeline = Timeline.start(s.machine, {
      budgetBytes: 1 << 28,
      debugSupport,
      minFrames: 10,
      maxFrames: 10,
      transientEvery: 50,
      transientWindow: 500
    });
    for (let f = 0; f < 40; f++) frame(s.machine, timeline);
    // --- Back to the middle of an interval: the first replay drops transient keyframes on its way
    const lasting = timeline.store.keyframes;
    const from = lasting[lasting.length - 2].seed.position.sequence;
    const to = lasting[lasting.length - 1].seed.position.sequence;
    let target: TimelinePosition = { sequence: from + Math.floor((to - from) * 0.8), sub: 1, phase: 0 };
    const first = timeline.replayTo(target);
    expect(first.keyframe.transient).toBe(false);
    expect(timeline.store.stats.transientKeyframes).toBeGreaterThan(3);
    const reference = image(s.machine);
    // --- The next step backs start from a transient keyframe at most 50 records back
    for (let i = 0; i < 5; i++) {
      target = { sequence: target.sequence - 1, sub: 1, phase: 0 };
      const step = timeline.replayTo(target);
      expect(step.keyframe.transient).toBe(true);
      expect(step.records).toBeLessThanOrEqual(50);
    }
    // --- ...and land exactly where a replay from a lasting keyframe does
    const exact = { sequence: target.sequence + 5, sub: 1, phase: 0 };
    timeline.replayTo(exact);
    expectSameBytes(image(s.machine), reference, "a transient keyframe's replay");
    timeline.returnToPresent();
    timeline.end();
  }, 60_000);

  it("48K: an 'every 3rd hit' breakpoint stops at the same hits after a step back and a fork (D16, T8)", async () => {
    const { s, program, debugSupport } = await sp48WithProgram();
    const bp = { address: program.symbol("Count"), exec: true, hitMode: "every" as const, hitCount: 3 };
    debugSupport.addBreakpoint(bp);
    const timeline = Timeline.start(s.machine, { budgetBytes: 1 << 28, debugSupport, minFrames: 2, maxFrames: 4 });
    const hits = () => debugSupport.listBreakpointsWithState().find((b) => b.address === bp.address)?.currentHits ?? 0;

    /** Continues until the next breakpoint stop; returns its position and the hit counter there */
    const nextStop = () => {
      for (let f = 0; f < 200; f++) {
        if (frame(s.machine, timeline) === FrameTerminationMode.DebugEvent) return { position: timeline.position, hits: hits() };
      }
      throw new Error("no stop");
    };
    const stops = [nextStop(), nextStop(), nextStop(), nextStop(), nextStop(), nextStop()];
    expect(stops.map((x) => x.hits)).toEqual([3, 6, 9, 12, 15, 18]);

    // --- Back to a few records after the third stop: the counter is what it was there
    const target = positionAfter(stops[2].position, 5);
    timeline.replayTo(target);
    expect(hits()).toBe(9);
    timeline.fork();
    expect(nextStop()).toEqual(stops[3]);
    expect(nextStop()).toEqual(stops[4]);
    expect(nextStop()).toEqual(stops[5]);
    timeline.end();
  }, 60_000);

  it("48K: a change the journal never saw is caught by the replay's self-check (D9)", async () => {
    const { s } = await sp48WithProgram();
    const timeline = Timeline.start(s.machine, { budgetBytes: 1 << 28, minFrames: 20, maxFrames: 50 });
    for (let f = 0; f < 10; f++) frame(s.machine, timeline);
    // --- The replay must cross the change: a keyframe before it, none after
    timeline.takeKeyframe();
    // --- Behind the journal's back: straight into the core's RAM
    const runtime = s.machine.wasmV2Runtime!;
    new Uint8Array(runtime.exports.memory.buffer)[runtime.exports.sp48MemoryPtr() + 0x9100] = 0x55;
    for (let f = 0; f < 2; f++) frame(s.machine, timeline);
    const target = timeline.position;
    let caught: unknown;
    try {
      timeline.replayTo(target);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ReplayDesyncError);
    expect((caught as ReplayDesyncError).kind).toBe("ring");
    expect(timeline.isEnded).toBe(true);
    expect(timeline.lastDesync).toBe(caught);
  }, 60_000);

  it("Next: keyframes follow replay cost, and a step back is exact", async () => {
    const s = await createNextSession();
    await s.loadCode(`
      .org $8000
start:
      nextreg $07,3
loop:
      inc a
      ld ($c000),a
      out ($fe),a
      jr loop
`);
    s.runFrames(2);
    const timeline = Timeline.start(s.machine, { budgetBytes: 1 << 28, minFrames: 2, maxFrames: 50, targetReplayMs: 30 });
    for (let f = 0; f < 6; f++) frame(s.machine as unknown as Machine, timeline);
    // --- A calibration replay measures what a frame costs; the interval follows it
    const mid = timeline.position;
    const midImage = new Uint8Array(captureWasmImage("zxnext", s.machine.wasmV2Runtime!.module, s.machine.wasmV2Runtime!.exports.memory.buffer).image);
    for (let f = 0; f < 4; f++) frame(s.machine as unknown as Machine, timeline);
    timeline.replayTo(mid);
    const after = captureWasmImage("zxnext", s.machine.wasmV2Runtime!.module, s.machine.wasmV2Runtime!.exports.memory.buffer).image;
    const stack = readWasmLayout(s.machine.wasmV2Runtime!.module)!.stack!;
    midImage.fill(0, stack.address, stack.address + stack.size);
    after.fill(0, stack.address, stack.address + stack.size);
    expectSameBytes(after, midImage, "the Next stepped back");
    timeline.returnToPresent();
    const before = timeline.store.keyframes.length;
    for (let f = 0; f < 60; f++) frame(s.machine as unknown as Machine, timeline);
    const taken = timeline.store.keyframes.length - before;
    // --- 30 ms of replay at 28 MHz is far less than 50 frames, and never under 2
    expect(taken).toBeGreaterThan(60 / 50);
    expect(taken).toBeLessThanOrEqual(60 / 2);
    expect(timeline.stats.msPerFrame).toBeGreaterThan(0);
    timeline.end();
  }, 60_000);
});
