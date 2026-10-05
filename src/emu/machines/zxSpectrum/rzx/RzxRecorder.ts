/*
 * Records an RZX file on a ZX Spectrum machine (`.plans/RZX_PLAN.md` §4.3, D3, D9, D15, D16).
 *
 * The recording is a list of segments: a `.szx` snapshot (D15) and the frames recorded after it.
 *  - The first segment starts where the machine stood when recording started (D16: anywhere the
 *    machine is paused, including at the end of a playback).
 *  - Every 250 frames (5 s) an autosave starts a new segment, at a ULA frame end and an instruction
 *    boundary. The snapshot is taken before the frame's interrupt; the core then closes an empty
 *    frame when that interrupt is accepted before any fetch, so every player raises it first (a
 *    player starts a segment without an interrupt - Fuse bug #304's lesson, trap 10).
 *  - Autosaves are pruned as Fuse prunes them: all of them up to 15 s old, then one every 15 s up to
 *    a minute, one a minute up to 5 minutes, one every 5 minutes after that. Rollback points the user
 *    inserts are kept.
 *  - A rollback restores a point's snapshot, drops everything after it, and records on from there.
 *  - Saving finalises: the first snapshot and every frame in one input block.
 *
 * The recorder is driven by the machine's frame loop (`IRzxSession`); the snapshot captures and
 * restores need the machine idle, which it is between frames.
 */

import { writeSpectrumSnapshot } from "@common/spectrum/snapshot/writeSpectrumSnapshot";
import { parseSpectrumSnapshot } from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import type { SzxCreator } from "@common/spectrum/snapshot/szxWriter";
import { finaliseRzxFile } from "@common/spectrum/rzx/rzxFinalise";
import { writeRzxFile } from "@common/spectrum/rzx/rzxWriter";
import { RZX_VERSION_MAJOR, RZX_VERSION_MINOR, type RzxBlock, type RzxCreator, type RzxFile, type RzxFrame } from "@common/spectrum/rzx/rzxModel";
import { RZX_MODE_OFF, RZX_MODE_RECORD } from "./rzxCoreBridge";
import type { IRzxMachine, IRzxSession, RzxInstructionResult, RzxStop } from "./rzxSession";

/** Frames between autosaves: 5 seconds */
export const RZX_AUTOSAVE_FRAMES = 250;

const SECOND = 50;

/** One snapshot and the frames recorded after it */
export type RzxRecordedSegment = {
  /** The `.szx` snapshot the segment starts from */
  snapshot: Uint8Array;
  /** The frame tact at the segment's start */
  tstates: number;
  frames: RzxFrame[];
  /** The recording's frame count at the segment's start */
  startFrame: number;
  /** "start": the recording's first; "auto": an autosave; "user": an inserted rollback point */
  kind: "start" | "auto" | "user";
};

export type RzxRecorderOptions = {
  /** The program name and version written into the RZX creator block and the `.szx` snapshots */
  creator?: { name: string; major: number; minor: number };
  /** Frames between autosaves; 0 turns autosaving off */
  autosaveFrames?: number;
};

export class RzxRecorder implements IRzxSession {
  readonly mode = "record" as const;
  readonly frames = undefined;
  readonly segments: RzxRecordedSegment[] = [];
  private recorded = 0;
  private stopInfo?: RzxStop;
  private reported = false;
  private userPointPending = false;
  private readonly autosaveFrames: number;

  constructor(
    private readonly machine: IRzxMachine,
    private readonly options: RzxRecorderOptions = {}
  ) {
    this.autosaveFrames = options.autosaveFrames ?? RZX_AUTOSAVE_FRAMES;
  }

  get active(): boolean {
    return this.stopInfo === undefined;
  }

  /** Frames recorded so far */
  get frame(): number {
    return this.recorded;
  }

  get stop(): RzxStop | undefined {
    return this.stopInfo;
  }

  /** The rollback points, oldest first: the recording's start, autosaves and user points */
  get rollbackPoints(): { index: number; frame: number; kind: RzxRecordedSegment["kind"] }[] {
    return this.segments.map((s, index) => ({ index, frame: s.startFrame, kind: s.kind }));
  }

  /**
   * Starts recording at the machine's current state, which must be paused at an instruction boundary
   * @throws When the CPU stands inside a prefixed instruction (the caller retries after a step)
   */
  start(): void {
    const snapshot = this.capture();
    const core = this.machine.rzxCore;
    core.setMode(RZX_MODE_RECORD);
    this.segments.push({ ...snapshot, frames: [], startFrame: 0, kind: "start" });
  }

  runFastFrame(executeFrame: () => void): boolean {
    if (!this.active) return false;
    executeFrame();
    return this.afterRun(true);
  }

  beforeInstruction(): boolean {
    return this.active;
  }

  afterInstruction(): RzxInstructionResult {
    if (!this.active) return "stopped";
    if (this.machine.rzxCore.mode === RZX_MODE_OFF) {
      this.afterRun(false);
      return "stopped";
    }
    return "ran";
  }

  afterRun(frameCompleted: boolean): boolean {
    if (!this.active) return false;
    this.drain();
    const core = this.machine.rzxCore;
    if (core.overflow) {
      this.finish({
        kind: "overflow",
        frame: this.recorded,
        message:
          `RZX recording stopped at frame ${this.recorded}: the program read more IN values in one frame ` +
          `than the recorder can hold. Every complete frame is kept; save the recording now.`
      });
      return false;
    }
    if (frameCompleted && !core.closePending) {
      const sinceLast = this.recorded - this.segments[this.segments.length - 1].startFrame;
      if (this.userPointPending || (this.autosaveFrames > 0 && sinceLast >= this.autosaveFrames)) {
        this.startSegment(this.userPointPending ? "user" : "auto");
      }
    }
    return true;
  }

  interrupt(reason: string): void {
    if (!this.active) return;
    this.drain();
    this.finish({
      kind: "interrupted",
      frame: this.recorded,
      message: `RZX recording stopped at frame ${this.recorded}: ${reason}. Every complete frame is kept; save the recording now.`
    });
  }

  /** Ends the recording (Stop and Save) */
  end(): void {
    if (!this.active) return;
    this.drain();
    this.finish({ kind: "ended", frame: this.recorded, message: `RZX recording stopped after ${this.recorded} frames` });
  }

  takeStop(): RzxStop | undefined {
    if (!this.stopInfo || this.reported) return undefined;
    this.reported = true;
    return this.stopInfo;
  }

  /**
   * Asks for a rollback point. It is taken at the next ULA frame end, where a segment may start
   * (a point inside a frame would split it, and finalising would raise an interrupt there).
   */
  insertRollbackPoint(): void {
    this.userPointPending = true;
  }

  /**
   * Rolls back to a point: restores its snapshot, drops what was recorded after it and records on.
   * The machine must be paused.
   * @param back 1: the latest point, 2: the one before it, ...
   * @returns The frame the recording stands at
   */
  rollback(back = 1): number {
    if (!this.active) throw new Error("The recording has stopped");
    if (back < 1 || back > this.segments.length) {
      throw new Error(`There are ${this.segments.length} rollback points; cannot go back ${back}`);
    }
    const index = this.segments.length - back;
    const segment = this.segments[index];
    const core = this.machine.rzxCore;
    core.setMode(RZX_MODE_OFF);
    this.machine.loadSnapshotState(parseSpectrumSnapshot("rollback.szx", segment.snapshot));
    this.segments.length = index + 1;
    segment.frames = [];
    this.recorded = segment.startFrame;
    this.userPointPending = false;
    core.setMode(RZX_MODE_RECORD);
    return this.recorded;
  }

  /** The recording as an RZX model, unfinalised (every snapshot kept) */
  toRzxFile(): RzxFile {
    const blocks: RzxBlock[] = [];
    for (const s of this.segments) {
      blocks.push({ kind: "snapshot", extension: "szx", bytes: s.snapshot, compressed: true });
      blocks.push({ kind: "input", tstates: s.tstates, frames: s.frames, compressed: true });
    }
    return {
      major: RZX_VERSION_MAJOR,
      minor: RZX_VERSION_MINOR,
      flags: 0,
      creator: this.rzxCreator(),
      blocks,
      notes: []
    };
  }

  /** The finalised file (D3): the first snapshot and every frame in one input block */
  toFinalisedBytes(): Uint8Array {
    return writeRzxFile(finaliseRzxFile(this.toRzxFile()), { compress: true });
  }

  // --------------------------------------------------------------------------------------------

  private drain(): void {
    const frames = this.machine.rzxCore.drainRecordedFrames();
    if (frames.length === 0) return;
    const segment = this.segments[this.segments.length - 1];
    for (const f of frames) segment.frames.push(f);
    this.recorded += frames.length;
  }

  private startSegment(kind: "auto" | "user"): void {
    let snapshot: { snapshot: Uint8Array; tstates: number };
    try {
      snapshot = this.capture();
    } catch {
      // --- Inside a prefixed instruction: the next frame end tries again
      return;
    }
    this.userPointPending = false;
    this.machine.rzxCore.markBlockStart();
    this.segments.push({ ...snapshot, frames: [], startFrame: this.recorded, kind });
    this.prune();
  }

  private capture(): { snapshot: Uint8Array; tstates: number } {
    const state = this.machine.captureSnapshotState();
    const creator: SzxCreator | undefined = this.options.creator
      ? { name: this.options.creator.name, major: this.options.creator.major, minor: this.options.creator.minor }
      : undefined;
    return {
      snapshot: writeSpectrumSnapshot(state, "szx", creator).bytes,
      tstates: state.ula.frameTact ?? 0
    };
  }

  /**
   * Fuse's autosave pruning: keeps every autosave of the last 15 s, one per 15 s up to a minute, one
   * per minute up to 5 minutes, then one per 5 minutes. A dropped autosave's frames join the segment
   * before it, which continues from the same state.
   */
  private prune(): void {
    const now = this.recorded;
    const bucketOf = (age: number): number | undefined => {
      if (age <= 15 * SECOND) return undefined;
      if (age <= 60 * SECOND) return Math.floor(age / (15 * SECOND));
      if (age <= 300 * SECOND) return 100 + Math.floor(age / (60 * SECOND));
      return 1000 + Math.floor(age / (300 * SECOND));
    };
    const seen = new Set<number>();
    // --- Newest first, so each bucket keeps its newest autosave
    for (let i = this.segments.length - 1; i > 0; i--) {
      const s = this.segments[i];
      if (s.kind !== "auto") continue;
      const bucket = bucketOf(now - s.startFrame);
      if (bucket === undefined) continue;
      if (!seen.has(bucket)) {
        seen.add(bucket);
        continue;
      }
      const previous = this.segments[i - 1];
      previous.frames.push(...s.frames);
      this.segments.splice(i, 1);
    }
  }

  private rzxCreator(): RzxCreator {
    const c = this.options.creator ?? { name: "Klive IDE", major: 0, minor: 0 };
    return { name: c.name, major: c.major, minor: c.minor, custom: new Uint8Array(0) };
  }

  private finish(stop: RzxStop): void {
    if (this.stopInfo) return;
    this.stopInfo = stop;
    this.machine.rzxCore.setMode(RZX_MODE_OFF);
  }
}
