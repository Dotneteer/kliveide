import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The tool area's tabs — Commands, Output — were unfocusable `<div>`s with an `onClick`: no
 * `tabIndex`, no `role`, no `aria-selected` and no focus ring, so the tool area's primary navigation
 * was reachable by mouse and by nothing else. Phase 2 fixed exactly this on the toolbar, the
 * document tabs and the activity bar; these survived because the tab is a plain text label rather
 * than one of the shared button controls.
 */

const setGlobalSettingsValue = vi.fn().mockResolvedValue(undefined);

vi.mock("@renderer/core/MainApi", () => ({
  useMainApi: () => ({ setGlobalSettingsValue })
}));

const { ToolTab } = await import("@renderer/appIde/ToolArea/ToolTab");

beforeEach(() => {
  setGlobalSettingsValue.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("ToolTab", () => {
  it("is a button with tab semantics", () => {
    render(<ToolTab id="commands" name="Commands" isActive />);

    const tab = screen.getByRole("tab", { name: "Commands" });
    expect(tab.tagName).toBe("BUTTON");
    expect(tab.getAttribute("aria-selected")).toBe("true");
  });

  it("reports the unselected state", () => {
    render(<ToolTab id="output" name="Output" />);
    expect(screen.getByRole("tab", { name: "Output" }).getAttribute("aria-selected")).toBe("false");
  });

  it("can be focused, which a div with an onClick could not", () => {
    render(<ToolTab id="commands" name="Commands" />);

    const tab = screen.getByRole("tab", { name: "Commands" });
    tab.focus();
    expect(document.activeElement).toBe(tab);
  });

  it("activates the tool when clicked", () => {
    render(<ToolTab id="output" name="Output" />);

    screen.getByRole("tab", { name: "Output" }).click();
    expect(setGlobalSettingsValue).toHaveBeenCalledWith(expect.any(String), "output");
  });
});
