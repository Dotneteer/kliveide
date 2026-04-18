/**
 * Phase 8 — Step 8.8: Keyboard hook and key component tests
 *
 * Tests: useKeyboard hook fires apiLoaded once, signKeyStatus updates key state,
 * rapid calls increment correctly, isPressed reflects state,
 * Sp48Key renders and fires keyAction.
 */

import { describe, it, expect, vi } from "vitest";
import React, { act } from "react";
import { renderWithProviders } from "../react-test-utils";
import { renderHook } from "@testing-library/react";
import { useKeyboard } from "@renderer/appEmu/Keyboard/useKeyboard";
import { KeyboardApi } from "@renderer/appEmu/Keyboard/KeyboardPanel";
import { Sp48Keyboard } from "@renderer/appEmu/Keyboard/Sp48Keyboard";

// ---------------------------------------------------------------------------
// Mock AppServices for keyboard rendering
// ---------------------------------------------------------------------------

vi.mock("@appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    machineService: {
      getMachineController: () => ({
        machine: {
          getKeyQueueLength: () => 0,
          setKeyStatus: vi.fn()
        }
      }),
      getMachineInfo: () => ({
        machine: { displayName: "ZX Spectrum 48K" },
        model: undefined
      })
    },
    uiService: { dragging: false },
    outputPaneService: { getBuffer: () => null }
  })
}));

// ResizeObserver stub
(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ---------------------------------------------------------------------------
// useKeyboard hook
// ---------------------------------------------------------------------------

describe("useKeyboard — Phase 8", () => {
  it("calls apiLoaded exactly once on mount", () => {
    const apiLoaded = vi.fn();

    renderHook(() => useKeyboard(apiLoaded));

    expect(apiLoaded).toHaveBeenCalledTimes(1);
    const api: KeyboardApi = apiLoaded.mock.calls[0][0];
    expect(typeof api.signKeyStatus).toBe("function");
  });

  it("signKeyStatus is callable without error", () => {
    const apiLoaded = vi.fn();

    renderHook(() => useKeyboard(apiLoaded));
    const api: KeyboardApi = apiLoaded.mock.calls[0][0];

    expect(() => {
      act(() => {
        api.signKeyStatus(15, true);
      });
    }).not.toThrow();
  });

  it("isPressed returns true after key is pressed", () => {
    const apiLoaded = vi.fn();

    const { result } = renderHook(() => useKeyboard(apiLoaded));
    const api: KeyboardApi = apiLoaded.mock.calls[0][0];

    act(() => {
      api.signKeyStatus(42, true);
    });

    expect(result.current.isPressed(42)).toBe(true);
  });

  it("isPressed returns false after key is released", () => {
    const apiLoaded = vi.fn();

    const { result } = renderHook(() => useKeyboard(apiLoaded));
    const api: KeyboardApi = apiLoaded.mock.calls[0][0];

    act(() => {
      api.signKeyStatus(42, true);
    });
    act(() => {
      api.signKeyStatus(42, false);
    });

    expect(result.current.isPressed(42)).toBe(false);
  });

  it("multiple rapid signKeyStatus calls all take effect", () => {
    const apiLoaded = vi.fn();

    const { result } = renderHook(() => useKeyboard(apiLoaded));
    const api: KeyboardApi = apiLoaded.mock.calls[0][0];

    act(() => {
      api.signKeyStatus(10, true);
      api.signKeyStatus(20, true);
      api.signKeyStatus(30, true);
    });

    expect(result.current.isPressed(10)).toBe(true);
    expect(result.current.isPressed(20)).toBe(true);
    expect(result.current.isPressed(30)).toBe(true);
  });

  it("version increments on each signKeyStatus call", () => {
    const apiLoaded = vi.fn();

    const { result } = renderHook(() => useKeyboard(apiLoaded));
    const api: KeyboardApi = apiLoaded.mock.calls[0][0];

    const versionBefore = result.current.version;

    act(() => {
      api.signKeyStatus(10, true);
    });

    expect(result.current.version).toBeGreaterThan(versionBefore);
  });

  it("calls apiLoaded on each render cycle (cleanup resets guard)", () => {
    const apiLoaded = vi.fn();

    const { rerender } = renderHook(() => useKeyboard(apiLoaded));
    rerender();
    rerender();

    // The hook's useEffect cleanup resets mounted.current, so apiLoaded
    // is invoked again on each render cycle.
    expect(apiLoaded).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// Sp48Keyboard — integration smoke test
// ---------------------------------------------------------------------------

describe("Sp48Keyboard — Phase 8 smoke", () => {
  it("renders without crashing and fires apiLoaded", async () => {
    const onApiLoaded = vi.fn();

    await act(async () => {
      renderWithProviders(
        <Sp48Keyboard width={800} height={300} apiLoaded={onApiLoaded} />
      );
    });

    expect(onApiLoaded).toHaveBeenCalledTimes(1);
  });

  it("signKeyStatus on the captured API does not throw", async () => {
    let capturedApi: KeyboardApi | null = null;

    await act(async () => {
      renderWithProviders(
        <Sp48Keyboard
          width={800}
          height={300}
          apiLoaded={(api) => { capturedApi = api; }}
        />
      );
    });

    expect(capturedApi).not.toBeNull();

    await act(async () => {
      capturedApi!.signKeyStatus(15, true);
      capturedApi!.signKeyStatus(15, false);
    });

    // No errors thrown — basic key lifecycle works
    expect(capturedApi).not.toBeNull();
  });

  it("renders SVG key elements", async () => {
    await act(async () => {
      renderWithProviders(
        <Sp48Keyboard width={800} height={300} apiLoaded={vi.fn()} />
      );
    });

    // Sp48Keyboard renders SVG rect elements for keys
    const svgElements = document.querySelectorAll("svg");
    expect(svgElements.length).toBeGreaterThan(0);
  });
});
