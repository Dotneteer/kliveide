import { beforeEach, describe, expect, it, vi } from "vitest";

/* `.plans/TRACE_EXPORT_PLAN.md` §4.3: the save dialog that remembers its folder, and the menu's export */

const env = vi.hoisted(() => ({
  showSaveDialog: vi.fn(),
  showMessageBox: vi.fn(),
  executeCommand: vi.fn(),
  settings: { folders: {} as Record<string, string> },
  state: {} as any
}));

vi.mock("electron", () => ({
  app: { getPath: () => "/home/me" },
  dialog: { showSaveDialog: env.showSaveDialog, showMessageBox: env.showMessageBox }
}));
vi.mock("@main/settings-utils", () => ({ appSettings: env.settings, saveAppSettings: vi.fn() }));
vi.mock("@main/main-store", () => ({ mainStore: { getState: () => env.state } }));
vi.mock("@messaging/MainToIdeMessenger", () => ({ getIdeApi: () => ({ executeCommand: env.executeCommand }) }));

import { displaySaveFileDialog } from "@main/save-file-dialog";
import { canExportHistory, defaultTraceFileName, exportExecutionHistoryAs } from "@main/history-export";
import { MachineControllerState } from "@abstractions/MachineControllerState";

const window = {} as any;

beforeEach(() => {
  env.showSaveDialog.mockReset();
  env.showMessageBox.mockReset();
  env.executeCommand.mockReset().mockResolvedValue({ success: true });
  env.settings.folders = {};
  env.state = {
    emulatorState: { machineId: "sp48", machineState: MachineControllerState.Paused, advancedDebugging: true },
    project: {}
  };
});

describe("save file dialog", () => {
  it("opens in the remembered folder and remembers the new one", async () => {
    env.settings.folders.historyExport = "/traces";
    env.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/elsewhere/run2.txt" });
    expect(await displaySaveFileDialog(window, { defaultPath: "run.txt", settingsId: "historyExport" })).toBe("/elsewhere/run2.txt");
    expect(env.showSaveDialog.mock.calls[0][1]).toMatchObject({ defaultPath: "/traces/run.txt" });
    expect(env.settings.folders.historyExport).toBe("/elsewhere");
  });

  it("returns undefined when canceled", async () => {
    env.showSaveDialog.mockResolvedValue({ canceled: true });
    expect(await displaySaveFileDialog(window, { defaultPath: "/abs/run.txt" })).toBeUndefined();
    expect(env.showSaveDialog.mock.calls[0][1]).toMatchObject({ defaultPath: "/abs/run.txt" });
  });
});

describe("Debug › Export Execution History...", () => {
  it("is enabled for a history machine that is not running", () => {
    expect(canExportHistory(env.state)).toBe(true);
    expect(canExportHistory({ emulatorState: { machineId: "sp48", machineState: MachineControllerState.Running } } as any)).toBe(false);
    expect(canExportHistory({ emulatorState: { machineId: "c64", machineState: MachineControllerState.Paused } } as any)).toBe(false);
  });

  it("suggests the project's name", () => {
    expect(defaultTraceFileName({ project: { folderPath: "/p/mygame" } } as any)).toBe("mygame-trace.txt");
    expect(defaultTraceFileName(env.state)).toBe("sp48-trace.txt");
  });

  it("runs history-export with -f, and shows a failure", async () => {
    env.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/traces/run1.csv" });
    await exportExecutionHistoryAs(window);
    expect(env.executeCommand).toHaveBeenCalledWith('history-export "/traces/run1.csv" -f');
    env.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/traces/run1" });
    env.executeCommand.mockResolvedValue({ success: false, finalMessage: "Pause the machine first" });
    await exportExecutionHistoryAs(window);
    expect(env.executeCommand).toHaveBeenLastCalledWith('history-export "/traces/run1" -f -format text');
    expect(env.showMessageBox.mock.calls[0][1]).toMatchObject({ type: "error", message: "Pause the machine first" });
  });
});
