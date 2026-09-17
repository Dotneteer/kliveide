/**
 * The resume button's mode follows the machine's debug flag, however the run was started.
 *
 * A debug run started outside the toolbar — `nex-run -e` breaking at a NEX entry point, a script,
 * the menu — used to leave the resume button on "Continue (F5)" until the first step switched it.
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderWithProviders, screen, createMockStore, act } from "../react-test-utils";
import { ExecutionControls } from "@controls/ExecutionControls";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { setDebuggingAction, setMachineStateAction } from "@state/actions";

vi.mock("@renderer/core/EmuApi", () => ({
  useEmuApi: () => ({ issueMachineCommand: vi.fn().mockResolvedValue(undefined) })
}));

vi.mock("@renderer/core/IdeApi", () => ({
  useIdeApi: () => ({ executeCommand: vi.fn().mockResolvedValue(undefined) })
}));

vi.mock("@renderer/core/MainApi", () => ({
  useMainApi: () => ({ getUserSettings: vi.fn().mockResolvedValue({}) })
}));

vi.mock("@appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    outputPaneService: { getOutputPaneBuffer: () => ({ clear: vi.fn() }) },
    ideCommandsService: { executeCommand: vi.fn().mockResolvedValue(undefined) }
  })
}));

// --- IconButton renders its title through a tooltip portal; a plain button keeps getByTitle simple.
vi.mock("@controls/IconButton", () => ({
  IconButton: ({ title, clicked, enable, iconName }: any) => (
    <button title={title} disabled={enable === false} onClick={() => clicked?.()}>
      {iconName}
    </button>
  )
}));

(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

async function renderPaused(isDebugging: boolean) {
  const store = createMockStore();
  store.dispatch(setDebuggingAction(isDebugging), "emu");
  store.dispatch(setMachineStateAction(MachineControllerState.Paused), "emu");
  await act(async () => {
    renderWithProviders(<ExecutionControls ide={true} kliveProjectLoaded={true} />, { store });
  });
  return store;
}

describe("ExecutionControls resume mode", () => {
  it("offers to continue debugging when paused in a debug run started elsewhere", async () => {
    await renderPaused(true);

    expect(screen.getByTitle(/Continue Debugging \(Ctrl\+F5\)/i)).not.toBeDisabled();
    expect(screen.queryByTitle(/^Continue \(F5\)/i)).not.toBeInTheDocument();
  });

  it("offers to continue normally when paused in a normal run", async () => {
    await renderPaused(false);

    expect(screen.getByTitle(/^Continue \(F5\)/i)).not.toBeDisabled();
  });

  it("switches to debugging when the machine enters debug mode while mounted", async () => {
    const store = createMockStore();
    store.dispatch(setMachineStateAction(MachineControllerState.Running), "emu");
    await act(async () => {
      renderWithProviders(<ExecutionControls ide={true} kliveProjectLoaded={true} />, { store });
    });
    expect(screen.getByTitle(/^Continue \(F5\)/i)).toBeInTheDocument();

    // --- What the NEX launch does: switch the running machine to debug, then hit the entry stop.
    await act(async () => {
      store.dispatch(setDebuggingAction(true), "emu");
      store.dispatch(setMachineStateAction(MachineControllerState.Paused), "emu");
    });

    expect(screen.getByTitle(/Continue Debugging \(Ctrl\+F5\)/i)).not.toBeDisabled();
  });

  it("switches back when the machine leaves debug mode", async () => {
    const store = await renderPaused(true);

    await act(async () => {
      store.dispatch(setDebuggingAction(false), "emu");
    });

    expect(screen.getByTitle(/^Continue \(F5\)/i)).toBeInTheDocument();
  });
});
