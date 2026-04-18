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
  machine: { baseClockFrequency: 3_500_000 }
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
