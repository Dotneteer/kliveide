import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * The activity bar's Settings button: pinned below the activity tabs, outside the tab list, and it
 * opens the Settings dialog without naming a page (so the dialog returns to its last page).
 */

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

async function renderBar() {
  const runUiAction = vi.fn(() => Promise.resolve(undefined));
  const dispatch = vi.fn();
  vi.doMock("@renderer/core/MainApi", () => ({
    useMainApi: () => ({ runUiAction, setGlobalSettingsValue: vi.fn(() => Promise.resolve()) })
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useDispatch: () => dispatch,
    useSelector: (selector: (s: any) => any) => selector({ ideView: { activity: "explorer" } }),
    useGlobalSetting: () => true
  }));
  vi.doMock("@renderer/controls/Icon", () => ({
    Icon: ({ iconName }: { iconName: string }) => <span data-testid={`icon-${iconName}`} />
  }));
  vi.doMock("@renderer/controls/Tooltip", () => ({
    TooltipFactory: () => null,
    useTooltipRef: () => ({ current: null })
  }));
  const { ActivityBar } = await import("@renderer/appIde/ActivityBar/ActivityBar");
  render(
    <ActivityBar
      activities={[
        { id: "explorer", title: "Explorer", iconName: "files" },
        { id: "debug", title: "Debug", iconName: "debug" }
      ]}
    />
  );
  return { runUiAction };
}

describe("ActivityBar Settings button", () => {
  it("sits after the tab list, as a plain button", async () => {
    await renderBar();
    const tablist = screen.getByRole("tablist", { name: "Activities" });
    const settings = screen.getByRole("button", { name: "Settings" });
    expect(tablist.contains(settings)).toBe(false);
    expect(settings.getAttribute("aria-selected")).toBeNull();
    expect(tablist.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("tab").map((t) => t.getAttribute("aria-label"))).toEqual([
      "Explorer",
      "Debug"
    ]);
  });

  it("opens the Settings dialog on its remembered page", async () => {
    const { runUiAction } = await renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(runUiAction).toHaveBeenCalledWith("open-settings");
  });
});
