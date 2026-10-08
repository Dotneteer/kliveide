/*
 * Replay to a position (`.plans/REVERSE_DEBUGGING_PLAN.md` §4.2, D4, D9).
 *
 * To reach position *s*: restore the newest keyframe at or before *s*, put the recorder at its
 * position (rewinding the ring when it still holds it), then run the core's own fast frame loop with
 * the C stop target set to each journal entry in turn - applying it there - and finally to *s*. The
 * frame loop stops exactly at the target (D4), so replay runs at full speed and the TypeScript side
 * only steps in at journal entries.
 *
 * Replay checks itself (D9): with the recorder's verification on, every record it writes is compared
 * with the one the recorded run left in the same ring slot; with `verifyKeyframes`, the image is
 * compared with every keyframe the replay passes. A difference throws `ReplayDesyncError`.
 */

import type { InputJournal, JournalEntry } from "./InputJournal";
import type { Keyframe, KeyframeStore, MemoryRange } from "./KeyframeStore";
import { comparePositions, type HistoryPositionPort, type TimelinePosition } from "./timelinePosition";

/** What the engine needs from a core */
export interface ReplayCore {
  /** The core's linear memory */
  readonly memory: WebAssembly.Memory;
  readonly port: HistoryPositionPort;
  /** Runs the core's fast frame export once (`sp48ExecuteFrame`, `zxnextExecuteFrame`) */
  executeFrame(): void;
  /** Applies a journal entry through the unwrapped exports and memory */
  apply(entry: JournalEntry): void;
}

/** One replay's account */
export type ReplayResult = {
  keyframe: Keyframe;
  restoreMs: number;
  runMs: number;
  /** Frame-export calls made */
  frameCalls: number;
  /** Journal entries applied */
  applied: number;
  /** The journal index after the last entry applied: a fork keeps the entries before it */
  journalEnd: number;
  /** Records replayed (the target's sequence less the keyframe's) */
  records: number;
};

export type ReplayOptions = {
  /** Start from this keyframe instead of the newest one at or before the target */
  from?: Keyframe;
  /**
   * Apply only entries before this index (verifying a keyframe: the entries at its position that
   * came after it are not in it)
   */
  journalLimit?: number;
  /** Compare the image with every keyframe the replay passes (D9) */
  verifyKeyframes?: boolean;
  /** Bytes a keyframe comparison leaves out (the CPU's bus-event fields after a debug-loop run, T15) */
  verifyIgnore?: MemoryRange[];
  /**
   * Transient keyframes (§4.3): over the last `window` records before the target, `capture` is called
   * every `every` records, at an instruction boundary, with the journal index of the next entry to
   * apply - so the next Step Back replays only from there
   */
  checkpoints?: { every: number; window: number; capture(journalIndex: number): void };
  /** Called right after the keyframe restore (T5's proof fills the left-out scratch with garbage) */
  afterRestore?: () => void;
};

/** Thrown when replay cannot reach its target */
export class ReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayError";
  }
}

/** Thrown when a replay stops agreeing with the recorded run (D9): a bug, never a user error */
export class ReplayDesyncError extends ReplayError {
  constructor(
    /** Where the difference showed */
    readonly position: TimelinePosition,
    /** What found it: a ring record, a keyframe's pages, or an input that met the wrong position */
    readonly kind: "ring" | "keyframe" | "input",
    /** For `keyframe`: the differing 4 KiB pages */
    readonly pages: number[] = []
  ) {
    super(
      `Replay diverged at ${position.sequence}/${position.sub} (${kind}${pages.length ? `, page ${pages[0]}` : ""})`
    );
    this.name = "ReplayDesyncError";
  }
}

export class ReplayEngine {
  /** A safety limit on frame calls for one run (a target past the recorded end never arrives) */
  maxFrameCalls = 100_000;

  constructor(
    private readonly core: ReplayCore,
    private readonly store: KeyframeStore,
    private readonly journal: InputJournal
  ) {}

  /**
   * Runs the live core forward to `target` with its fast frame loop
   * @returns The number of frame calls
   * @throws ReplayDesyncError when the recorder's verification finds a difference on the way
   */
  runTo(target: TimelinePosition): number {
    const port = this.core.port;
    if (comparePositions(port.position, target) >= 0) return 0;
    let calls = 0;
    port.setTarget(target);
    try {
      while (!port.targetReached) {
        if (++calls > this.maxFrameCalls) {
          throw new ReplayError(
            `Replay did not reach ${target.sequence}/${target.sub} in ${this.maxFrameCalls} frames (at ${port.position.sequence}/${port.position.sub})`
          );
        }
        this.core.executeFrame();
      }
    } finally {
      port.clearTarget();
    }
    if (port.verifyMismatch) throw new ReplayDesyncError(port.position, "ring");
    return calls;
  }

  /**
   * Puts the core at `target`: a keyframe at or before it, then the journal
   * @throws ReplayError when there is no keyframe that early; ReplayDesyncError on a difference
   */
  replayTo(target: TimelinePosition, options: ReplayOptions = {}): ReplayResult {
    const journalLimit = options.journalLimit ?? this.journal.length;
    const keyframe = options.from ?? this.store.keyframeAtOrBefore(target);
    if (!keyframe) throw new ReplayError(`No keyframe at or before ${target.sequence}/${target.sub}: the timeline starts later`);
    const t0 = performance.now();
    this.restore(keyframe);
    options.afterRestore?.();
    const t1 = performance.now();
    let frameCalls = 0;
    let applied = 0;
    let journalEnd = keyframe.journalIndex;
    const entries = this.journal.entries;
    // --- Keyframes the replay passes, oldest first, to compare with on the way
    const checks = options.verifyKeyframes
      ? this.store.keyframes.filter(
          (k) =>
            comparePositions(k.seed.position, keyframe.seed.position) > 0 && comparePositions(k.seed.position, target) <= 0
        )
      : [];
    const port = this.core.port;
    // --- Transient keyframe points, oldest first
    const points: TimelinePosition[] = [];
    if (options.checkpoints && options.checkpoints.every > 0) {
      const { every, window } = options.checkpoints;
      const first = Math.max(keyframe.seed.position.sequence, target.sequence - window) + every;
      for (let seq = first; seq < target.sequence; seq += every) points.push({ sequence: seq, sub: 1, phase: 0 });
    }
    const checkpoint = (journalIndex: number) => {
      frameCalls += this.runTo(points.shift()!);
      options.checkpoints!.capture(journalIndex);
    };
    const verify = (k: Keyframe) => {
      frameCalls += this.runTo(k.seed.position);
      const pages = this.store.diffPages(k, this.core.memory.buffer, options.verifyIgnore);
      if (pages.length) throw new ReplayDesyncError(k.seed.position, "keyframe", pages);
    };
    // --- The live sources stay quiet while the journal speaks (D8)
    const mode = this.journal.mode;
    this.journal.mode = "mute";
    port.setVerify(true);
    try {
      for (let i = keyframe.journalIndex; i < journalLimit; i++) {
        const entry = entries[i];
        if (comparePositions(entry.position, target) > 0) break;
        // --- A keyframe before this entry, or at its position but taken before it was applied
        while (
          checks.length &&
          (comparePositions(checks[0].seed.position, entry.position) < 0 ||
            (comparePositions(checks[0].seed.position, entry.position) === 0 && i >= checks[0].journalIndex))
        ) {
          verify(checks.shift()!);
        }
        // --- A transient keyframe before this entry: taken before the entries at its position
        while (points.length && comparePositions(points[0], entry.position) <= 0) checkpoint(i);
        frameCalls += this.runTo(entry.position);
        if (comparePositions(port.position, entry.position) !== 0) {
          throw new ReplayDesyncError(port.position, "input");
        }
        this.core.apply(entry);
        applied++;
        journalEnd = i + 1;
      }
      while (checks.length) verify(checks.shift()!);
      while (points.length) checkpoint(journalEnd);
      frameCalls += this.runTo(target);
    } finally {
      port.setVerify(false);
      this.journal.mode = mode;
    }
    return {
      keyframe,
      restoreMs: t1 - t0,
      runMs: performance.now() - t1,
      frameCalls,
      applied,
      journalEnd,
      records: target.sequence - keyframe.seed.position.sequence
    };
  }

  /** Restores a keyframe: the image, then the recorder's position (T6) */
  restore(keyframe: Keyframe): void {
    this.store.restore(keyframe, this.core.memory.buffer);
    this.core.port.moveTo(keyframe.seed);
  }

  /**
   * D9's check between two keyframes: replays from `from` to the next keyframe's position and returns
   * the pages that differ from it (empty when the replay agrees)
   */
  verifyInterval(from: Keyframe, next: Keyframe, ignore: MemoryRange[] = []): { result: ReplayResult; diffPages: number[] } {
    const result = this.replayTo(next.seed.position, { from, journalLimit: next.journalIndex });
    return { result, diffPages: this.store.diffPages(next, this.core.memory.buffer, ignore) };
  }
}
