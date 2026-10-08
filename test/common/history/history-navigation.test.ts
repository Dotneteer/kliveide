import { describe, expect, it } from "vitest";

import { defaultReverseShortcuts, readReverseShortcuts } from "@common/settings/reverse-shortcuts";
import { historyReasonText, historyStepText } from "@common/history/historyNavigation";
import { parseHistoryTarget } from "@renderer/appIde/commands/HistoryCommands";

/*
 * The small pure pieces of lite step back (`.plans/LITE_STEP_BACK_PLAN.md` §4.5, Q3, T7): the
 * `history-goto` target, the status texts, and the reverse keys.
 */

describe("history-goto targets", () => {
  it("reads a step back from the present, or a sequence number", () => {
    expect(parseHistoryTarget("-42")).toEqual({ toPosition: 42 });
    expect(parseHistoryTarget("−42")).toEqual({ toPosition: 42 });
    expect(parseHistoryTarget("42")).toEqual({ toPosition: 42 });
    expect(parseHistoryTarget("#1234")).toEqual({ toSequence: 1234 });
    expect(parseHistoryTarget("0")).toBe("present");
    expect(parseHistoryTarget("abc")).toBeUndefined();
    expect(parseHistoryTarget("#")).toBeUndefined();
  });
});

describe("history texts", () => {
  it("numbers steps with a minus sign and explains why a walk stopped", () => {
    expect(historyStepText(1203)).toBe("−1,203");
    expect(historyReasonText({ reason: "start" }, 131072)).toBe(
      "Start of recorded history (131,072 instructions)"
    );
    expect(historyReasonText({ reason: "running" })).toMatch(/paused/);
    expect(historyReasonText({})).toBeUndefined();
  });
});

describe("the reverse stepping keys (Q3)", () => {
  it("add Alt to the forward keys, and Ctrl+Alt on Linux", () => {
    expect(defaultReverseShortcuts("win32")).toEqual({
      stepBack: "Alt+F11",
      stepBackOver: "Alt+F10",
      stepBackOut: "Alt+Shift+F11",
      reverseContinue: "Alt+F5",
      stepForward: "Alt+Shift+F10"
    });
    expect(defaultReverseShortcuts("darwin")).toMatchObject({ stepBack: "Alt+F12", stepBackOut: "Alt+Shift+F12" });
    expect(defaultReverseShortcuts("linux")).toMatchObject({ stepBack: "Ctrl+Alt+F11", reverseContinue: "Ctrl+Alt+F5" });
  });

  it("are settings", () => {
    const keys = readReverseShortcuts((key) => (key === "shortcuts.stepBack" ? "Ctrl+B" : undefined), "win32");
    expect(keys.stepBack).toBe("Ctrl+B");
    expect(keys.stepForward).toBe("Alt+Shift+F10");
  });
});
