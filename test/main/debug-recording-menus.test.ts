import { beforeEach, describe, expect, it, vi } from "vitest";

/* `.plans/DEBUG_SESSION_RECORDING_PLAN.md` §4.5: the menus' dialogs and the D16 fallback question */

const env = vi.hoisted(() => ({
  showSaveDialog: vi.fn(),
  showOpenDialog: vi.fn(),
  showMessageBox: vi.fn(),
  executeCommand: vi.fn(),
  settings: { folders: {} as Record<string, string> },
  state: {} as any
}));

vi.mock("electron", () => ({
  app: { getPath: () => "/home/me" },
  dialog: { showSaveDialog: env.showSaveDialog, showOpenDialog: env.showOpenDialog, showMessageBox: env.showMessageBox }
}));
vi.mock("@main/settings-utils", () => ({ appSettings: env.settings, saveAppSettings: vi.fn() }));
vi.mock("@main/main-store", () => ({ mainStore: { getState: () => env.state } }));
vi.mock("@messaging/MainToIdeMessenger", () => ({ getIdeApi: () => ({ executeCommand: env.executeCommand }) }));

import {
  canSaveDebugRecording,
  defaultRecordingFileName,
  openDebugRecordingFile,
  pickAndOpenDebugRecording,
  saveDebugRecordingAs
} from "@main/debug-recording-menus";

const window = {} as any;
const REFUSAL =
  "The recording was recorded by Klive 0.1.0 (build 00000000); this build differs. Use -y to open only its end state, without its past.";

beforeEach(() => {
  for (const f of [env.showSaveDialog, env.showOpenDialog, env.showMessageBox, env.executeCommand]) f.mockReset();
  env.executeCommand.mockResolvedValue({ success: true });
  env.settings.folders = {};
  env.state = { emulatorState: { machineId: "sp48" }, project: { folderPath: "/p/mygame" } };
});

describe("debug recording menus", () => {
  it("saves only with a live timeline, under the project's name", () => {
    expect(canSaveDebugRecording(env.state)).toBe(false);
    expect(canSaveDebugRecording({ emulatorState: { reverseDebug: { active: true, mode: "live" } } } as any)).toBe(true);
    expect(defaultRecordingFileName(env.state)).toBe("mygame-recording.klr");
    expect(defaultRecordingFileName({ emulatorState: { machineId: "zxnext" } } as any)).toBe("zxnext-recording.klr");
  });

  it("saves through drsave -f, adding the extension, and shows a failure", async () => {
    env.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/r/bug" });
    await saveDebugRecordingAs(window);
    expect(env.executeCommand).toHaveBeenCalledWith('debug-recording-save "/r/bug.klr" -f');
    expect(env.settings.folders.debugRecordingFolder).toBe("/r");
    env.executeCommand.mockResolvedValue({ success: false, finalMessage: "Start the machine with debugging" });
    await saveDebugRecordingAs(window);
    expect(env.showMessageBox.mock.calls[0][1]).toMatchObject({ type: "error", message: "Start the machine with debugging" });
  });

  it("opens a picked recording and remembers its folder", async () => {
    env.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ["/r/bug.klr"] });
    await pickAndOpenDebugRecording(window);
    expect(env.executeCommand).toHaveBeenCalledWith('debug-recording-load "/r/bug.klr"');
    expect(env.settings.folders.debugRecordingFolder).toBe("/r");
  });

  it("offers another build's recording as its end state, and opens that with -y when asked", async () => {
    env.executeCommand.mockResolvedValueOnce({ success: false, finalMessage: REFUSAL }).mockResolvedValueOnce({ success: true });
    env.showMessageBox.mockResolvedValue({ response: 0 });
    await openDebugRecordingFile(window, "/r/bug.klr");
    expect(env.showMessageBox.mock.calls[0][1]).toMatchObject({
      type: "warning",
      message: "The recording was recorded by Klive 0.1.0 (build 00000000); this build differs.",
      buttons: ["Open End State", "Cancel"]
    });
    expect(env.executeCommand).toHaveBeenLastCalledWith('debug-recording-load "/r/bug.klr" -y');
  });

  it("does nothing more when the user cancels the end state", async () => {
    env.executeCommand.mockResolvedValue({ success: false, finalMessage: REFUSAL });
    env.showMessageBox.mockResolvedValue({ response: 1 });
    await openDebugRecordingFile(window, "/r/bug.klr");
    expect(env.executeCommand).toHaveBeenCalledTimes(1);
    expect(env.showMessageBox).toHaveBeenCalledTimes(1);
  });
});
