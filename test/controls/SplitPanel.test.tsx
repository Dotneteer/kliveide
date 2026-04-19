/**
 * Step 1.7 — SplitPanel drag listener cleanup
 *
 * The fix stores move/endMove in refs so that window.removeEventListener
 * always matches what was added, even if a re-render occurs mid-drag.
 */

import { describe, it, expect, vi } from "vitest";
import React, { act } from "react";
import { renderWithProviders, fireEvent } from "../react-test-utils";
import { SplitPanel } from "@controls/SplitPanel";

// ---------------------------------------------------------------------------
// Mock useAppServices (SplitPanel's Splitter child reads uiService.dragging)
// ---------------------------------------------------------------------------

vi.mock("@appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    uiService: { dragging: false }
  })
}));

// ResizeObserver is used by useResizeObserver inside SplitPanel
(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSplitPanel() {
  return renderWithProviders(
    <SplitPanel primaryLocation="left" initialPrimarySize={200}>
      <div data-testid="primary">Primary</div>
      <div data-testid="secondary">Secondary</div>
    </SplitPanel>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SplitPanel — Step 1.7: drag listener cleanup via refs", () => {
  it("renders both panels", () => {
    const { getByTestId } = renderSplitPanel();
    expect(getByTestId("primary")).toBeInTheDocument();
    expect(getByTestId("secondary")).toBeInTheDocument();
  });

  it("adds mousemove and mouseup listeners to window on splitter mousedown", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    renderSplitPanel();

    const splitter = document.querySelector('[class*="splitter"]') as HTMLElement;
    expect(splitter).not.toBeNull();

    await act(async () => {
      fireEvent.mouseDown(splitter, { button: 0, clientX: 200, clientY: 0 });
    });

    const mousemoveCalls = addSpy.mock.calls.filter(([type]) => type === "mousemove");
    const mouseupCalls = addSpy.mock.calls.filter(([type]) => type === "mouseup");
    expect(mousemoveCalls.length).toBeGreaterThan(0);
    expect(mouseupCalls.length).toBeGreaterThan(0);

    addSpy.mockRestore();
  });

  it("removes mousemove and mouseup listeners on mouseup", async () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    renderSplitPanel();

    const splitter = document.querySelector('[class*="splitter"]') as HTMLElement;

    await act(async () => {
      fireEvent.mouseDown(splitter, { button: 0, clientX: 200, clientY: 0 });
    });
    await act(async () => {
      fireEvent.mouseUp(window);
    });

    const removedMousemove = removeSpy.mock.calls.filter(([type]) => type === "mousemove");
    const removedMouseup = removeSpy.mock.calls.filter(([type]) => type === "mouseup");
    expect(removedMousemove.length).toBeGreaterThan(0);
    expect(removedMouseup.length).toBeGreaterThan(0);

    removeSpy.mockRestore();
  });

  it("removeEventListener uses the same function reference that was added", async () => {
    // Use pass-through spies so listeners are actually registered and fired
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    renderSplitPanel();
    const splitter = document.querySelector('[class*="splitter"]') as HTMLElement;

    await act(async () => {
      fireEvent.mouseDown(splitter, { button: 0, clientX: 200, clientY: 0 });
    });
    await act(async () => {
      fireEvent.mouseUp(window);
    });

    const addedMove = addSpy.mock.calls.find(([type]) => type === "mousemove")?.[1];
    const addedEndMove = addSpy.mock.calls.find(([type]) => type === "mouseup")?.[1];
    const removedMove = removeSpy.mock.calls.find(([type]) => type === "mousemove")?.[1];
    const removedEndMove = removeSpy.mock.calls.find(([type]) => type === "mouseup")?.[1];

    // The exact same function object must be passed to both add and remove
    expect(removedMove).toBe(addedMove);
    expect(removedEndMove).toBe(addedEndMove);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
