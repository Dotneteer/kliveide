import {
  clocksPerT,
  NEXT_INT_SRC_NMI_DIVMMC,
  NEXT_INT_SRC_NMI_MULTIFACE,
  NEXT_INT_SRC_NMI_OTHER,
  NEXT_INT_SRC_UNKNOWN,
  NextIntEventKind,
  type NextIntEvent
} from "@common/zxnext/interrupts/interruptState";

/**
 * The Interrupt Timeline's model (`dev/plans/NEXT_INTERRUPTS_DEBUGGING_PLAN.md` §4.2): which frames the
 * ring holds (counted in events, D8, so the oldest may be partial), and for a view of 1-4 frames the
 * swimlane segments, the markers and each acknowledge's latency. Pure and text-free.
 *
 * Time is in CPU T-states at 3.5 MHz (the core's 28 MHz position / 8), relative to the view's first
 * frame, so a view of several frames is one axis.
 */

/** The lanes, top to bottom: the main program, then the sources in priority order, then the NMI */
export type LaneId = "main" | "line" | "uartRx" | "ctc" | "ula" | "uartTx" | "nmi";
export const LANES: LaneId[] = ["main", "line", "uartRx", "ctc", "ula", "uartTx", "nmi"];

export function laneOfSource(source: number): LaneId {
  if (source === 0) return "line";
  if (source === 1 || source === 2) return "uartRx";
  if (source >= 3 && source <= 10) return "ctc";
  if (source === 11) return "ula";
  if (source === 12 || source === 13) return "uartTx";
  if (source >= NEXT_INT_SRC_NMI_MULTIFACE && source <= NEXT_INT_SRC_NMI_OTHER) return "nmi";
  return "main";
}

export type TimelineTiming = {
  /** 7 MHz HCs per line and lines per frame */
  totalHc: number;
  totalVc: number;
};

/** A frame's length in 28 MHz clocks */
export function frameLength28(timing: TimelineTiming): number {
  return timing.totalHc * timing.totalVc * 4;
}

/** A 28 MHz position as 3.5 MHz T-states */
export const toT = (pos28: number) => pos28 / 8;

/** The beam line and HC of a position in a frame */
export function beamOf(pos28: number, timing: TimelineTiming): { line: number; hc: number } {
  const hcs = Math.floor(pos28 / 4);
  return { line: Math.floor(hcs / timing.totalHc), hc: hcs % timing.totalHc };
}

export type HeldFrames = {
  /** The oldest and newest frame with an event; undefined when the ring is empty */
  first?: number;
  last?: number;
  /** Frames from the oldest complete one to the newest */
  complete: number;
  /** The ring has wrapped: the oldest frame lost its earlier events */
  wrapped: boolean;
  /** That frame, when it did */
  partialFrame?: number;
  /** The first held position in the partial frame (28 MHz) */
  partialFrom?: number;
};

/**
 * What the ring holds. `count` is the core's count since the last clear and `capacity` its size; the
 * events are the held ones, oldest first.
 */
export function heldFrames(events: NextIntEvent[], count: number, capacity: number): HeldFrames {
  if (events.length === 0) return { complete: 0, wrapped: false };
  const first = events[0].frame;
  const last = events[events.length - 1].frame;
  const wrapped = count > capacity;
  if (!wrapped) return { first, last, complete: last - first + 1, wrapped };
  return {
    first,
    last,
    complete: Math.max(0, last - first),
    wrapped,
    partialFrame: first,
    partialFrom: events[0].pos28
  };
}

export type Segment = {
  lane: LaneId;
  source: number;
  /** Start and end, in T-states from the view's start */
  a: number;
  b: number;
  /** Running (solid) or in service while a nested handler runs (hatched) */
  running: boolean;
};

export type Marker = {
  lane: LaneId;
  event: NextIntEvent;
  /** T-states from the view's start */
  t: number;
  /** For an acknowledge: T-states from its request (undefined when the request is not held) */
  latency?: number;
  late: boolean;
};

export type TimelineView = {
  frames: number[];
  /** The view's length in T-states */
  length: number;
  frameT: number;
  segments: Segment[];
  markers: Marker[];
  /** The part of the view the ring no longer holds (a partial frame's start), in T-states */
  gone?: { a: number; b: number };
};

/** The article's budget: 0-22 T for the running instruction + 19 T of IM 2 acknowledge */
export const LATENCY_BUDGET_T = 41;

/** The T-state of an event on a common axis starting at frame `base` */
function axisT(e: NextIntEvent, base: number, frameT: number): number {
  return (e.frame - base) * frameT + toT(e.pos28);
}

/** 28 MHz clocks from `a` to `b` (later), across frame boundaries */
export function clocksBetween(a: NextIntEvent, b: NextIntEvent, timing: TimelineTiming): number {
  return (b.frame - a.frame) * frameLength28(timing) + b.pos28 - a.pos28;
}

/**
 * Pairs every acknowledge with its source's latest request before it, over all held events, and
 * returns each acknowledge's latency in the CPU's own T-states at the acknowledge's speed (by
 * sequence number): 19 T of IM 2 acknowledge are 19 T at 3.5 MHz and at 28 MHz alike.
 */
export function latencies(events: NextIntEvent[], timing: TimelineTiming): Map<number, number> {
  const lastReq = new Map<number, NextIntEvent>();
  const result = new Map<number, number>();
  for (const e of events) {
    if (e.kind === NextIntEventKind.Request && (e.flags & 0x01) !== 0) lastReq.set(e.source, e);
    else if (e.kind === NextIntEventKind.Acknowledge && e.source !== NEXT_INT_SRC_UNKNOWN) {
      const req = lastReq.get(e.source);
      if (req) {
        result.set(e.seq, clocksBetween(req, e, timing) / clocksPerT(e));
        lastReq.delete(e.source);
      }
    }
  }
  return result;
}

/**
 * The view of `count` frames starting at `firstFrame`: segments from each handler's acknowledge to its
 * END (or the view's end), hatched while a nested one runs; markers for every event in the view.
 */
export function buildTimelineView(
  events: NextIntEvent[],
  timing: TimelineTiming,
  firstFrame: number,
  count: number,
  held: HeldFrames,
  lat: Map<number, number>
): TimelineView {
  const frameT = toT(frameLength28(timing));
  const length = frameT * count;
  const lastFrame = firstFrame + count - 1;
  const frames = Array.from({ length: count }, (_, i) => firstFrame + i);
  const markers: Marker[] = [];
  const segments: Segment[] = [];

  // --- Replay the handlers from the oldest held event, so a handler entered before the view is open
  type Open = { source: number; lane: LaneId; since: number };
  const stack: Open[] = [];
  let mainSince = 0;
  const clip = (t: number) => Math.min(Math.max(t, 0), length);
  const emit = (lane: LaneId, source: number, a: number, b: number, running: boolean) => {
    const ca = clip(a);
    const cb = clip(b);
    if (cb > ca) segments.push({ lane, source, a: ca, b: cb, running });
  };
  for (const e of events) {
    if (e.frame > lastFrame) break;
    const t = axisT(e, firstFrame, frameT);
    const inView = e.frame >= firstFrame;
    if (e.kind === NextIntEventKind.Acknowledge || e.kind === NextIntEventKind.Nmi) {
      const lane = e.kind === NextIntEventKind.Nmi ? "nmi" : laneOfSource(e.source);
      const top = stack[stack.length - 1];
      if (top) emit(top.lane, top.source, top.since, t, true);
      else emit("main", -1, mainSince, t, true);
      // --- The interrupted handlers stay in service: hatched from here until they run again
      stack.push({ source: e.source, lane, since: t });
    } else if (e.kind === NextIntEventKind.End || e.kind === NextIntEventKind.NmiEnd) {
      const top = stack.pop();
      if (top) emit(top.lane, top.source, top.since, t, true);
      const next = stack[stack.length - 1];
      if (next) next.since = t;
      else mainSince = t;
    }
    if (inView) {
      const latency = e.kind === NextIntEventKind.Acknowledge ? lat.get(e.seq) : undefined;
      markers.push({
        lane: e.kind === NextIntEventKind.Nmi || e.kind === NextIntEventKind.NmiEnd ? "nmi" : laneOfSource(e.source),
        event: e,
        t,
        latency,
        late: latency !== undefined && latency > LATENCY_BUDGET_T
      });
    }
  }
  // --- Whatever is still running at the view's end
  const top = stack[stack.length - 1];
  if (top) emit(top.lane, top.source, top.since, length, true);
  else emit("main", -1, mainSince, length, true);

  // --- Hatching: while a handler runs, every handler below it on the stack is in service
  const hatched: Segment[] = [];
  {
    const replay: Open[] = [];
    for (const e of events) {
      if (e.frame > lastFrame) break;
      const t = axisT(e, firstFrame, frameT);
      if (e.kind === NextIntEventKind.Acknowledge || e.kind === NextIntEventKind.Nmi) {
        replay.push({ source: e.source, lane: e.kind === NextIntEventKind.Nmi ? "nmi" : laneOfSource(e.source), since: t });
      } else if (e.kind === NextIntEventKind.End || e.kind === NextIntEventKind.NmiEnd) {
        const done = replay.pop();
        if (done && replay.length > 0) {
          // --- The handlers under the one that ended were waiting for this whole span
          for (const under of replay) {
            const a = clip(done.since);
            const b = clip(t);
            if (b > a) hatched.push({ lane: under.lane, source: under.source, a, b, running: false });
          }
        }
      }
    }
  }

  const gone =
    held.wrapped && held.partialFrame !== undefined && held.partialFrame >= firstFrame && held.partialFrame <= lastFrame
      ? { a: (held.partialFrame - firstFrame) * frameT, b: (held.partialFrame - firstFrame) * frameT + toT(held.partialFrom ?? 0) }
      : undefined;
  return { frames, length, frameT, segments: [...segments, ...hatched], markers, gone };
}

export type LatencyStats = {
  source: number;
  taken: number;
  min: number;
  avg: number;
  max: number;
  jitter: number;
  late: number;
};

/** Per source, the latency of every acknowledge in the complete frames held (a partial frame never counts) */
export function latencyStats(events: NextIntEvent[], lat: Map<number, number>, held: HeldFrames): LatencyStats[] {
  const by = new Map<number, number[]>();
  for (const e of events) {
    if (e.kind !== NextIntEventKind.Acknowledge) continue;
    if (held.wrapped && e.frame === held.partialFrame) continue;
    const v = lat.get(e.seq);
    if (v === undefined) continue;
    const list = by.get(e.source) ?? [];
    list.push(v);
    by.set(e.source, list);
  }
  return [...by.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([source, list]) => {
      let min = Infinity;
      let max = -Infinity;
      let sum = 0;
      let late = 0;
      for (const v of list) {
        min = Math.min(min, v);
        max = Math.max(max, v);
        sum += v;
        if (v > LATENCY_BUDGET_T) late++;
      }
      return { source, taken: list.length, min, avg: sum / list.length, max, jitter: max - min, late };
    });
}

/** The NMI devices' names (product names, not translated) */
export function nmiDeviceName(source: number): string {
  if (source === NEXT_INT_SRC_NMI_MULTIFACE) return "Multiface";
  if (source === NEXT_INT_SRC_NMI_DIVMMC) return "DivMMC";
  return "NMI";
}
