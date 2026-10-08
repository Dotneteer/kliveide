import { beforeEach, describe, expect, it, vi } from "vitest";
import { withAdvancedDebugging } from "../advanced-debugging-helper";
import React, { type ReactNode } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { createMockStore, renderWithProviders } from "../react-test-utils";
import { setMachineStateAction, setMachineTypeAction } from "@state/actions";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { encodeHistoryRecord, HistoryKind, type HistoryRecord } from "@common/history/historyRecord";
import { HISTORY_RECORD_SIZE, type ExecutionHistoryInfo } from "@common/history/historyTypes";

/*
 * The Execution History document's export (`.plans/TRACE_EXPORT_PLAN.md` §4.3, Phase 3): the
 * Export button and "Export rows from here to the newest..." ask for a file, then run
 * `history-export` with the document's filter and fold state, so the file holds what the user sees.
 */

vi.hoisted(() => {
  const doc = globalThis.document as unknown as Record<string, unknown>;
  if (doc && typeof doc.queryCommandSupported !== "function") {
    doc.queryCommandSupported = () => false;
    doc.queryCommandEnabled = () => false;
  }
});

const NEWEST = 104;

function record(sequence: number): HistoryRecord {
  return {
    sequence,
    frame: 1,
    frameTact: sequence,
    kind: HistoryKind.Instruction,
    repeat: 1,
    intPending: false,
    bytesTruncated: false,
    bytes: [0x00, 0, 0, 0],
    context: new Uint8Array(16),
    regs: {
      pc: 0x8000 + sequence,
      af: 0, bc: 0, de: 0, hl: 0, af_: 0, bc_: 0, de_: 0, hl_: 0, ix: 0, iy: 0,
      sp: 0xfffe, ir: 0, wz: 0, iff1: false, iff2: false, interruptMode: 1
    }
  };
}

const info: ExecutionHistoryInfo = {
  machineId: "zx81",
  capacity: 65536,
  count: 5,
  newestSequence: NEWEST,
  oldestSequence: 100,
  generation: 1,
  enabled: true
};

const emuApi = vi.hoisted(() => ({
  getHistoryInfo: vi.fn(),
  getHistoryServiceSpans: vi.fn(),
  getHistoryRecords: vi.fn(),
  getCpuState: vi.fn(),
  getPartitionLabels: vi.fn(),
  navigateHistory: vi.fn()
}));
vi.mock("@renderer/core/EmuApi", () => ({ useEmuApi: () => emuApi }));

const mainApi = vi.hoisted(() => ({ showSaveFileDialog: vi.fn(), displayMessageBox: vi.fn() }));
vi.mock("@renderer/core/MainApi", () => ({ useMainApi: () => mainApi }));

const listeners: ((state: MachineControllerState) => Promise<void> | void)[] = [];
vi.mock("@renderer/appIde/useStateRefresh", () => ({
  useEmuStateListener: (_api: unknown, fn: (state: MachineControllerState) => Promise<void> | void) => {
    listeners.push(fn);
  }
}));

const executeCommand = vi.hoisted(() => vi.fn());
const buildPane = vi.hoisted(() => ({ id: "build" }));
vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    ideCommandsService: { executeCommand },
    outputPaneService: { getOutputPaneBuffer: () => buildPane }
  })
}));
vi.mock("@renderer/appIde/services/DocumentServiceProvider", () => ({
  useDocumentHubService: () => ({ isOpen: () => false, setActiveDocument: vi.fn(), openDocument: vi.fn() })
}));
// --- Every row rendered: jsdom has no layout for the virtualizer to measure
vi.mock("@renderer/controls/VirtualizedList", () => ({
  VirtualizedList: (props: { items?: unknown[]; renderItem: (index: number) => ReactNode; apiLoaded?: (api: unknown) => void }) => {
    React.useEffect(() => {
      props.apiLoaded?.({ scrollToIndex: () => {}, scrollTo: () => {} });
    }, []);
    return <div>{(props.items ?? []).map((_, i) => props.renderItem(i))}</div>;
  }
}));

import { createExecutionHistoryPanel } from "@renderer/appIde/DocumentPanels/ExecutionHistoryPanel";

const doc = { id: "$history", name: "Execution History", type: "ExecutionHistory" } as any;

const tick = async (state = MachineControllerState.Paused) => {
  for (const fn of [...listeners]) await fn(state);
};

function setup(machineState = MachineControllerState.Paused) {
  const store = withAdvancedDebugging(createMockStore());
  store.dispatch(setMachineTypeAction("zx81"));
  store.dispatch(setMachineStateAction(machineState, 0));
  renderWithProviders(createExecutionHistoryPanel({ document: doc }), { store });
  return store;
}

const exportButton = () => screen.getByRole("button", { name: /Export the history|Pause the machine/ });

beforeEach(() => {
  listeners.length = 0;
  localStorage.clear();
  emuApi.getHistoryInfo.mockReset().mockResolvedValue(info);
  emuApi.getHistoryServiceSpans.mockReset().mockResolvedValue([]);
  emuApi.getHistoryRecords.mockReset().mockImplementation(async (from: number, count: number) => {
    const first = Math.max(from, info.oldestSequence);
    const n = Math.max(0, Math.min(count, NEWEST - first + 1));
    const bytes = new Uint8Array(n * HISTORY_RECORD_SIZE);
    for (let i = 0; i < n; i++) bytes.set(encodeHistoryRecord(record(first + i)), i * HISTORY_RECORD_SIZE);
    return { info, firstSequence: first, records: bytes, gone: false };
  });
  emuApi.getCpuState.mockReset().mockResolvedValue(record(NEWEST + 1).regs);
  emuApi.getPartitionLabels.mockReset().mockResolvedValue({});
  emuApi.navigateHistory.mockReset().mockResolvedValue({ moved: false, position: 0 });
  mainApi.showSaveFileDialog.mockReset().mockResolvedValue("/traces/run1.txt");
  mainApi.displayMessageBox.mockReset();
  executeCommand.mockReset().mockResolvedValue({ success: true });
});

describe("Execution History document: export", () => {
  it("asks for a file, then exports what the document shows: the ZX81 folds its interrupts", async () => {
    setup();
    await tick();
    await waitFor(() => expect(exportButton().hasAttribute("disabled")).toBe(false));
    fireEvent.click(exportButton());
    await waitFor(() => expect(executeCommand).toHaveBeenCalled());
    expect(mainApi.showSaveFileDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Export Execution History", settingsId: "historyExport", defaultPath: "zx81-trace.txt" })
    );
    // --- The ZX81 folds interrupt service by default, so the file leaves it out too (D7)
    expect(executeCommand).toHaveBeenCalledWith('history-export "/traces/run1.txt" -nointerrupts -f', buildPane);
  });

  it("carries the filter, and keeps the service a filter shows anyway", async () => {
    setup();
    await tick();
    fireEvent.change(screen.getByRole("textbox", { name: "Filter the execution history" }), {
      target: { value: "$8064-$8066" }
    });
    await waitFor(() => expect(exportButton().hasAttribute("disabled")).toBe(false));
    fireEvent.click(exportButton());
    await waitFor(() => expect(executeCommand).toHaveBeenCalled());
    expect(executeCommand).toHaveBeenCalledWith('history-export "/traces/run1.txt" -filter "$8064-$8066" -f', buildPane);
  });

  it("does not fold when the user turned folding off", async () => {
    localStorage.setItem("klive.executionHistory.foldService.zx81", "0");
    setup();
    await tick();
    await waitFor(() => expect(exportButton().hasAttribute("disabled")).toBe(false));
    fireEvent.click(exportButton());
    await waitFor(() => expect(executeCommand).toHaveBeenCalled());
    expect(executeCommand).toHaveBeenCalledWith('history-export "/traces/run1.txt" -f', buildPane);
  });

  it("exports from a row to the newest through the context menu", async () => {
    setup();
    await tick();
    const row = await screen.findByText("8066");
    fireEvent.contextMenu(row);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Export rows from here to the newest..." }));
    await waitFor(() => expect(executeCommand).toHaveBeenCalled());
    expect(executeCommand).toHaveBeenCalledWith('history-export "/traces/run1.txt" -from #102 -nointerrupts -f', buildPane);
  });

  it("runs nothing when the dialog is canceled, and names the format of an unknown extension", async () => {
    setup();
    await tick();
    await waitFor(() => expect(exportButton().hasAttribute("disabled")).toBe(false));
    mainApi.showSaveFileDialog.mockResolvedValueOnce(undefined);
    fireEvent.click(exportButton());
    await waitFor(() => expect(mainApi.showSaveFileDialog).toHaveBeenCalledTimes(1));
    expect(executeCommand).not.toHaveBeenCalled();
    mainApi.showSaveFileDialog.mockResolvedValueOnce("/traces/run1");
    fireEvent.click(exportButton());
    await waitFor(() => expect(executeCommand).toHaveBeenCalled());
    expect(executeCommand.mock.calls[0][0]).toBe('history-export "/traces/run1" -nointerrupts -f -format text');
  });

  it("shows a failed export's message", async () => {
    executeCommand.mockResolvedValue({ success: false, finalMessage: "Could not write it" });
    setup();
    await tick();
    await waitFor(() => expect(exportButton().hasAttribute("disabled")).toBe(false));
    fireEvent.click(exportButton());
    await waitFor(() =>
      expect(mainApi.displayMessageBox).toHaveBeenCalledWith("error", "Export Execution History", "Could not write it")
    );
  });

  it("is disabled while the machine runs (D10)", async () => {
    setup(MachineControllerState.Running);
    await tick(MachineControllerState.Running);
    expect(exportButton().hasAttribute("disabled")).toBe(true);
  });
});
