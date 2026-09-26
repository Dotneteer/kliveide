/**
 * Step 1.4 — EmuStatusBar event listener cleanup
 *
 * Verifies that controller.frameCompleted.off() is called when the
 * component unmounts (preventing listener accumulation on each render).
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderWithProviders, act } from "../react-test-utils";
import { EmuStatusBar } from "@renderer/appEmu/StatusBar/EmuStatusBar";

// ---------------------------------------------------------------------------
// Stubs for Electron-dependent hooks
// ---------------------------------------------------------------------------

const mockFrameCompleted = {
  on: vi.fn(),
  off: vi.fn()
};

const mockController = {
  frameCompleted: mockFrameCompleted,
  frameStats: { lastFrameTimeInMs: 0, avgFrameTimeInMs: 0, frameCount: 0 },
  machine: { baseClockFrequency: 3_500_000, pc: 0x8000 }
};

vi.mock("@renderer/core/useMachineController", () => ({
  useMachineController: () => mockController
}));

vi.mock("@appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    machineService: {
      getMachineInfo: () => ({
        machine: { displayName: "ZX Spectrum 48K" },
        model: undefined
      }),
      getMachineController: () => mockController,
      newMachineTypeInitialized: () => () => {}
    },
    outputPaneService: {
      getOutputPaneBuffer: () => null
    },
    uiService: { dragging: false }
  })
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EmuStatusBar — Step 1.4: frameCompleted listener cleanup", () => {
  it("subscribes to frameCompleted on mount", async () => {
    mockFrameCompleted.on.mockClear();

    await act(async () => {
      renderWithProviders(<EmuStatusBar show={true} />);
    });

    expect(mockFrameCompleted.on).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes from frameCompleted on unmount", async () => {
    mockFrameCompleted.on.mockClear();
    mockFrameCompleted.off.mockClear();

    let unmount: () => void;
    await act(async () => {
      ({ unmount } = renderWithProviders(<EmuStatusBar show={true} />));
    });

    await act(async () => {
      unmount();
    });

    expect(mockFrameCompleted.off).toHaveBeenCalledTimes(1);
    // The same handler instance must be used for on and off
    const subscribedFn = mockFrameCompleted.on.mock.calls[0][0];
    const unsubscribedFn = mockFrameCompleted.off.mock.calls[0][0];
    expect(subscribedFn).toBe(unsubscribedFn);
  });
});

/*
 * Issue #1377: the frame times, frame count and PC are debugging aids that change every few frames.
 * They can be switched off; the machine name and clock frequency stay.
 */
describe("EmuStatusBar — performance info", () => {
  it("shows the frame stats and PC by default", async () => {
    let container: HTMLElement;
    await act(async () => {
      ({ container } = renderWithProviders(<EmuStatusBar show={true} />));
    });
    expect(container.textContent).toContain("PC:");
    expect(container.textContent).toContain("8000");
    expect(container.textContent).toContain("MHz");
  });

  it("hides them, keeping the clock frequency, when switched off", async () => {
    let container: HTMLElement;
    await act(async () => {
      ({ container } = renderWithProviders(
        <EmuStatusBar show={true} showPerformanceInfo={false} />
      ));
    });
    expect(container.textContent).not.toContain("PC:");
    expect(container.textContent).not.toContain("8000");
    expect(container.textContent).toContain("MHz");
  });

  it("does not re-render on frames while the stats are hidden", async () => {
    mockFrameCompleted.on.mockClear();
    let container: HTMLElement;
    await act(async () => {
      ({ container } = renderWithProviders(
        <EmuStatusBar show={true} showPerformanceInfo={false} />
      ));
    });
    const handler = mockFrameCompleted.on.mock.calls[0][0];
    // --- The handler copies `controller.frameStats` whenever it updates the display
    const stats = mockController.frameStats;
    const reads = vi.fn(() => stats);
    Object.defineProperty(mockController, "frameStats", { get: reads, configurable: true });
    try {
      await act(async () => {
        handler({});
        handler(undefined);
      });
    } finally {
      Object.defineProperty(mockController, "frameStats", {
        value: stats,
        writable: true,
        configurable: true
      });
    }
    expect(reads).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("PC:");
  });
});
