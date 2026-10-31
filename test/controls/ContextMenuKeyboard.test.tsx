import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ContextMenu,
  ContextMenuItem,
  useContextMenuState,
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

  it("makes a switch a checkbox item, reachable by the arrow keys like any other row", () => {
    render(
      <ContextMenu state={visible}>
        <ContextMenuItem text="Plain" />
        <ContextMenuItem text="On" iconName="pin" toggled={true} />
        <ContextMenuItem text="Off" iconName="vm" toggled={false} />
      </ContextMenu>
    );

    const on = screen.getByRole("menuitemcheckbox", { name: "On" });
    const off = screen.getByRole("menuitemcheckbox", { name: "Off" });
    expect(on.getAttribute("aria-checked")).toBe("true");
    expect(off.getAttribute("aria-checked")).toBe("false");
    // --- Only the switch that is on draws the selection border around its icon
    expect(screen.getByTestId("icon-pin").parentElement!.className).toMatch(/toggledOn/);
    expect(screen.getByTestId("icon-vm").parentElement!.className).not.toMatch(/toggledOn/);

    fireEvent.keyDown(screen.getByRole("menu"), { code: "ArrowDown" });
    expect(document.activeElement).toBe(on);
  });

  it("shows the focus ring only after the user moves through the menu by keyboard", () => {
    render(
      <ContextMenu state={visible}>
        <ContextMenuItem text="First" />
        <ContextMenuItem text="Second" />
      </ContextMenu>
    );

    // --- Opening focuses the first row, but that is not the user's choice: no ring yet
    const menu = screen.getByRole("menu");
    expect(menu.className).not.toMatch(/keyboardNav/);

    fireEvent.keyDown(menu, { code: "ArrowDown" });
    expect(menu.className).toMatch(/keyboardNav/);
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

/** A trigger and its menu, as the toolbar's dropdowns use them */
const Dropdown = ({ toggle }: { toggle?: boolean }) => {
  const [menu, menuApi] = useContextMenuState();
  return (
    <>
      <button type="button" onClick={(e) => menuApi.showAt(e.currentTarget, { toggle })}>
        trigger
      </button>
      <button type="button">elsewhere</button>
      {menu.contextVisible && (
        <ContextMenu state={menu} onClickOutside={menuApi.conceal}>
          <ContextMenuItem text="Item" />
        </ContextMenu>
      )}
    </>
  );
};

/** A real press: mousedown (which the menu's outside-click watch sees), then click */
const press = (el: HTMLElement) => {
  fireEvent.mouseDown(el);
  fireEvent.click(el);
};

describe("a dropdown's trigger", () => {
  it("closes the open menu when pressed again, and opens it on the next press", () => {
    render(<Dropdown />);
    const trigger = screen.getByRole("button", { name: "trigger" });

    press(trigger);
    expect(screen.queryByRole("menu")).not.toBeNull();
    press(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
    press(trigger);
    expect(screen.queryByRole("menu")).not.toBeNull();
  });

  it("still closes the menu on a press anywhere else", () => {
    render(<Dropdown />);
    press(screen.getByRole("button", { name: "trigger" }));
    press(screen.getByRole("button", { name: "elsewhere" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("does not toggle for an anchor that is not a trigger: a press on it closes, the next opens", () => {
    render(<Dropdown toggle={false} />);
    const anchor = screen.getByRole("button", { name: "trigger" });

    press(anchor);
    expect(screen.queryByRole("menu")).not.toBeNull();
    // --- The press closes it (outside-click watch); the click that follows reopens it
    fireEvent.mouseDown(anchor);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
