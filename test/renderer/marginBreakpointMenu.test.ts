import { describe, expect, it, vi } from "vitest";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import {
  marginMenuItems,
  runMarginAction,
  type MarginActionPorts,
  type MarginTarget
} from "@renderer/features/editor/monaco/marginBreakpointMenu";
import {
  breakpointFilterLines,
  describeHitRule,
  isConditionalBreakpoint,
  isInactiveBreakpoint
} from "@renderer/appIde/utils/breakpoint-filter-text";

/*
 * The editor margin's breakpoint menu and the shared filter wording (Phase 6 of
 * `.plans/CONDITIONAL_BREAKPOINTS_PLAN.md`, §4.4.2).
 */

const ports = (editResult = true): MarginActionPorts & Record<string, any> => ({
  add: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  enable: vi.fn().mockResolvedValue(undefined),
  resetHits: vi.fn().mockResolvedValue(undefined),
  resolve: vi.fn().mockResolvedValue(undefined),
  edit: vi.fn().mockResolvedValue(editResult)
});

const BP: BreakpointInfo = { resource: "main.asm", line: 42, exec: true, condition: "B == 0" };
const onBp: MarginTarget = { line: 42, breakpoint: BP, canAdd: true };
const empty: MarginTarget = { line: 42, canAdd: true };

describe("marginMenuItems", () => {
  it("offers the breakpoint's actions on a line with one", () => {
    expect(marginMenuItems(onBp).map((i) => i.text)).toEqual([
      "Edit Condition...",
      "Edit Hit Count...",
      "Convert to Logpoint...",
      "Disable Breakpoint",
      "Reset Hit Count",
      "Remove Breakpoint"
    ]);
  });

  it("labels the toggle by what it will do", () => {
    expect(marginMenuItems({ ...onBp, breakpoint: { ...BP, disabled: true } })[3].text).toBe(
      "Enable Breakpoint"
    );
  });

  it("offers to add one on a line without, disabled where the line cannot hold one", () => {
    expect(marginMenuItems(empty).map((i) => [i.text, !!i.disabled])).toEqual([
      ["Add Breakpoint", false],
      ["Add Conditional Breakpoint...", false],
      ["Add Logpoint...", false]
    ]);
    expect(marginMenuItems({ ...empty, canAdd: false }).every((i) => i.disabled)).toBe(true);
  });
});

describe("runMarginAction", () => {
  it("opens the dialog on the condition or the hit count", async () => {
    const p = ports();
    await runMarginAction("editCondition", onBp, "main.asm", p);
    await runMarginAction("editHitCount", onBp, "main.asm", p);
    expect(p.edit.mock.calls).toEqual([
      [BP, "condition"],
      [BP, "hitCount"]
    ]);
  });

  it("toggles, resets and removes the breakpoint", async () => {
    const p = ports();
    await runMarginAction("toggle", onBp, "main.asm", p);
    await runMarginAction("resetHits", onBp, "main.asm", p);
    await runMarginAction("remove", onBp, "main.asm", p);
    expect(p.enable).toHaveBeenCalledWith(BP, false);
    expect(p.resetHits).toHaveBeenCalledWith(BP);
    expect(p.remove).toHaveBeenCalledWith(BP);
  });

  it("adds a line breakpoint and resolves it", async () => {
    const p = ports();
    await runMarginAction("add", empty, "main.asm", p);
    expect(p.add).toHaveBeenCalledWith({ resource: "main.asm", line: 42, exec: true });
    expect(p.resolve).toHaveBeenCalled();
    expect(p.edit).not.toHaveBeenCalled();
  });

  it("adds a statement breakpoint at its column", async () => {
    const p = ports();
    await runMarginAction("add", { ...empty, column: 7 }, "main.kbas", p);
    expect(p.add).toHaveBeenCalledWith({ resource: "main.kbas", line: 42, column: 7, exec: true });
  });

  it("adds a conditional breakpoint and keeps it when the dialog is saved", async () => {
    const p = ports(true);
    await runMarginAction("addConditional", empty, "main.asm", p);
    const added = { resource: "main.asm", line: 42, exec: true };
    expect(p.add).toHaveBeenCalledWith(added);
    // --- Resolved before the dialog opens, so the dialog shows where it lands
    expect(p.resolve.mock.invocationCallOrder[0]).toBeLessThan(p.edit.mock.invocationCallOrder[0]);
    expect(p.edit).toHaveBeenCalledWith(added, "condition");
    expect(p.remove).not.toHaveBeenCalled();
  });

  it("removes the breakpoint again when the dialog is cancelled", async () => {
    const p = ports(false);
    await runMarginAction("addConditional", empty, "main.asm", p);
    expect(p.remove).toHaveBeenCalledWith({ resource: "main.asm", line: 42, exec: true });
  });

  it("adds nothing where the line cannot hold a breakpoint, or one is already there", async () => {
    const p = ports();
    await runMarginAction("add", { ...empty, canAdd: false }, "main.asm", p);
    await runMarginAction("addConditional", onBp, "main.asm", p);
    expect(p.add).not.toHaveBeenCalled();
  });
});

describe("breakpoint filter wording", () => {
  it.each<[Partial<BreakpointInfo>, string | undefined]>([
    [{}, undefined],
    [{ hitCount: 10 }, "Stops on hit 10"],
    [{ hitMode: "gt", hitCount: 10 }, "Stops after hit 10"],
    [{ hitMode: "ge", hitCount: 10 }, "Stops from hit 10 on"],
    [{ hitMode: "lt", hitCount: 10 }, "Stops before hit 10"],
    [{ hitMode: "le", hitCount: 10 }, "Stops up to hit 10"],
    [{ hitMode: "every", hitCount: 1 }, "Stops on every hit"],
    [{ hitMode: "every", hitCount: 2 }, "Stops on every 2nd hit"],
    [{ hitMode: "every", hitCount: 3 }, "Stops on every 3rd hit"],
    [{ hitMode: "every", hitCount: 4 }, "Stops on every 4th hit"],
    [{ hitMode: "every", hitCount: 11 }, "Stops on every 11th hit"],
    [{ hitMode: "every", hitCount: 21 }, "Stops on every 21st hit"]
  ])("describes %j", (bp, text) => {
    expect(describeHitRule(bp)).toBe(text);
  });

  it("lists the condition, rule, count and state", () => {
    expect(
      breakpointFilterLines({
        condition: " w[score] > 1 ",
        hitMode: "ge",
        hitCount: 2,
        currentHits: 5,
        conditionInactive: "unknown label score"
      })
    ).toEqual([
      "Condition: w[score] > 1",
      "Stops from hit 2 on",
      "Hits so far: 5",
      "Inactive: unknown label score - it will not stop until a build defines it"
    ]);
    expect(breakpointFilterLines({ condition: "A ==", conditionError: "column 5: oops" })).toEqual([
      "Condition: A ==",
      "Condition error (column 5: oops) - it stops every time"
    ]);
    expect(breakpointFilterLines({ address: 1, currentHits: 3 })).toEqual([]);
  });

  it("picks the glyph variant", () => {
    expect(isConditionalBreakpoint({ condition: "A" })).toBe(true);
    expect(isConditionalBreakpoint({ hitCount: 1 })).toBe(true);
    expect(isConditionalBreakpoint({ condition: " " })).toBe(false);
    expect(isConditionalBreakpoint(undefined)).toBe(false);
    expect(isInactiveBreakpoint({ conditionInactive: "x" })).toBe(true);
    expect(isInactiveBreakpoint({ conditionError: "x" })).toBe(true);
    expect(isInactiveBreakpoint({ condition: "A" })).toBe(false);
  });
});

// --- `.plans/LOGPOINTS_PLAN.md` §4.5
describe("logpoint items", () => {
  const LP = { ...BP, logMessage: "[G] A={A}" };
  const onLp = { ...onBp, breakpoint: LP };

  it("offers to edit the message and to convert back on a logpoint", () => {
    expect(marginMenuItems(onLp).map((i) => i.text)).toEqual([
      "Edit Log Message...",
      "Edit Condition...",
      "Edit Hit Count...",
      "Convert to Breakpoint",
      "Disable Logpoint",
      "Reset Hit Count",
      "Remove Logpoint"
    ]);
  });

  it("converts a breakpoint through the dialog, and a logpoint back directly", async () => {
    const p = ports();
    await runMarginAction("toLogpoint", onBp, "main.asm", p);
    expect(p.edit).toHaveBeenCalledWith(BP, "logMessage");
    await runMarginAction("toBreakpoint", { ...onLp, breakpoint: { ...LP, currentHits: 3 } }, "main.asm", p);
    const converted = p.add.mock.calls.at(-1)![0];
    expect(converted.logMessage).toBeUndefined();
    expect(converted.currentHits).toBeUndefined();
    expect(converted.line).toBe(BP.line);
  });

  it("adds a logpoint and takes it away again on Cancel", async () => {
    const p = ports();
    p.edit.mockResolvedValue(false);
    await runMarginAction("addLogpoint", empty, "main.asm", p);
    expect(p.edit.mock.calls[0][1]).toBe("logMessage");
    expect(p.remove).toHaveBeenCalled();
  });
});
