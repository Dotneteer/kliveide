import { describe, expect, it } from "vitest";
import { nextOverflowStep, type OverflowGroupState, type ToolbarGroupLevel } from "@renderer/controls/ToolbarOverflow";

/*
 * Which toolbar group folds, leaves or returns next (`ToolbarOverflow.tsx`). The layout itself
 * needs a real browser; the decision does not.
 */
const group = (
  id: string,
  priority: number,
  level: ToolbarGroupLevel = 0,
  opts: Partial<OverflowGroupState> = {}
): OverflowGroupState => ({
  id,
  priority,
  level,
  collapsible: false,
  fullWidth: 60,
  collapsedWidth: 0,
  ...opts
});

const view = (level: ToolbarGroupLevel) =>
  group("view", 50, level, { collapsible: true, fullWidth: 120, collapsedWidth: 30 });

describe("the toolbar overflow decision", () => {
  it("does nothing while everything fits", () => {
    expect(nextOverflowStep(0, [group("tape", 10), view(0)], 30)).toBeNull();
    expect(nextOverflowStep(200, [group("tape", 10), view(0)], 30)).toBeNull();
  });

  it("folds a foldable group before any group leaves", () => {
    expect(nextOverflowStep(-5, [group("tape", 10), view(0), group("history", 70)], 30)).toEqual({
      id: "view",
      level: 1
    });
  });

  it("then hides the lowest-priority group still on the strip, folded ones included", () => {
    expect(nextOverflowStep(-5, [group("tape", 10), view(1)], 30)).toEqual({ id: "tape", level: 2 });
    expect(nextOverflowStep(-5, [group("tape", 10, 2), group("history", 70), view(1)], 30)).toEqual({
      id: "view",
      level: 2
    });
  });

  it("brings back the highest-priority hidden group first, folded if it folds", () => {
    const groups = [group("tape", 10, 2, { fullWidth: 60 }), view(2)];
    expect(nextOverflowStep(29, groups, 30)).toBeNull();
    expect(nextOverflowStep(30, groups, 30)).toEqual({ id: "view", level: 1 });
  });

  it("counts the More button's room when the last hidden group comes back", () => {
    const groups = [group("tape", 10, 2, { fullWidth: 60 }), view(1)];
    // --- 30px of slack plus the 30px button the menu no longer needs
    expect(nextOverflowStep(30, groups, 30)).toEqual({ id: "tape", level: 0 });
    expect(nextOverflowStep(29, groups, 30)).toBeNull();
  });

  it("opens a folded group last, once its full width fits", () => {
    const groups = [group("tape", 10), view(1)];
    expect(nextOverflowStep(89, groups, 0)).toBeNull();
    expect(nextOverflowStep(90, groups, 0)).toEqual({ id: "view", level: 0 });
  });

  it("has nothing to hide when every group is out already", () => {
    expect(nextOverflowStep(-10, [group("tape", 10, 2)], 30)).toBeNull();
  });
});
