/**
 * The history cursor's UI (`.plans/LITE_STEP_BACK_PLAN.md` §6.3): the CPU panel in the past (its
 * band, what the record cannot tell, what the previous step changed), the status-bar chip and the
 * toolbar's reverse controls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderWithProviders, screen, createMockStore, act, fireEvent } from "../react-test-utils";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import {
  setHistoryPositionAction,
  setMachineStateAction,
  setMachineTypeAction
} from "@state/actions";
import type { Z80CpuState } from "@common/messaging/EmuApi";

const executeCommand = vi.fn().mockResolvedValue(undefined);

let cpuState: Partial<Z80CpuState> = {};
const emuApi = {
  issueMachineCommand: vi.fn().mockResolvedValue(undefined),
  getCpuState: vi.fn(async (options?: { present?: boolean }) =>
    options?.present ? { ...cpuState, af: 0x9999, history: undefined } : cpuState
  )
};
vi.mock("@renderer/core/EmuApi", () => ({ useEmuApi: () => emuApi }));

const listeners: (() => Promise<void> | void)[] = [];
vi.mock("@renderer/appIde/useStateRefresh", () => ({
  useEmuStateListener: (_api: unknown, fn: () => Promise<void> | void) => {
    listeners.push(fn);
  }
}));

vi.mock("@renderer/core/IdeApi", () => ({
  useIdeApi: () => ({ executeCommand })
}));

vi.mock("@renderer/core/MainApi", () => ({
  useMainApi: () => ({ getUserSettings: vi.fn().mockResolvedValue({}) })
}));

vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    outputPaneService: { getOutputPaneBuffer: () => ({ clear: vi.fn() }) },
    ideCommandsService: { executeCommand },
    projectService: { getActiveDocumentHubService: () => undefined }
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

const { ExecutionControls } = await import("@controls/ExecutionControls");
const { Z80CpuPanel } = await import("@renderer/appIde/SideBarPanels/Z80CpuPanel");
const { IdeStatusBar } = await import("@renderer/appIde/StatusBar/IdeStatusBar");

beforeEach(() => {
  executeCommand.mockClear();
  listeners.length = 0;
});

function pausedStore(machineId = "sp48") {
  const store = createMockStore();
  store.dispatch(setMachineTypeAction(machineId), "emu");
  store.dispatch(setMachineStateAction(MachineControllerState.Paused, 0), "emu");
  return store;
}

const REGS = {
  pc: 0x8200,
  af: 0x0244,
  bc: 0x0000,
  de: 0x0000,
  hl: 0x0000,
  af_: 0,
  bc_: 0,
  de_: 0,
  hl_: 0,
  ix: 0,
  iy: 0,
  sp: 0x8ffc,
  ir: 0x3f10,
  wz: 0,
  iff1: false,
  iff2: false,
  interruptMode: 1
};

describe("the reverse controls", () => {
  it("offer Step Back on a machine that records history, and the rest only in the past", async () => {
    const store = pausedStore();
    await act(async () => {
      renderWithProviders(<ExecutionControls ide={true} kliveProjectLoaded={true} />, { store });
    });
    expect(screen.getByText("step-back").closest("button")).not.toBeDisabled();
    expect(screen.getByText("step-forward-history").closest("button")).toBeDisabled();
    expect(screen.getByText("history-present").closest("button")).toBeDisabled();
    expect(screen.getByText("step-into").closest("button")!.title).not.toMatch(/present/);

    await act(async () => {
      store.dispatch(setHistoryPositionAction(4, 120), "emu");
    });
    expect(screen.getByText("step-forward-history").closest("button")).not.toBeDisabled();
    expect(screen.getByText("history-present").closest("button")).not.toBeDisabled();
    // --- Forward commands act on the live machine (D5), and say so
    expect(screen.getByText("step-into").closest("button")!.title).toMatch(/resumes from the present/);

    fireEvent.click(screen.getByText("step-back"));
    expect(executeCommand).toHaveBeenCalledWith("step-back");
  });

  it("are absent on a machine without history", async () => {
    const store = pausedStore("c64");
    await act(async () => {
      renderWithProviders(<ExecutionControls ide={true} kliveProjectLoaded={true} />, { store });
    });
    expect(screen.queryByText("step-back")).toBeNull();
  });

  it("a machine leaving Paused drops the cursor from the store (D1)", () => {
    const store = pausedStore();
    store.dispatch(setHistoryPositionAction(4, 120), "emu");
    expect(store.getState().emulatorState.historyPosition).toBe(4);
    store.dispatch(setMachineStateAction(MachineControllerState.Running, 0), "emu");
    expect(store.getState().emulatorState.historyPosition).toBeUndefined();
  });
});

describe("the Z80 CPU panel in the past", () => {
  it("shows the band, marks what the previous step changed and leaves unknowns unknown", async () => {
    cpuState = {
      ...REGS,
      tacts: 123456,
      tactsAtLastStart: 0,
      lastMemoryReadValue: 0x12,
      history: {
        position: 42,
        sequence: 1000,
        frame: 1203,
        tact: 500,
        enteredBy: "int",
        enteredByMode: 2,
        previousRegs: { ...REGS, af: 0x0144, pc: 0x8100 },
        memoryIsHistorical: false
      }
    };
    const store = pausedStore();
    await act(async () => {
      renderWithProviders(<Z80CpuPanel />, { store });
    });
    await act(async () => {
      for (const listener of listeners) await listener();
    });
    expect(screen.getByText("History · step −42")).toBeInTheDocument();
    expect(screen.getByText("frame 1,203")).toBeInTheDocument();
    expect(screen.getByText("memory shows the present")).toBeInTheDocument();
    expect(screen.getByText("entered by IM 2 interrupt")).toBeInTheDocument();
    // --- AF and PC moved since the previous step; BC did not
    const changed = (text: string) => screen.getByText(text).className.includes("changedWash");
    expect(changed("0244")).toBe(true);
    expect(changed("8200")).toBe(true);
    expect(changed("8FFC")).toBe(false);
    // --- The T-state counter is not in a record (T9)
    expect(screen.queryByText("123456")).toBeNull();

    fireEvent.click(screen.getByText("Present"));
    expect(executeCommand).toHaveBeenCalledWith("history-present");
  });

  it("shows no band at the present", async () => {
    cpuState = { ...REGS, tacts: 123456, tactsAtLastStart: 0 };
    await act(async () => {
      renderWithProviders(<Z80CpuPanel />, { store: pausedStore() });
    });
    await act(async () => {
      for (const listener of listeners) await listener();
    });
    expect(screen.queryByText(/History ·/)).toBeNull();
    expect(screen.getAllByText("123456").length).toBeGreaterThan(0);
  });
});

describe("the status bar", () => {
  it("shows the history chip, which returns to the present", async () => {
    const store = pausedStore();
    store.dispatch(setHistoryPositionAction(42, 1000), "emu");
    await act(async () => {
      renderWithProviders(<IdeStatusBar show={true} />, { store });
    });
    fireEvent.click(screen.getByText("⟲ History −42"));
    expect(executeCommand).toHaveBeenCalledWith("history-present");
  });
});
