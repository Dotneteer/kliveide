import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { useState } from "react";
import { renderWithProviders, screen, fireEvent, act, waitFor } from "../react-test-utils";
import { ClickAwayListener } from "@controls/ClickAwayListener";
import { ContextMenu } from "@controls/ContextMenu";
import { Tooltip } from "@controls/Tooltip";

vi.mock("react-popper", () => ({
  usePopper: () => ({
    styles: { popper: {} },
    attributes: { popper: {} }
  })
}));

describe("Shared controls — listener cleanup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("ClickAwayListener removes document listeners and ignores child-originated clicks", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const onClickAway = vi.fn();
    const onChildClick = vi.fn();

    const { unmount } = renderWithProviders(
      <ClickAwayListener onClickAway={onClickAway}>
        <button data-testid="inside" onClick={onChildClick}>inside</button>
      </ClickAwayListener>
    );

    act(() => {
      vi.advanceTimersByTime(0);
    });

    fireEvent.click(screen.getByTestId("inside"));
    expect(onChildClick).toHaveBeenCalledTimes(1);
    expect(onClickAway).not.toHaveBeenCalled();

    fireEvent.click(document.body);
    expect(onClickAway).toHaveBeenCalledTimes(1);

    unmount();

    expect(removeSpy.mock.calls.some(([type]) => type === "click")).toBe(true);
    expect(removeSpy.mock.calls.some(([type]) => type === "touchend")).toBe(true);
    expect(removeSpy.mock.calls.some(([type]) => type === "focusin")).toBe(true);
    expect(removeSpy.mock.calls.find(([type]) => type === "click")?.[1]).toBe(
      addSpy.mock.calls.find(([type]) => type === "click")?.[1]
    );
  });

  it("ContextMenu dismisses on outside click and Escape, then removes document listeners", async () => {
    vi.useRealTimers();
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const onClickOutside = vi.fn();
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);

    const { unmount } = renderWithProviders(
      <ContextMenu
        state={{
          contextVisible: true,
          contextRef: anchor,
          contextX: 0,
          contextY: 0
        }}
        onClickOutside={onClickOutside}
      >
        <div>menu item</div>
      </ContextMenu>
    );

    await waitFor(() =>
      expect(addSpy.mock.calls.some(([type]) => type === "mousedown")).toBe(true)
    );

    fireEvent.mouseDown(document.body);
    fireEvent.keyDown(document, { code: "Escape" });

    expect(onClickOutside).toHaveBeenCalledTimes(2);

    unmount();
    anchor.remove();

    expect(removeSpy.mock.calls.find(([type]) => type === "mousedown")?.[1]).toBe(
      addSpy.mock.calls.find(([type]) => type === "mousedown")?.[1]
    );
    expect(removeSpy.mock.calls.find(([type]) => type === "keydown")?.[1]).toBe(
      addSpy.mock.calls.find(([type]) => type === "keydown")?.[1]
    );
  });

  it("Tooltip removes target listeners and clears pending show timers on unmount", () => {
    const addSpy = vi.spyOn(HTMLElement.prototype, "addEventListener");
    const removeSpy = vi.spyOn(HTMLElement.prototype, "removeEventListener");

    function TooltipHost() {
      const [target, setTarget] = useState<HTMLButtonElement | null>(null);
      return (
        <>
          <button ref={setTarget}>target</button>
          <Tooltip refElement={target} showDelay={20}>
            tooltip text
          </Tooltip>
        </>
      );
    }

    const { unmount } = renderWithProviders(<TooltipHost />);
    fireEvent.mouseEnter(screen.getByText("target"));

    unmount();
    act(() => {
      vi.advanceTimersByTime(20);
    });

    expect(screen.queryByText("tooltip text")).not.toBeInTheDocument();
    expect(removeSpy.mock.calls.find(([type]) => type === "mouseenter")?.[1]).toBe(
      addSpy.mock.calls.find(([type]) => type === "mouseenter")?.[1]
    );
    expect(removeSpy.mock.calls.find(([type]) => type === "mouseleave")?.[1]).toBe(
      addSpy.mock.calls.find(([type]) => type === "mouseleave")?.[1]
    );
  });
});
