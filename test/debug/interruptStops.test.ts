import { describe, expect, it } from "vitest";

import {
  buildInterruptWatch,
  describeInterruptStop,
  formatInterruptStop,
  matchesInterruptStop,
  parseInterruptStop
} from "@common/zxnext/interrupts/interruptStops";
import {
  NEXT_INT_SRC_NMI_DIVMMC,
  NEXT_INT_SRC_NMI_MULTIFACE,
  NextIntEventKind,
  NextIntSource,
  type NextIntEvent
} from "@common/zxnext/interrupts/interruptState";
import { getBreakpointDisplayKey } from "@common/utils/breakpoints";
import { breakpointKind } from "@common/utils/breakpoint-spec";
import { isEventBreakpoint, isInterruptStop } from "@common/utils/breakpoint-scope";
import { interruptStopFromForm } from "@renderer/appIde/utils/breakpoint-form";

/** Interrupt stops' pure parts (`dev/plans/NEXT_INTERRUPTS_DEBUGGING_PLAN.md` §5). */

const ev = (kind: number, source: number, extra: Partial<NextIntEvent> = {}): NextIntEvent => ({
  seq: 0,
  frame: 1,
  pos28: 100,
  kind: kind as NextIntEvent["kind"],
  source,
  vector: 0xff,
  flags: 0,
  pc: 0x8010,
  sp: 0xff00,
  ...extra
});

describe("interrupt stop specs", () => {
  it.each([
    ["ack", "ack"],
    ["ACK:ULA", "ack:ula"],
    ["lost:line", "lost:line"],
    ["retn", "retn"],
    ["reti", "reti"],
    ["wait:228", "wait:228"],
    ["wait:$E4:ctc0", "wait:228:ctc0"],
    ["nmi", "nmi"],
    ["nmi:DivMMC", "nmi:divmmc"]
  ])("%s normalizes to %s", (spec, normalized) => {
    const parsed = parseInterruptStop(spec);
    expect("error" in parsed).toBe(false);
    expect(formatInterruptStop(parsed as never)).toBe(normalized);
  });

  it.each([
    ["foo", "kind"],
    ["ack:ctc5", "source"],
    ["ack:nowhere", "source"],
    ["retn:ula", "extra"],
    ["nmi:esp", "nmiDevice"],
    ["wait", "waitLimit"],
    ["wait:0", "waitLimit"],
    ["wait:abc", "waitLimit"],
    ["ack:ula:x", "extra"]
  ])("%s is refused (%s)", (spec, error) => {
    expect(parseInterruptStop(spec)).toEqual({ error });
  });

  it("is an event breakpoint with its own key and kind", () => {
    const bp = { interruptStop: "ack:ula" };
    expect(isInterruptStop(bp)).toBe(true);
    expect(isEventBreakpoint(bp)).toBe(true);
    expect(getBreakpointDisplayKey(bp, {})).toBe("INT:ACK:ULA");
    expect(breakpointKind(bp)).toBe("interrupt");
  });
});

describe("the core watch", () => {
  it("is empty without stops", () => {
    expect(buildInterruptWatch([])).toEqual({ kinds: 0, ackSources: 0, nmiSources: 0, waitLimit: 0 });
  });

  it("ORs the kinds and sources, and takes the smallest wait limit", () => {
    const w = buildInterruptWatch([
      { kind: "ack", source: NextIntSource.Ula },
      { kind: "ack", source: NextIntSource.Line },
      { kind: "nmi", nmiDevice: "divmmc" },
      { kind: "wait", waitLimit: 500 },
      { kind: "wait", waitLimit: 228 }
    ]);
    expect(w.kinds).toBe((1 << NextIntEventKind.Acknowledge) | (1 << NextIntEventKind.Nmi) | (1 << NextIntEventKind.Wait));
    expect(w.ackSources).toBe((1 << NextIntSource.Ula) | (1 << NextIntSource.Line));
    expect(w.nmiSources).toBe(0x02);
    expect(w.waitLimit).toBe(228);
  });

  it("watches every source for an unnarrowed ack", () => {
    expect(buildInterruptWatch([{ kind: "ack" }]).ackSources).toBe(0x3fff);
  });
});

describe("matching an event", () => {
  it("narrows by source and device", () => {
    expect(matchesInterruptStop({ kind: "ack", source: NextIntSource.Ula }, ev(NextIntEventKind.Acknowledge, NextIntSource.Ula))).toBe(true);
    expect(matchesInterruptStop({ kind: "ack", source: NextIntSource.Ula }, ev(NextIntEventKind.Acknowledge, NextIntSource.Line))).toBe(false);
    expect(matchesInterruptStop({ kind: "ack" }, ev(NextIntEventKind.Lost, NextIntSource.Ula))).toBe(false);
    expect(matchesInterruptStop({ kind: "nmi", nmiDevice: "multiface" }, ev(NextIntEventKind.Nmi, NEXT_INT_SRC_NMI_MULTIFACE))).toBe(true);
    expect(matchesInterruptStop({ kind: "nmi", nmiDevice: "multiface" }, ev(NextIntEventKind.Nmi, NEXT_INT_SRC_NMI_DIVMMC))).toBe(false);
  });

  it("matches a wait stop only at or under the limit the core used", () => {
    const e = ev(NextIntEventKind.Wait, NextIntSource.Ctc0);
    expect(matchesInterruptStop({ kind: "wait", waitLimit: 228 }, e, 228)).toBe(true);
    expect(matchesInterruptStop({ kind: "wait", waitLimit: 500 }, e, 228)).toBe(false);
  });
});

describe("the stop message", () => {
  it("names the source, the vector and the interrupted address", () => {
    expect(describeInterruptStop(ev(NextIntEventKind.Acknowledge, NextIntSource.Ula, { vector: 0xb6 }))).toBe(
      "Interrupt stop: ULA taken (vector $B6), interrupting $8010"
    );
    expect(describeInterruptStop({ ...ev(NextIntEventKind.Lost, NextIntSource.Line), partition: 5 }, { 5: "R5" })).toBe(
      "Interrupt stop: Line's pulse ended before the CPU took it (interrupts disabled), at $8010 in R5"
    );
  });
});

describe("the dialog's fields", () => {
  it("build a stop, or name the wrong field", () => {
    expect(interruptStopFromForm({ interruptEvent: "ack", interruptSource: "ula", interruptWait: "" })).toEqual({
      kind: "ack",
      source: NextIntSource.Ula
    });
    expect(interruptStopFromForm({ interruptEvent: "retn", interruptSource: "ula", interruptWait: "" })).toEqual({ kind: "retn" });
    expect(interruptStopFromForm({ interruptEvent: "wait", interruptSource: "", interruptWait: "$E4" })).toEqual({
      kind: "wait",
      waitLimit: 228,
      source: undefined
    });
    expect(interruptStopFromForm({ interruptEvent: "wait", interruptSource: "", interruptWait: "" })).toEqual({
      field: "interruptWait"
    });
    expect(interruptStopFromForm({ interruptEvent: "nmi", interruptSource: "esp", interruptWait: "" })).toEqual({
      field: "interruptSource"
    });
  });
});
