import { describe, expect, it } from "vitest";

import {
  copyRingRecords,
  decodeInterruptEvent,
  NEXT_INT_SOURCE_COUNT,
  NextIntEventKind,
  NextIntSource,
  type NextInterruptState,
  type NextIntEvent
} from "@common/zxnext/interrupts/interruptState";
import { buildInterruptsModel } from "@renderer/features/interrupts/interruptsViewModel";
import {
  buildTimelineView,
  heldFrames,
  latencies,
  latencyStats,
  type TimelineTiming
} from "@renderer/features/interrupts/timelineModel";

/**
 * The Interrupts panel's model and the Interrupt Timeline's model
 * (`dev/plans/NEXT_INTERRUPTS_DEBUGGING_PLAN.md` §3.3, §4.2): pure, so tested without a machine.
 */

function state(patch: (s: NextInterruptState) => void = () => undefined): NextInterruptState {
  const s: NextInterruptState = {
    hwIm2Mode: true,
    vectorBase: 0xa0,
    lastVector: 0xb6,
    intSignal: false,
    pulseActive: false,
    pulseLength: 32,
    lineInterrupt: 0,
    expansionBusEnabled: true,
    cpu: { im: 2, iff1: true, iff2: true, i: 0xbe, pc: 0x8010, sp: 0xff00 },
    interruptDepth: 0,
    sources: Array.from({ length: NEXT_INT_SOURCE_COUNT }, (_, index) => ({
      index,
      enabled: false,
      status: false,
      pending: false,
      inService: false,
      handler: 0x9000
    })),
    nmi: {
      state: "idle",
      pendingMultiface: false,
      pendingDivMmc: false,
      signal: false,
      stackless: false,
      stacklessArmed: false,
      returnAddress: 0,
      allowMultiface: false,
      allowDivMmc: false,
      ioTrap: false
    },
    recording: { enabled: false, count: 0, capacity: 65536 }
  };
  patch(s);
  return s;
}

const ids = (m: ReturnType<typeof buildInterruptsModel>) => m.diagnostics.map((d) => d.id);

describe("the Interrupts panel's model", () => {
  it("finds the blocker and hatches the rows below it", () => {
    const m = buildInterruptsModel(
      state((s) => {
        s.sources[NextIntSource.Line] = { ...s.sources[0], enabled: true, pending: true, inService: true };
        s.sources[NextIntSource.Ula] = { ...s.sources[11], enabled: true, pending: true, inService: true };
        s.sources[NextIntSource.Uart0Tx] = { ...s.sources[12], enabled: true, pending: true };
        s.interruptDepth = 2;
      })
    );
    expect(m.blocker).toBe(NextIntSource.Line);
    expect(m.rows[NextIntSource.Line].blocked).toBe(false);
    expect(m.rows[NextIntSource.Ula].blocked).toBe(true);
    expect(m.rows[NextIntSource.Ula].state).toBe("inService");
    expect(m.rows[NextIntSource.Uart0Tx].state).toBe("requesting");
    expect(m.rows[NextIntSource.Ula].vector).toBe(0xb6);
    expect(ids(m)).toEqual(["waiting"]);
  });

  it("reports a source stuck in service with no handler frame", () => {
    const m = buildInterruptsModel(
      state((s) => {
        s.sources[NextIntSource.Ula] = { ...s.sources[11], enabled: true, pending: true, inService: true };
      })
    );
    expect(m.diagnostics[0]).toMatchObject({ id: "stuck", severity: "error", args: { source: "ULA" } });
  });

  it("reports hardware IM2 mode with the CPU in IM 1", () => {
    const m = buildInterruptsModel(
      state((s) => {
        s.cpu.im = 1;
        s.sources[NextIntSource.Line] = { ...s.sources[0], enabled: true, pending: true };
      })
    );
    expect(ids(m)).toContain("im1");
    expect(m.usesVectorTable).toBe(false);
    expect(m.rows[0].handler).toBeUndefined();
  });

  it("reports an empty vector table entry only for a source that can fire", () => {
    const m = buildInterruptsModel(
      state((s) => {
        s.sources[NextIntSource.Ctc1] = { ...s.sources[4], enabled: true, handler: 0xffff };
        s.sources[NextIntSource.Ctc2] = { ...s.sources[5], enabled: false, handler: 0xffff };
      })
    );
    expect(m.diagnostics.filter((d) => d.id === "hole")).toEqual([
      { id: "hole", severity: "error", args: { source: "CTC 1", address: "$BEA8", handler: "$FFFF" } }
    ]);
  });

  it("reports polled mode, and pulse mode has no chain states", () => {
    const m = buildInterruptsModel(
      state((s) => {
        s.hwIm2Mode = false;
        s.sources[NextIntSource.Uart0Rx] = { ...s.sources[1], status: true };
        s.sources[NextIntSource.Ula] = { ...s.sources[11], enabled: true, status: true };
      })
    );
    expect(m.diagnostics.find((d) => d.id === "polled")?.args).toEqual({ sources: "UART 0 Rx", count: 1 });
    expect(m.rows[NextIntSource.Ula].state).toBe("statusSet");
    expect(m.rows[7].state).toBe("none");
    expect(m.blocker).toBeUndefined();
  });

  it("reports interrupts left disabled while sources wait, outside any handler", () => {
    const m = buildInterruptsModel(
      state((s) => {
        s.cpu.iff1 = false;
        s.sources[NextIntSource.Line] = { ...s.sources[0], enabled: true, pending: true };
        s.sources[NextIntSource.Ula] = { ...s.sources[11], enabled: true, pending: true };
      })
    );
    expect(m.diagnostics[0]).toMatchObject({ id: "disabled", severity: "warning", args: { count: 2, sources: "Line, ULA" } });
    // --- Inside a handler, interrupts are off by design
    const inHandler = buildInterruptsModel(
      state((s) => {
        s.cpu.iff1 = false;
        s.interruptDepth = 1;
        s.sources[NextIntSource.Line] = { ...s.sources[0], enabled: true, pending: true };
      })
    );
    expect(ids(inHandler)).not.toContain("disabled");
  });

  it("does not call a transmitter's empty-buffer status polled mode", () => {
    const m = buildInterruptsModel(
      state((s) => {
        s.sources[NextIntSource.Uart0Tx] = { ...s.sources[12], status: true };
        s.sources[NextIntSource.Uart1Tx] = { ...s.sources[13], status: true };
      })
    );
    expect(ids(m)).not.toContain("polled");
  });

  it("reports a pulse lost in the newest frames the ring holds", () => {
    const lost: NextIntEvent = {
      seq: 1, frame: 9, pos28: 0, kind: NextIntEventKind.Lost, source: NextIntSource.Ula, vector: 0xff, flags: 4, pc: 0, sp: 0
    };
    const m = buildInterruptsModel(state((s) => (s.hwIm2Mode = false)), [lost]);
    expect(m.diagnostics.find((d) => d.id === "lost")?.args).toEqual({ source: "ULA", frame: 9 });
  });
});

// ---------------------------------------------------------------------------------------------------

const TIMING: TimelineTiming = { totalHc: 456, totalVc: 311 }; // +3 timing at 50 Hz: 70,908 T a frame
const T = (t: number) => t * 8; // T-states as 28 MHz clocks

let seq = 0;
const e = (frame: number, t: number, kind: number, source: number, vector = 0xff): NextIntEvent => ({
  seq: seq++,
  frame,
  pos28: T(t),
  kind: kind as NextIntEvent["kind"],
  source,
  vector,
  flags: kind === NextIntEventKind.Request ? 0x01 : 0,
  pc: 0x8010,
  sp: 0xff00
});

describe("the Interrupt Timeline's model", () => {
  it("knows what the ring holds, and when its oldest frame is partial", () => {
    const events = [e(10, 5000, NextIntEventKind.Request, 11), e(12, 100, NextIntEventKind.Request, 11)];
    expect(heldFrames(events, 2, 100)).toMatchObject({ first: 10, last: 12, complete: 3, wrapped: false });
    expect(heldFrames(events, 200, 100)).toMatchObject({ complete: 2, wrapped: true, partialFrame: 10, partialFrom: T(5000) });
    expect(heldFrames([], 0, 100)).toEqual({ complete: 0, wrapped: false });
  });

  it("measures latency from the request, across a frame boundary too", () => {
    seq = 0;
    const events = [
      e(1, 70900, NextIntEventKind.Request, 11),
      e(2, 30, NextIntEventKind.Acknowledge, 11, 0xb6),
      e(2, 100, NextIntEventKind.Request, 0),
      e(2, 141, NextIntEventKind.Acknowledge, 0, 0xa0)
    ];
    const lat = latencies(events, TIMING);
    expect(lat.get(1)).toBe(70908 - 70900 + 30);
    expect(lat.get(3)).toBe(41);
    const stats = latencyStats(events, lat, heldFrames(events, 4, 100));
    expect(stats.map((s) => [s.source, s.max, s.late])).toEqual([
      [0, 41, 0],
      [11, 38, 0]
    ]);
  });

  it("draws a nested handler running and the interrupted one hatched", () => {
    seq = 0;
    const events = [
      e(5, 1000, NextIntEventKind.Acknowledge, 11, 0xb6),
      e(5, 2000, NextIntEventKind.Acknowledge, 0, 0xa0),
      e(5, 2500, NextIntEventKind.End, 0),
      e(5, 4000, NextIntEventKind.End, 11)
    ];
    const held = heldFrames(events, 4, 100);
    const view = buildTimelineView(events, TIMING, 5, 1, held, new Map());
    const running = view.segments.filter((s) => s.running).map((s) => [s.lane, s.a, s.b]);
    expect(running).toEqual([
      ["main", 0, 1000],
      ["ula", 1000, 2000],
      ["line", 2000, 2500],
      ["ula", 2500, 4000],
      ["main", 4000, 70908]
    ]);
    expect(view.segments.filter((s) => !s.running).map((s) => [s.lane, s.a, s.b])).toEqual([["ula", 2000, 2500]]);
    expect(view.markers).toHaveLength(4);
  });

  it("lays several frames on one axis and marks the overwritten start", () => {
    seq = 0;
    const events = [e(7, 3000, NextIntEventKind.Request, 11), e(8, 10, NextIntEventKind.Request, 11)];
    const held = heldFrames(events, 500, 100);
    const view = buildTimelineView(events, TIMING, 7, 2, held, new Map());
    expect(view.length).toBe(2 * 70908);
    expect(view.markers.map((m) => m.t)).toEqual([3000, 70908 + 10]);
    expect(view.gone).toEqual({ a: 0, b: 3000 });
  });
});

describe("the ring's records", () => {
  it("copies the held records oldest first, wrapping around the ring", () => {
    const capacity = 4;
    const ring = new Uint8Array(capacity * 16);
    // --- Records 0..5 written: slots hold 4, 5, 2, 3
    for (let n = 0; n < 6; n++) ring[(n % capacity) * 16] = n;
    const all = copyRingRecords(ring, capacity, 6);
    expect(all.firstSeq).toBe(2);
    expect([0, 1, 2, 3].map((i) => decodeInterruptEvent(all.records, i, 0).frame)).toEqual([2, 3, 4, 5]);
    const since = copyRingRecords(ring, capacity, 6, 5);
    expect(since.firstSeq).toBe(5);
    expect(decodeInterruptEvent(since.records, 0, 0).frame).toBe(5);
  });
});
