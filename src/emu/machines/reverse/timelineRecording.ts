/*
 * A timeline snapshot as the parts of a debug recording, and back
 * (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` §4.2, D11, T5). The shapes match field for field; what
 * this adds is the breakpoint re-keying a load needs.
 */

import type {
  DebugRecording,
  RecordingJournalEntry,
  RecordingPosition
} from "@common/debugRecording/debugRecordingFile";
import type { DebugTimelineState } from "../DebugSupport";
import type { JournalEntry } from "./InputJournal";
import type { TimelineSnapshot } from "./Timeline";
import type { TimelinePosition } from "./timelinePosition";

/** The timeline parts of a recording */
export type RecordingTimelineParts = Pick<DebugRecording, "pages" | "keyframes" | "journal" | "hits" | "ring" | "present">;

/** A snapshot's timeline as recording parts */
export function snapshotToRecordingParts(snapshot: TimelineSnapshot): RecordingTimelineParts {
  return {
    pages: snapshot.pages,
    keyframes: snapshot.keyframes.map((k) => ({
      seed: k.seed,
      frame: k.frame,
      journalIndex: k.journalIndex,
      complete: k.complete,
      pages: k.pages,
      meta: jsonSafe(k.meta)
    })),
    journal: snapshot.journal as RecordingJournalEntry[],
    hits: snapshot.hits,
    ring: snapshot.present.ring,
    present: {
      host: jsonSafe(snapshot.present.host),
      debug: jsonSafe(snapshot.present.debug),
      frames: snapshot.present.frames
    }
  };
}

/** A recording's timeline as a snapshot */
export function recordingToSnapshot(
  recording: RecordingTimelineParts & { header: { present: RecordingPosition; cursor?: RecordingPosition; sparse: boolean } }
): TimelineSnapshot {
  if (!recording.ring) throw new Error("The debug recording has no history ring (RING section)");
  return {
    pages: recording.pages,
    keyframes: recording.keyframes.map((k) => ({
      seed: k.seed,
      frame: k.frame,
      journalIndex: k.journalIndex,
      complete: k.complete,
      pages: k.pages,
      meta: k.meta
    })),
    journal: recording.journal as JournalEntry[],
    hits: recording.hits,
    present: {
      position: recording.header.present,
      frames: recording.present.frames,
      host: recording.present.host,
      debug: recording.present.debug as DebugTimelineState | undefined,
      ring: recording.ring
    },
    cursor: recording.header.cursor,
    sparse: recording.header.sparse
  };
}

/**
 * Re-keys the breakpoint state a snapshot carries (T5): the keyframes' hit counters and the hit log
 * name breakpoints by storage key, and a breakpoint re-owned on load (D11) may get another key. A key
 * the map drops - `-nobreakpoints`, whose counters are for breakpoints that are not there - goes.
 * @param map An old key to its new key, or undefined to drop it
 */
export function rekeyTimelineSnapshot(snapshot: TimelineSnapshot, map: (key: string) => string | undefined): TimelineSnapshot {
  const debug = (state: DebugTimelineState | undefined): DebugTimelineState | undefined => {
    if (!state) return state;
    const hits: [string, number][] = [];
    for (const [key, count] of state.hits ?? []) {
      const to = map(key);
      if (to !== undefined) hits.push([to, count]);
    }
    return { hits, oneShots: state.oneShots ?? [] };
  };
  const hits: TimelineSnapshot["hits"] = [];
  // --- keptBefore[i]: the hits kept before index i - a dropped hit moves later hit-log indexes down
  const keptBefore = new Int32Array(snapshot.hits.length + 1);
  snapshot.hits.forEach((h, i) => {
    const key = map(h.key);
    if (key !== undefined) hits.push({ position: h.position, key });
    keptBefore[i + 1] = hits.length;
  });
  const kept = (index: number) => keptBefore[Math.max(0, Math.min(index, snapshot.hits.length))];
  return {
    ...snapshot,
    hits,
    keyframes: snapshot.keyframes.map((k) => {
      const meta = k.meta as { debug?: DebugTimelineState; hitLogIndex?: number } | undefined;
      if (!meta) return k;
      return { ...k, meta: { ...meta, debug: debug(meta.debug), hitLogIndex: kept(meta.hitLogIndex ?? 0) } };
    }),
    present: { ...snapshot.present, debug: debug(snapshot.present.debug) }
  };
}

/** The base keyframe's position: where a recording starts */
export function snapshotBase(snapshot: TimelineSnapshot): TimelinePosition {
  return snapshot.keyframes[0].seed.position;
}

/** Plain JSON: a structured value written to a file must read back the same */
function jsonSafe<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
