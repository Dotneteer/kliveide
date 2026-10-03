import { describe, expect, it } from "vitest";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import {
  breakpointFilterLines,
  breakpointGlyphIcon,
  breakpointGlyphOf
} from "@renderer/appIde/utils/breakpoint-filter-text";
import { groupBreakpoints, logpointSections } from "@renderer/appIde/utils/breakpoint-grouping";
import {
  breakpointFormWarnings,
  breakpointToForm,
  createEmptyForm,
  formToBreakpointInfo,
  validateBreakpointForm,
  type BreakpointEnvironment
} from "@renderer/appIde/utils/breakpoint-form";

/*
 * The logpoint UI's decisions without React (`.plans/LOGPOINTS_PLAN.md` §4.5, Phase 6): which glyph
 * a breakpoint draws, the Breakpoints panel's logpoint sections, and the dialog form's Action row
 * and template validation.
 */

const COMMENT: BreakpointInfo = {
  owner: { kind: "annotation" },
  address: 0x8000,
  exec: true,
  resource: "main.asm",
  line: 9,
  logMessage: "[SPRITES] ${A}",
  logDialect: "dezog"
};

describe("glyphs", () => {
  it("draws a dot for a breakpoint and a diamond for a logpoint, with both variants", () => {
    const cases: [BreakpointInfo, string][] = [
      [{ address: 1 }, "dot"],
      [{ address: 1, condition: "A == 1" }, "conditional"],
      [{ address: 1, conditionInactive: "unknown label x" }, "inactive"],
      [{ address: 1, logMessage: "x" }, "logpoint"],
      [{ address: 1, logMessage: "x", hitCount: 2 }, "logpointConditional"],
      [{ address: 1, logMessage: "x", conditionInactive: "unknown label x" }, "logpointInactive"],
      [{ address: 1, logMessage: "x", logError: "column 1: bad" }, "logpointInactive"],
      [COMMENT, "logpointComment"]
    ];
    for (const [bp, glyph] of cases) expect(breakpointGlyphOf(bp)).toBe(glyph);
    expect(breakpointGlyphIcon("logpointComment")).toBe("bp-logpoint-comment");
    expect(breakpointGlyphIcon("dot")).toBe("circle-filled");
  });

  it("describes a comment's logpoint as read-only, with its group and address", () => {
    expect(breakpointFilterLines(COMMENT)).toEqual([
      "From a LOGPOINT comment - edit the comment and rebuild to change it, or disable it",
      "Logs: [SPRITES] ${A}",
      "Group: SPRITES",
      "At: $8000"
    ]);
    expect(breakpointFilterLines({ address: 1, logMessage: "x", logError: "e" })).toContain(
      "Log message error (e) - it logs the error instead"
    );
  });
});

describe("panel sections", () => {
  const bps: BreakpointInfo[] = [
    { address: 0x9000, exec: true },
    { address: 0x9001, exec: true, logMessage: "[LOOP] x" },
    COMMENT,
    { ...COMMENT, line: 3, address: 0x7000, logMessage: "${B}" }
  ];

  it("keeps comment logpoints out of the kind groups", () => {
    const rows = groupBreakpoints(bps, {}, true).filter((i) => i.kind === "row");
    expect(rows).toHaveLength(2);
  });

  it("lists one switch per group, then the comments by source line", () => {
    const items = logpointSections(bps, { enabled: true, groups: ["LOOP"] });
    expect(items.map((i) => (i.kind === "row" ? `row ${i.bp.line}` : i.kind === "logGroup" ? `${i.group} ${i.on} ${i.count}` : `${i.kind} ${i.kind === "sectionHeader" ? i.section : ""}`))).toEqual([
      "sectionHeader logGroups",
      "DEFAULT false 1",
      "LOOP true 1",
      "SPRITES false 1",
      "sectionHeader comments",
      "row 3",
      "row 9"
    ]);
    expect(logpointSections([{ address: 1 }], undefined)).toEqual([]);
  });
});

describe("the dialog form", () => {
  const env: BreakpointEnvironment = { partitionLabels: {}, supportsPartitions: false, existingKeys: [] };

  it("turns a breakpoint into a logpoint with the Log message action, and back with Stop", () => {
    const form = { ...createEmptyForm(), address: "$8000", action: "log" as const, logMessage: "B={B}" };
    expect(validateBreakpointForm(form, env)).toEqual({});
    expect(formToBreakpointInfo(form).logMessage).toBe("B={B}");
    expect(formToBreakpointInfo({ ...form, action: "stop" }).logMessage).toBeUndefined();
  });

  it("validates the template with column-accurate errors and label warnings", () => {
    const base = { ...createEmptyForm(), address: "$8000", action: "log" as const };
    expect(validateBreakpointForm({ ...base, logMessage: "" }, env).logMessage).toBe("Enter the message to log.");
    expect(validateBreakpointForm({ ...base, logMessage: "x={A +}" }, env).logMessage).toMatch(/^Column \d+:/);
    expect(
      breakpointFormWarnings({ ...base, logMessage: "{b[score]}" }, { ...env, conditionSymbols: {} }).logMessage
    ).toMatch(/Unknown label score/);
  });

  it("reads a logpoint back into the form, also in source mode", () => {
    const form = breakpointToForm({ resource: "main.asm", line: 4, exec: true, logMessage: "[G] {A}" });
    expect(form.action).toBe("log");
    expect(form.logMessage).toBe("[G] {A}");
    expect(formToBreakpointInfo(form)).toMatchObject({ resource: "main.asm", line: 4, logMessage: "[G] {A}" });
  });
});
