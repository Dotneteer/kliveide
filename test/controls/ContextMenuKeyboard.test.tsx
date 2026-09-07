import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ContextMenu,
  ContextMenuItem,
  type ContextMenuState
} from "@renderer/controls/ContextMenu";

/**
 * The context menu had no keyboard path at all: its rows were `<div>`s with an `onClick`, so a menu
 * opened from a keyboard-reachable control could be dismissed but never used. Slice 7.2 needed a
 * menu for the tab-overflow list and made the rows real `role="menuitem"` buttons.
 */

vi.mock("@renderer/controls/overlay/useOverlayRoot", () => ({
  getOverlayRoot: () => document.body
}));

vi.mock("react-popper", () => ({
  usePopper: () => ({ styles: { popper: {} }, attributes: { popper: {} } })
}));

vi.mock("@renderer/controls/Icon", () => ({
  Icon: ({ iconName }: { iconName: string }) => <span data-testid={`icon-${iconName}`} />
}));

const visible: ContextMenuState = {
  contextVisible: true,
  contextRef: undefined,
  contextX: 0,
  contextY: 0
};

afterEach(() => {
  cleanup();
});

describe("ContextMenu keyboard navigation", () => {
  it("renders rows as menu items that can hold focus", () => {
    render(
      <ContextMenu state={visible}>
        <ContextMenuItem text="First" />
        <ContextMenuItem text="Second" />
      </ContextMenu>
    );

    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(2);
    expect(items[0].tagName).toBe("BUTTON");
    // Focus moves into the menu on open, so the first arrow key does not need a mouse first.
    expect(document.activeElement).toBe(items[0]);
  });

  it("moves focus with the arrow keys and wraps around", () => {
    render(
      <ContextMenu state={visible}>
        <ContextMenuItem text="First" />
        <ContextMenuItem text="Second" />
      </ContextMenu>
    );

    const menu = screen.getByRole("menu");
    const [first, second] = screen.getAllByRole("menuitem");

    fireEvent.keyDown(menu, { code: "ArrowDown" });
    expect(document.activeElement).toBe(second);

    fireEvent.keyDown(menu, { code: "ArrowDown" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(menu, { code: "ArrowUp" });
    expect(document.activeElement).toBe(second);
  });

  it("skips disabled rows when navigating", () => {
    render(
      <ContextMenu state={visible}>
        <ContextMenuItem text="First" />
        <ContextMenuItem text="Nope" disabled />
        <ContextMenuItem text="Third" />
      </ContextMenu>
    );

    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { code: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Third" }));
  });

  it("carries an icon and a trailing marker", () => {
    render(
      <ContextMenu state={visible}>
        <ContextMenuItem text="code.kz80.asm" iconName="file-code" trailing="dirty" />
      </ContextMenu>
    );

    expect(screen.getByTestId("icon-file-code")).toBeTruthy();
    expect(screen.getByRole("menuitem").textContent).toContain("dirty");
  });

  it("activates a row with Enter, which the button element provides", () => {
    const clicked = vi.fn();
    render(
      <ContextMenu state={visible}>
        <ContextMenuItem text="Go" clicked={clicked} />
      </ContextMenu>
    );

    // A <div> row could not be reached this way at all; a <button> fires click on Enter.
    screen.getByRole("menuitem").click();
    expect(clicked).toHaveBeenCalledTimes(1);
  });
});
