/**
 * The toolbar's source-level stepping controls (plan §10.2.8): Step Over Line and the Source / Z80
 * toggle appear only for a program built with source-level debug info, and drive the emulator.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderWithProviders, screen, createMockStore, act, fireEvent } from "../react-test-utils";
import { ExecutionControls } from "@controls/ExecutionControls";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { endCompileAction, setDebuggingAction, setMachineStateAction } from "@state/actions";

const emu = {
  issueMachineCommand: vi.fn().mockResolvedValue(undefined),
  sourceStep: vi.fn().mockResolvedValue(undefined),
  setSourceStepping: vi.fn().mockResolvedValue(undefined),
  getSourceStepping: vi.fn().mockResolvedValue(true)
};

vi.mock("@renderer/core/EmuApi", () => ({ useEmuApi: () => emu }));

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

const withSourceLevel = { segments: [], sourceFileList: [], sourceMap: {}, listFileItems: [], errors: [], sourceLevelDebug: { files: [], statements: [], callables: [], addressToStatement: [] } };
const withoutSourceLevel = { segments: [], sourceFileList: [], sourceMap: {}, listFileItems: [], errors: [] };

async function renderPaused(result: object) {
  const store = createMockStore();
  store.dispatch(endCompileAction(result));
  store.dispatch(setDebuggingAction(true), "emu");
  store.dispatch(setMachineStateAction(MachineControllerState.Paused), "emu");
  await act(async () => {
    renderWithProviders(<ExecutionControls ide={true} kliveProjectLoaded={true} />, { store });
  });
}

describe("ExecutionControls source stepping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers nothing extra for a program without source-level debug info", async () => {
    await renderPaused(withoutSourceLevel);
    expect(screen.queryByTitle(/Step Over Line/)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Stepping source statements/)).not.toBeInTheDocument();
  });

  it("steps over a line", async () => {
    await renderPaused(withSourceLevel);
    await act(async () => {
      fireEvent.click(screen.getByTitle("Step Over Line (Shift+F10)"));
    });
    expect(emu.sourceStep).toHaveBeenCalledWith("overLine");
  });

  it("switches between source and Z80 stepping", async () => {
    await renderPaused(withSourceLevel);
    await act(async () => {
      fireEvent.click(screen.getByTitle(/Stepping source statements/));
    });
    expect(emu.setSourceStepping).toHaveBeenCalledWith(false);
    expect(screen.getByTitle(/Stepping Z80 instructions/)).toBeInTheDocument();
    // --- Step Over Line is a source step: not offered while stepping instructions
    expect(screen.getByTitle("Step Over Line (Shift+F10)")).toBeDisabled();
  });
});
