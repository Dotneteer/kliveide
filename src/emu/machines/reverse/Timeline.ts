/*
 * A reverse-debugging timeline (`.plans/REVERSE_DEBUGGING_PLAN.md` §4.2, D2, D5, D9, D12, D13, D16).
 *
 * One per debug session on a machine that has `MF_REVERSE_DEBUG`: the keyframe store, the input
 * journal, the hit log and the mode.
 *
 * - `live`: the machine runs at the present. Every input is journaled; `afterFrame` takes keyframes
 *   at an interval set by replay cost (D5); every breakpoint hit is logged with its position.
 * - `navigating`: the machine stands at a point in the past, which `replayTo` or `navigateTo` put it
 *   at. Live input is dropped (and counted). `returnToPresent` replays to where the live run stopped
 *   and goes live again; `fork` makes the current point the present and discards the future (D12).
 * - `replaying`: the machine runs from the past toward the present - a Continue or a step in the
 *   past (D11) - with breakpoints active and the journal supplying the input. The controller's run
 *   loop calls `onReplayTarget` whenever the core reaches the next journal entry; at the present the
 *   timeline goes live by itself. A stop before that (a breakpoint, a pause) is `pauseReplayRun`.
 *
 * While a replay runs, `isReplaying` is true: the controller's side-effect choke points check it
 * (D13). A desync ends the timeline at the last point known good (D9).
 *
 * Effects outside the machine (D13, D14, T4): the SD undo log (`SdUndoLog`) keeps what each sector the
 * machine writes held before, so a fork can put the host's card image back; host files a tape SAVE
 * wrote are noted, so a fork can say which of them belong to the future it discards.
 */

import { installJournal, type JournalHandle } from "./JournalingExports";
import { InputJournal } from "./InputJournal";
import { KeyframeStore, type Keyframe, type KeyframeStoreStats, type MemoryRange } from "./KeyframeStore";
import { ReplayDesyncError, ReplayEngine, type ReplayResult } from "./ReplayEngine";
import {
  comparePositions,
  HistoryPositionPort,
  type HistoryPositionExports,
  type RingSnapshot,
  type TimelinePosition
} from "./timelinePosition";
import { SdUndoLog, type SdRevertResult, type SdUndoEntry } from "./SdUndoLog";
import type { MessengerBase } from "@messaging/MessengerBase";
import { readWasmLayout } from "../state/wasmLayout";
import type { DebugTimelineState } from "../DebugSupport";

/** What a timeline needs of a machine */
export interface TimelineMachine {
  /** The core, as `exportContract.ts` names it */
  readonly reverseCoreId: string;
  /** The core runtime (`wasmV2Runtime`) */
  readonly reverseRuntime: { module: WebAssembly.Module; exports: object } | undefined;
  /** The core's fast frame export (`sp48ExecuteFrame`, `zxnextExecuteFrame`) */
  readonly reverseFrameExport: string;
  /** Whether the core stands at a frame boundary */
  isAtFrameBoundary(): boolean;
  /** The wrapper's own fields (T7) */
  captureHostState(): unknown;
  /**
   * After the core changed under it (a replay, a return to the present): the wrapper's fields from
   * `state`, its mirrors re-read from the core, no live push, queued keystrokes dropped (T7)
   */
  restoreHostState(state: unknown): void;
  /** Forget what was last pushed into the core, so the next frame pushes the live state (D8) */
  invalidateHostSync(): void;
  /** The CPU's speed as a multiple of its base clock: a frame's replay cost grows with it (D5) */
  readonly clockMultiplier?: number;
  /** Frames completed (keyframes and the present record it, so the IDE can say how far back is how long) */
  readonly frames?: number;
  /** The tact within the current frame, and the frame's length: the fraction of a frame */
  readonly currentFrameTact?: number;
  readonly tactsInFrame?: number;
  /**
   * A machine with an SD card logs every sector it writes in a live timeline here (D14); undefined
   * detaches the log when the timeline ends
   */
  attachSdUndoLog?(log: SdUndoLog | undefined): void;
}

/**
 * What a machine offers to undo a fork's effects outside itself (D13, D14); the controller calls it
 * after `fork`
 */
export interface ForkAwareMachine {
  /** Writes the old bytes of the discarded future's SD writes back to the card (D14) */
  revertSdWrites(entries: readonly SdUndoEntry[], messenger: MessengerBase): Promise<SdRevertResult>;
  /**
   * Hands every sector of the inserted disks to the write-back, so the host files follow the restored
   * in-core images (D13)
   * @returns true when there was something to write back
   */
  republishDisks(): boolean;
}

/** What a fork leaves behind outside the machine (D13, D14, T4) */
export type ForkResult = {
  /** SD writes of the discarded future, newest first: the machine writes their old bytes back */
  sdReverts: SdUndoEntry[];
  /** Host files a tape SAVE wrote in the discarded future: Klive does not delete them (T4) */
  hostFiles: string[];
};

/** What a fork from where the machine stands would leave behind (the fork confirmation, T4) */
export type ForkPreview = {
  /** SD sector writes the fork reverts */
  sdWrites: number;
  /** Host files written in the future that stay */
  hostFiles: string[];
};

/** What a timeline needs of the breakpoint store (D16) */
export interface TimelineDebugSupport {
  onHitCounted?: (key: string) => void;
  captureTimelineState(): DebugTimelineState;
  restoreTimelineState(state: DebugTimelineState, extraHits?: ReadonlyMap<string, number>): void;
}

export type TimelineMode = "live" | "navigating" | "replaying";

export type TimelineOptions = {
  /** The keyframe pool's budget (D6) */
  budgetBytes: number;
  /** A keyframe once the frames since the last one would take this long to replay (D5) */
  targetReplayMs?: number;
  /** ...but not more often than every this many frames */
  minFrames?: number;
  /** ...and at least every this many frames */
  maxFrames?: number;
  /** The replay cost of a frame at the base clock before a calibration measured it, in ms */
  initialMsPerFrame?: number;
  /** A calibration replay at the second keyframe, then at every this many (D5, D9) */
  calibrateEvery?: number;
  /** Transient keyframes (§4.3): one every this many records near a navigation target; 0: none */
  transientEvery?: number;
  /** ...over this many records before the target */
  transientWindow?: number;
  debugSupport?: TimelineDebugSupport;
  /**
   * Called just before the machine leaves the present for the past: the host's last chance to take
   * what the live run produced (unpublished tape saves and disk writes, D13)
   */
  beforeLeavePresent?: () => void;
};

/** What a keyframe keeps besides the image */
type KeyframeMeta = {
  host: unknown;
  debug?: DebugTimelineState;
  hitLogIndex: number;
};

/** One logged breakpoint hit */
type HitLogEntry = { position: TimelinePosition; key: string };

/** The present the timeline left: where it was and what the wrapper and the breakpoints held */
type Present = {
  position: TimelinePosition;
  /** Where the machine's frame counter stood, in frames (with the fraction of the frame in progress) */
  frames: number;
  /** Live input dropped before the present was left */
  dropped: number;
  journalLength: number;
  host: unknown;
  debug?: DebugTimelineState;
  /** The ring as the present had it: navigation puts it back, so the history stays whole (D17) */
  ring: RingSnapshot;
};

export class Timeline {
  readonly journal = new InputJournal();
  /** The SD card's writes in this timeline, with the bytes they replaced (D14) */
  readonly sdUndo = new SdUndoLog(() => this.journal.length);
  /** Host files a tape SAVE wrote, with the position the machine stood at (T4) */
  private readonly hostFiles: { position: TimelinePosition; name: string }[] = [];
  readonly store: KeyframeStore;
  readonly port: HistoryPositionPort;
  private readonly engine: ReplayEngine;
  private readonly handle: JournalHandle;
  private readonly hitLog: HitLogEntry[] = [];
  private readonly targetReplayMs: number;
  private readonly minFrames: number;
  private readonly maxFrames: number;
  private readonly transientEvery: number;
  private readonly transientWindow: number;
  private readonly calibrateEvery: number;
  /** The replay cost of a frame at the base clock, in ms: calibrated by replaying an interval (D5) */
  private msPerFrame: number;
  private calibrated = false;
  private keyframesSinceCalibration = 0;
  /** Frames since the last keyframe, each weighted by the clock multiplier it ran at */
  private weightedFrames = 0;
  private framesSinceKeyframe = 0;
  private present?: Present;
  private replaying = false;
  private ended = false;
  private _mode: TimelineMode = "live";
  private _lastDesync?: ReplayDesyncError;
  /** Where the machine stands while navigating (the ring header may show the present's view) */
  private at?: TimelinePosition;
  /** A replay run's next journal entry to apply */
  private nextEntry = 0;
  /** Where a replay run stops by itself short of the present (a Reverse Continue interval, D15) */
  private runLimit?: TimelinePosition;
  /**
   * The ring the history views see while navigating (D17): the present's, or - after a landing
   * older than anything the present's ring holds - the ring the replay regenerated up to that point
   */
  private viewRing?: RingSnapshot;

  /** Bytes a keyframe comparison leaves out (T15: the CPU's bus-event fields) */
  readonly verifyIgnore: MemoryRange[];

  private constructor(
    private readonly machine: TimelineMachine,
    private readonly debugSupport: TimelineDebugSupport | undefined,
    private readonly options: TimelineOptions
  ) {
    const runtime = machine.reverseRuntime;
    if (!runtime) throw new Error("The machine's core is not loaded");
    const layout = readWasmLayout(runtime.module);
    if (!layout) throw new Error(`The ${machine.reverseCoreId} core has no layout stamp`);
    const raw = runtime.exports as HistoryPositionExports & Record<string, (...a: number[]) => number>;
    this.port = new HistoryPositionPort(raw);
    // --- Keyframes at frame boundaries leave the core's frame-boundary scratch out (T5)
    this.store = new KeyframeStore({ layout, budgetBytes: options.budgetBytes, scratch: "layout" });
    this.handle = installJournal(runtime, machine.reverseCoreId, this.journal, this.port);
    const frame = this.handle.raw[machine.reverseFrameExport];
    if (typeof frame !== "function") throw new Error(`The core has no export '${machine.reverseFrameExport}'`);
    this.engine = new ReplayEngine(
      {
        memory: raw.memory,
        port: this.port,
        executeFrame: () => frame(),
        apply: (entry) => this.handle.apply(entry)
      },
      this.store,
      this.journal
    );
    const busFields = raw.z80HistoryBusEventFieldsPtr?.();
    this.verifyIgnore = busFields ? [{ address: busFields, size: raw.z80HistoryBusEventFieldsSize() }] : [];
    this.targetReplayMs = options.targetReplayMs ?? 100;
    this.minFrames = options.minFrames ?? 5;
    this.maxFrames = options.maxFrames ?? 50;
    this.msPerFrame = options.initialMsPerFrame ?? 4;
    this.calibrateEvery = options.calibrateEvery ?? 64;
    this.transientEvery = options.transientEvery ?? 2000;
    this.transientWindow = options.transientWindow ?? 20_000;
  }

  /**
   * Starts a timeline (D2): the recorder on, the base keyframe, an empty journal
   * @throws when the machine's core is not loaded or has no layout stamp
   */
  static start(machine: TimelineMachine, options: TimelineOptions): Timeline {
    const timeline = new Timeline(machine, options.debugSupport, options);
    timeline.port.setEnabled(true);
    timeline.attachHitLog();
    machine.attachSdUndoLog?.(timeline.sdUndo);
    timeline.takeKeyframe();
    return timeline;
  }

  get mode(): TimelineMode {
    return this._mode;
  }

  /** A replay is running: host side effects (tape and disk publishing, logpoints, audio, screen pushes) are off (D13) */
  get isReplaying(): boolean {
    return this.replaying || this._mode === "replaying";
  }

  /** The timeline has ended (`end`, or a desync) */
  get isEnded(): boolean {
    return this.ended;
  }

  /** Where the machine stands */
  get position(): TimelinePosition {
    return this._mode === "navigating" && this.at ? this.at : this.port.position;
  }

  /** Where the live run stopped: the current position while live */
  get presentPosition(): TimelinePosition {
    return this.present?.position ?? this.port.position;
  }

  /** Where the timeline starts: the oldest keyframe (it moves forward as the budget evicts) */
  get startPosition(): TimelinePosition | undefined {
    return this.store.keyframes[0]?.seed.position;
  }

  /** The last desync, if one ended the timeline */
  get lastDesync(): ReplayDesyncError | undefined {
    return this._lastDesync;
  }

  get stats(): KeyframeStoreStats & { journalEntries: number; droppedInputs: number; msPerFrame: number } {
    return {
      ...this.store.stats,
      journalEntries: this.journal.length,
      droppedInputs: this.journal.dropped,
      msPerFrame: this.msPerFrame
    };
  }

  /**
   * After every frame of a live run: takes a keyframe when one is due (D5). Keyframes are taken at
   * frame boundaries only.
   * @param frameCompleted Whether the frame that just ran completed
   */
  afterFrame(frameCompleted: boolean): void {
    if (this.ended || this._mode !== "live" || !frameCompleted) return;
    this.framesSinceKeyframe++;
    this.weightedFrames += Math.max(1, this.machine.clockMultiplier ?? 1);
    if (this.framesSinceKeyframe < this.minFrames) return;
    if (this.framesSinceKeyframe < this.maxFrames && this.weightedFrames * this.msPerFrame < this.targetReplayMs) return;
    if (!this.machine.isAtFrameBoundary()) return;
    const previous = this.lastLastingKeyframe();
    const weighted = this.weightedFrames;
    const keyframe = this.takeKeyframe();
    if (previous && (!this.calibrated || ++this.keyframesSinceCalibration >= this.calibrateEvery)) {
      this.calibrate(previous, keyframe, weighted);
    }
  }

  private lastLastingKeyframe(): Keyframe | undefined {
    const frames = this.store.keyframes;
    for (let i = frames.length - 1; i >= 0; i--) if (!frames[i].transient) return frames[i];
    return undefined;
  }

  /**
   * Replays the interval that ends at the new keyframe - which is the present, so the machine ends
   * where it was - and measures what a frame costs (D5). The replay checks itself against the
   * keyframe on the way (D9): a desync ends the timeline.
   */
  private calibrate(from: Keyframe, to: Keyframe, weightedFrames: number): void {
    this.replaying = true;
    try {
      const result = this.engine.replayTo(to.seed.position, { from, journalLimit: to.journalIndex });
      const pages = this.store.diffPages(to, this.memory.buffer, this.verifyIgnore);
      if (pages.length) throw new ReplayDesyncError(to.seed.position, "keyframe", pages);
      const measured = result.runMs / Math.max(1, weightedFrames);
      this.msPerFrame = this.calibrated ? 0.5 * this.msPerFrame + 0.5 * measured : measured;
      this.calibrated = true;
      this.keyframesSinceCalibration = 0;
    } catch (err) {
      if (err instanceof ReplayDesyncError) this.cutAtDesync(err);
      else throw err;
    } finally {
      this.replaying = false;
    }
  }

  /**
   * Takes a keyframe now. One at a frame boundary leaves the frame-boundary scratch out (T5); one
   * anywhere else keeps it.
   */
  takeKeyframe(): Keyframe {
    const meta: KeyframeMeta = {
      host: this.machine.captureHostState(),
      debug: this.debugSupport?.captureTimelineState(),
      hitLogIndex: this.hitLog.length
    };
    const keyframe = this.store.capture(this.memory.buffer, this.port.captureSeed(), this.machineFrames, this.journal.length, meta, {
      complete: !this.machine.isAtFrameBoundary()
    });
    this.framesSinceKeyframe = 0;
    this.weightedFrames = 0;
    return keyframe;
  }

  /** The machine's frame counter, with the fraction of the frame in progress */
  get machineFrames(): number {
    const m = this.machine;
    const fraction = m.tactsInFrame ? (m.currentFrameTact ?? 0) / m.tactsInFrame : 0;
    return (m.frames ?? 0) + Math.min(Math.max(fraction, 0), 1);
  }

  /** The present's frame counter (with its fraction): the machine's own while live */
  get presentFrames(): number {
    return this.present?.frames ?? this.machineFrames;
  }

  /** The frame counter at the timeline's start: its oldest lasting keyframe */
  get startFrames(): number | undefined {
    const first = this.store.keyframes.find((k) => !k.transient);
    return first?.frame;
  }

  /** Live input dropped since the machine left the present (D12) */
  get inputsIgnored(): number {
    return this.present ? this.journal.dropped - this.present.dropped : 0;
  }

  private get memory(): WebAssembly.Memory {
    return (this.machine.reverseRuntime!.exports as { memory: WebAssembly.Memory }).memory;
  }

  /**
   * Puts the machine at a position between the timeline's start and its present (D10): the
   * machine *is* in the past afterwards, every panel shows it. Leaving the present first remembers it.
   * @throws ReplayError when the position is before the timeline's start or after its present;
   * ReplayDesyncError when the replay diverged - the timeline has then ended at the last good point
   */
  replayTo(target: TimelinePosition): ReplayResult {
    this.assertActive();
    if (comparePositions(target, this.presentPosition) > 0) {
      throw new RangeError("The target is after the present: run forward instead");
    }
    if (this._mode === "replaying") throw new Error("A replay run is in progress");
    if (this._mode === "live") this.leavePresent();
    const result = this.runReplay(target, true);
    this.at = this.port.position;
    return result;
  }

  /**
   * G4.3's cursor moved to a record (D10): puts the machine where it was just before that record ran,
   * then gives the ring header the present's view back, so the history document and the walkers still
   * see the whole recorded run.
   * @param sequence The record whose "before" state to show
   * @throws as `replayTo`; RangeError when the ring no longer holds the record before it
   */
  navigateTo(sequence: number): ReplayResult {
    this.assertActive();
    if (this._mode === "replaying") throw new Error("A replay run is in progress");
    const repeat = this.port.recordRepeat(sequence - 1);
    if (repeat === undefined) throw new RangeError("The record before that one is no longer in the history");
    const target: TimelinePosition = { sequence: sequence - 1, sub: repeat, phase: 0 };
    if (comparePositions(target, this.presentPosition) > 0) throw new RangeError("The target is after the present");
    if (this._mode === "live") this.leavePresent();
    const result = this.runReplay(target, true);
    this.at = this.port.position;
    this.port.restoreRing(this.viewRing ?? this.present!.ring);
    return result;
  }

  /**
   * Puts the machine at a position older than anything the present's ring holds (a Reverse Continue
   * hit, D15): the ring the replay regenerated - ending there - becomes the history views' ring
   */
  landAt(position: TimelinePosition): ReplayResult {
    const result = this.replayTo(position);
    this.viewRing = this.port.snapshotRing();
    return result;
  }

  /** Whether the history views' ring holds a record (so the cursor can stand just after it) */
  viewHolds(sequence: number): boolean {
    return this.port.recordRepeat(sequence) !== undefined && this.port.recordRepeat(sequence + 1) !== undefined;
  }

  /**
   * Runs from the past toward the present (D11): the ring goes back to the machine's real position,
   * with verification on, and the core's stop target to the next journal entry. The controller runs
   * its loop, breakpoints active, and calls `onReplayTarget` when the target is reached.
   */
  startReplayRun(limit?: TimelinePosition): void {
    this.assertActive();
    if (this._mode !== "navigating" || !this.at) return;
    this.runLimit = limit && comparePositions(limit, this.presentPosition) < 0 ? limit : undefined;
    this.port.rewindTo(this.at);
    this.port.setVerify(true);
    this._mode = "replaying";
    this.nextEntry = this.appliedJournalEnd;
    this.armNext();
  }

  /**
   * After a frame of a replay run: when the core reached the stop target, applies the journal entries
   * there and arms the next one - or, at the present, goes live
   * @returns `"present"` when the timeline went live, `"desync"` when the replay diverged (the timeline
   * has ended), `"continue"` otherwise
   */
  onReplayTarget(): "continue" | "present" | "limit" | "desync" {
    if (this._mode !== "replaying" || !this.port.targetReached) return "continue";
    this.port.clearTarget();
    if (this.port.verifyMismatch) {
      this.cutAtDesync(new ReplayDesyncError(this.port.position, "ring"));
      return "desync";
    }
    const position = this.port.position;
    const entries = this.journal.entries;
    while (this.nextEntry < entries.length && comparePositions(entries[this.nextEntry].position, position) <= 0) {
      this.handle.apply(entries[this.nextEntry++]);
    }
    if (this.runLimit && comparePositions(position, this.runLimit) >= 0) {
      this.pauseReplayRun();
      return "limit";
    }
    if (comparePositions(position, this.presentPosition) >= 0) {
      this.port.setVerify(false);
      if (this.present) this.machine.restoreHostState(this.present.host);
      this.goLive();
      return "present";
    }
    this.armNext();
    return "continue";
  }

  /** A replay run stopped before the present (a breakpoint, a step, a pause): the machine stands there */
  pauseReplayRun(): TimelinePosition | undefined {
    if (this._mode !== "replaying") return undefined;
    this.runLimit = undefined;
    this.port.clearTarget();
    this.port.setVerify(false);
    this.at = this.port.position;
    this.appliedJournalEnd = this.nextEntry;
    this._mode = "navigating";
    // --- The views get their ring back - unless the run stopped older than anything it holds (T22):
    // --- then the ring the run regenerated, which ends here, is the views' ring, as after `landAt`
    const regenerated = this.port.snapshotRing();
    this.port.restoreRing(this.viewRing ?? this.present!.ring);
    if (!this.viewHolds(this.at.sequence)) {
      this.port.restoreRing(regenerated);
      this.viewRing = regenerated;
    }
    return this.at;
  }

  private armNext(): void {
    const entries = this.journal.entries;
    const next = this.nextEntry < entries.length ? entries[this.nextEntry].position : undefined;
    let target = this.runLimit ?? this.presentPosition;
    if (next && comparePositions(next, target) < 0) target = next;
    this.port.setTarget(target);
  }

  /**
   * The keyframe a Reverse Continue searches from next (D15): the newest one strictly before `end`
   */
  keyframeBefore(end: TimelinePosition): Keyframe | undefined {
    const frames = this.store.keyframes;
    for (let i = frames.length - 1; i >= 0; i--) {
      if (comparePositions(frames[i].seed.position, end) < 0) return frames[i];
    }
    return undefined;
  }

  /** Replays to the present and goes live again (D20's Return to Present) */
  returnToPresent(): ReplayResult | undefined {
    this.assertActive();
    if (this._mode === "live" || !this.present) return undefined;
    if (this._mode === "replaying") this.pauseReplayRun();
    const present = this.present;
    const result = this.runReplay(present.position, false);
    this.machine.restoreHostState(present.host);
    if (present.debug) this.debugSupport?.restoreTimelineState(present.debug);
    this.goLive();
    return result;
  }

  /**
   * A tape SAVE wrote a host file while live (T4): a fork that discards this moment cannot unwrite it,
   * so the fork confirmation lists it
   */
  noteHostFile(name: string): void {
    if (this.ended || this._mode !== "live") return;
    this.hostFiles.push({ position: this.port.position, name });
  }

  /** What a fork from where the machine stands would leave behind (T4); nothing while live */
  forkPreview(): ForkPreview {
    if (this.ended || this._mode === "live") return { sdWrites: 0, hostFiles: [] };
    const at = this.position;
    return {
      sdWrites: this.sdUndo.countFrom(this.forkJournalEnd),
      hostFiles: this.hostFiles.filter((f) => comparePositions(f.position, at) > 0).map((f) => f.name)
    };
  }

  /** The journal a fork keeps: what the machine has applied up to where it stands */
  private get forkJournalEnd(): number {
    return this._mode === "replaying" ? this.nextEntry : this.appliedJournalEnd;
  }

  /**
   * Makes the current point the present (D12's Take over here): the journal entries, keyframes and
   * logged hits after it go, and live input resumes
   * @returns What the discarded future did outside the machine: the SD writes to revert (the caller
   * writes them back, D14) and the host files it leaves (T4)
   */
  fork(): ForkResult {
    this.assertActive();
    if (this._mode === "live") return { sdReverts: [], hostFiles: [] };
    if (this._mode === "replaying") this.pauseReplayRun();
    const at = this.position;
    // --- The ring back to the machine's real position: what it records next is the new future
    this.port.rewindTo(at);
    this.port.setVerify(false);
    this.journal.truncate(this.appliedJournalEnd);
    this.store.dropAfter(at);
    this.store.dropTransient();
    const keep = this.hitLog.findIndex((h) => comparePositions(h.position, at) > 0);
    if (keep >= 0) this.hitLog.length = keep;
    const sdReverts = this.sdUndo.takeFrom(this.appliedJournalEnd);
    const firstGone = this.hostFiles.findIndex((f) => comparePositions(f.position, at) > 0);
    const hostFiles = firstGone < 0 ? [] : this.hostFiles.splice(firstGone).map((f) => f.name);
    this.goLive();
    return { sdReverts, hostFiles };
  }

  /** Ends the timeline (D2): the journal comes off the core, the keyframes go */
  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.port.clearTarget();
    this.port.setVerify(false);
    this.handle.dispose();
    this.machine.attachSdUndoLog?.(undefined);
    this.sdUndo.clear();
    if (this.debugSupport) this.debugSupport.onHitCounted = undefined;
    this.store.clear();
    this.journal.mode = "record";
  }

  // --- Internals -------------------------------------------------------------------------------------

  /** The journal index the last replay applied up to: a fork keeps the entries before it */
  private appliedJournalEnd = 0;

  private assertActive(): void {
    if (this.ended) throw new Error("The timeline has ended");
  }

  private attachHitLog(): void {
    if (!this.debugSupport) return;
    this.debugSupport.onHitCounted = (key) => {
      if (this._mode === "live" && !this.replaying) this.hitLog.push({ position: this.port.position, key });
    };
  }

  private leavePresent(): void {
    this.options.beforeLeavePresent?.();
    this.present = {
      position: this.port.position,
      frames: this.machineFrames,
      dropped: this.journal.dropped,
      journalLength: this.journal.length,
      host: this.machine.captureHostState(),
      debug: this.debugSupport?.captureTimelineState(),
      ring: this.port.snapshotRing()
    };
    this.journal.mode = "mute";
    this._mode = "navigating";
  }

  private goLive(): void {
    this.present = undefined;
    this.viewRing = undefined;
    this.at = undefined;
    this.journal.mode = "record";
    this._mode = "live";
    this.framesSinceKeyframe = 0;
    this.weightedFrames = 0;
    this.machine.invalidateHostSync();
  }

  private runReplay(target: TimelinePosition, transients: boolean): ReplayResult {
    this.replaying = true;
    let result: ReplayResult;
    const from = this.store.keyframeAtOrBefore(target);
    const baseMeta = from?.meta as KeyframeMeta | undefined;
    try {
      result = this.engine.replayTo(target, {
        from,
        checkpoints:
          transients && this.transientEvery > 0
            ? {
                every: this.transientEvery,
                window: this.transientWindow,
                // --- A transient keyframe answers for the host and breakpoint state as its base does:
                // --- the hit log from the base's index covers the hits between them
                capture: (journalIndex) =>
                  this.store.capture(this.memory.buffer, this.port.captureSeed(), this.machineFrames, journalIndex, baseMeta && { ...baseMeta }, {
                    complete: true,
                    transient: true
                  })
              }
            : undefined
      });
    } catch (err) {
      if (err instanceof ReplayDesyncError) this.cutAtDesync(err);
      throw err;
    } finally {
      this.replaying = false;
    }
    this.appliedJournalEnd = result.journalEnd;
    const meta = result.keyframe.meta as KeyframeMeta | undefined;
    if (meta) {
      this.machine.restoreHostState(meta.host);
      if (meta.debug) this.debugSupport?.restoreTimelineState(meta.debug, this.hitsBetween(meta.hitLogIndex, target));
    }
    return result;
  }

  /** The logged hits from a keyframe's log index up to a position, by definition */
  private hitsBetween(fromIndex: number, to: TimelinePosition): Map<string, number> {
    const hits = new Map<string, number>();
    for (let i = fromIndex; i < this.hitLog.length; i++) {
      const h = this.hitLog[i];
      if (comparePositions(h.position, to) > 0) break;
      hits.set(h.key, (hits.get(h.key) ?? 0) + 1);
    }
    return hits;
  }

  /** D9: the timeline ends where the replay stopped agreeing; the machine stays where it is */
  private cutAtDesync(err: ReplayDesyncError): void {
    this._lastDesync = err;
    this.end();
  }
}
