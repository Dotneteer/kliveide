/**
 * Phase 8 — Step 8.3: SplitPanel component tests
 *
 * Tests: renders two panes, splitter drag updates sizes, callback fires on
 * resize complete, visibility toggling, horizontal/vertical layouts.
 */

import { describe, it, expect, vi } from "vitest";
import React, { act } from "react";
import { renderWithProviders, fireEvent } from "../react-test-utils";
import { SplitPanel } from "@controls/SplitPanel";

// ---------------------------------------------------------------------------
// Mock useAppServices — Splitter reads uiService.dragging
// ---------------------------------------------------------------------------

vi.mock("@appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    uiService: { dragging: false }
  })
}));

// ResizeObserver stub
(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSplit(overrides: Partial<Parameters<typeof SplitPanel>[0]> = {}) {
  return renderWithProviders(
    <SplitPanel primaryLocation="left" initialPrimarySize={200} {...overrides}>
      <div data-testid="primary">Primary</div>
      <div data-testid="secondary">Secondary</div>
    </SplitPanel>
  );
}

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

describe("SplitPanel — basic rendering", () => {
  it("renders both primary and secondary panels", () => {
    const { getByTestId } = renderSplit();
    expect(getByTestId("primary")).toBeInTheDocument();
    expect(getByTestId("secondary")).toBeInTheDocument();
  });

  it("renders a splitter element between the panes", () => {
    renderSplit();
    const splitter = document.querySelector('[class*="splitter"]');
    expect(splitter).not.toBeNull();
  });

  it("hides the primary panel when primaryVisible=false", () => {
    const { queryByTestId } = renderSplit({ primaryVisible: false });
    expect(queryByTestId("primary")).not.toBeInTheDocument();
  });

  it("hides the secondary panel when secondaryVisible=false", () => {
    const { queryByTestId } = renderSplit({ secondaryVisible: false });
    expect(queryByTestId("secondary")).not.toBeInTheDocument();
  });

  it("hides the splitter when primary is not visible", () => {
    renderSplit({ primaryVisible: false });
    const splitter = document.querySelector('[class*="splitter"]');
    expect(splitter).toBeNull();
  });

  it("hides the splitter when secondary is not visible", () => {
    renderSplit({ secondaryVisible: false });
    const splitter = document.querySelector('[class*="splitter"]');
    expect(splitter).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Splitter drag interaction
// ---------------------------------------------------------------------------

describe("SplitPanel — splitter drag", () => {
  it("adds mousemove/mouseup listeners on mousedown", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    renderSplit();

    const splitter = document.querySelector('[class*="splitter"]') as HTMLElement;
    await act(async () => {
      fireEvent.mouseDown(splitter, { button: 0, clientX: 200, clientY: 0 });
    });

    const moveAdded = addSpy.mock.calls.some(([t]) => t === "mousemove");
    const upAdded = addSpy.mock.calls.some(([t]) => t === "mouseup");
    expect(moveAdded).toBe(true);
    expect(upAdded).toBe(true);

    // Clean up
    await act(async () => { fireEvent.mouseUp(window); });
    addSpy.mockRestore();
  });

  it("removes mousemove/mouseup listeners on mouseup", async () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    renderSplit();

    const splitter = document.querySelector('[class*="splitter"]') as HTMLElement;
    await act(async () => {
      fireEvent.mouseDown(splitter, { button: 0, clientX: 200, clientY: 0 });
    });
    await act(async () => {
      fireEvent.mouseUp(window);
    });

    const moveRemoved = removeSpy.mock.calls.some(([t]) => t === "mousemove");
    const upRemoved = removeSpy.mock.calls.some(([t]) => t === "mouseup");
    expect(moveRemoved).toBe(true);
    expect(upRemoved).toBe(true);

    removeSpy.mockRestore();
  });

  it("fires onPrimarySizeUpdateCompleted on drag end", async () => {
    const onCompleted = vi.fn();
    renderSplit({ onPrimarySizeUpdateCompleted: onCompleted });

    const splitter = document.querySelector('[class*="splitter"]') as HTMLElement;
    await act(async () => {
      fireEvent.mouseDown(splitter, { button: 0, clientX: 200, clientY: 0 });
    });
    await act(async () => {
      fireEvent.mouseMove(window, { clientX: 250, clientY: 0 });
    });
    await act(async () => {
      fireEvent.mouseUp(window);
    });

    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(typeof onCompleted.mock.calls[0][0]).toBe("string");
  });

  it("does not start drag on right-click (button !== 0)", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    renderSplit();

    const splitter = document.querySelector('[class*="splitter"]') as HTMLElement;
    await act(async () => {
      fireEvent.mouseDown(splitter, { button: 2, clientX: 200, clientY: 0 });
    });

    const moveAdded = addSpy.mock.calls.some(([t]) => t === "mousemove");
    expect(moveAdded).toBe(false);

    addSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Primary location variants
// ---------------------------------------------------------------------------

describe("SplitPanel — layout variants", () => {
  it("renders with primaryLocation='right'", () => {
    const { getByTestId } = renderSplit({ primaryLocation: "right" });
    expect(getByTestId("primary")).toBeInTheDocument();
    expect(getByTestId("secondary")).toBeInTheDocument();
  });

  it("renders with primaryLocation='top'", () => {
    const { getByTestId } = renderSplit({ primaryLocation: "top" });
    expect(getByTestId("primary")).toBeInTheDocument();
    expect(getByTestId("secondary")).toBeInTheDocument();
  });

  it("renders with primaryLocation='bottom'", () => {
    const { getByTestId } = renderSplit({ primaryLocation: "bottom" });
    expect(getByTestId("primary")).toBeInTheDocument();
    expect(getByTestId("secondary")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Size update callback
// ---------------------------------------------------------------------------

describe("SplitPanel — onUpdatePrimarySize callback", () => {
  it("fires on initial render with the resolved size", () => {
    const onUpdate = vi.fn();
    renderSplit({ onUpdatePrimarySize: onUpdate });
    // Should be called at least once during initial layout
    expect(onUpdate).toHaveBeenCalled();
  });
});
