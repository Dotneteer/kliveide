import { describe, expect, it } from "vitest";
import { getSideBarPanelDropOrderIndex } from "../../src/renderer/lib/SideBarPanels/sideBarPanelDrop";

const panels = ["z80Cpu", "callStack", "ulaIo", "watch", "breakpoints"].map((panelId) => ({
  panelId
}));

describe("side bar panel drag/drop ordering", () => {
  it("inserts a panel before the target panel", () => {
    expect(getSideBarPanelDropOrderIndex(panels, "memory", "callStack")).toBe(1);
  });

  it("inserts a panel after the target panel", () => {
    expect(getSideBarPanelDropOrderIndex(panels, "memory", "callStack", true)).toBe(2);
  });

  it("adjusts the target index when moving a panel downward in the same side bar", () => {
    expect(getSideBarPanelDropOrderIndex(panels, "z80Cpu", "watch")).toBe(2);
    expect(getSideBarPanelDropOrderIndex(panels, "z80Cpu", "watch", true)).toBe(3);
  });

  it("keeps the target index when moving a panel upward in the same side bar", () => {
    expect(getSideBarPanelDropOrderIndex(panels, "watch", "callStack")).toBe(1);
    expect(getSideBarPanelDropOrderIndex(panels, "watch", "callStack", true)).toBe(2);
  });

  it("suppresses no-op indicators around the dragged panel", () => {
    expect(getSideBarPanelDropOrderIndex(panels, "callStack", "callStack")).toBeNull();
    expect(getSideBarPanelDropOrderIndex(panels, "callStack", "z80Cpu", true)).toBeNull();
    expect(getSideBarPanelDropOrderIndex(panels, "callStack", "ulaIo")).toBeNull();
  });

  it("uses append semantics when there is no target panel", () => {
    expect(getSideBarPanelDropOrderIndex(panels, "z80Cpu")).toBeUndefined();
    expect(getSideBarPanelDropOrderIndex(panels, "breakpoints")).toBeNull();
  });
});
