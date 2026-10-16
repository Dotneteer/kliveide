import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ToolbarSplitAction } from "@renderer/controls/ToolbarSplitAction";

/*
 * The split-button frame the emulator's sound and recording groups use. Its job is routing: the
 * main button and the chevron are separate actions, and the chevron hands its own element to the
 * caller so the caller's menu can anchor on it.
 */

vi.mock("@renderer/controls/Icon", () => ({
  Icon: ({ iconName, fill }: { iconName: string; fill?: string }) => (
    <svg data-icon={iconName} data-fill={fill} />
  )
}));

afterEach(() => cleanup());

describe("ToolbarSplitAction", () => {
  it("routes the main button and the chevron to separate handlers", () => {
    const clicked = vi.fn();
    let anchor: EventTarget | null = null;
    const dropdownClicked = vi.fn((e: { currentTarget: EventTarget }) => {
      anchor = e.currentTarget;
    });
    render(
      <ToolbarSplitAction
        iconName="mute"
        title="Mute sound"
        clicked={clicked}
        dropdownTitle="Sound level"
        dropdownClicked={dropdownClicked}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Mute sound" }));
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(dropdownClicked).not.toHaveBeenCalled();

    const chevron = screen.getByRole("button", { name: "Sound level" });
    fireEvent.click(chevron);
    expect(dropdownClicked).toHaveBeenCalledTimes(1);
    expect(anchor).toBe(chevron);
  });

  it("draws the main glyph and a chevron", () => {
    const { container } = render(
      <ToolbarSplitAction iconName="record" dropdownTitle="Recordings" dropdownClicked={() => {}} />
    );

    const icons = [...container.querySelectorAll("svg")].map((s) => s.getAttribute("data-icon"));
    expect(icons).toEqual(["record", "chevron-down"]);
  });

  it("reports a toggle that is on as pressed", () => {
    render(
      <ToolbarSplitAction
        iconName="record"
        title="Recording"
        selected
        dropdownTitle="Recordings"
        dropdownClicked={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "Recording" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("disables both halves and greys the glyph when not enabled", () => {
    const { container } = render(
      <ToolbarSplitAction
        iconName="mute"
        title="Mute sound"
        fill="--color-toolbarbutton"
        enable={false}
        dropdownTitle="Sound level"
        dropdownClicked={() => {}}
      />
    );

    for (const b of screen.getAllByRole("button")) expect((b as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('[data-icon="mute"]')?.getAttribute("data-fill")).toBe("--text-disabled");
  });
});
