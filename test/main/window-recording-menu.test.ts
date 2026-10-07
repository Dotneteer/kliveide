import { describe, expect, it, vi } from "vitest";
import type { MenuItemConstructorOptions } from "electron";
import type { AppState } from "@common/state/AppState";
import {
  createWindowRecordingMenuItems,
  IDE_POSITION_ITEMS,
  windowRecordingPreferenceAction
} from "@main/recording/window-recording/windowRecordingMenu";
import {
  DEFAULT_RECORD_IDE_EMU_SHORTCUT,
  readRecordIdeEmuShortcut,
  SHORTCUT_RECORD_IDE_EMU
} from "@common/utils/recordingShortcuts";

/*
 * Machine › Record: the IDE + Emulator recording item (.plans/IDE_EMU_RECORDING_PLAN.md §5.2), and
 * the actions Settings › Recording stores its preferences with (.plans/MENU_REDESIGN_PLAN.md §4.1).
 */

function stateWith(emulatorState: Record<string, unknown>): AppState {
  return { emulatorState } as unknown as AppState;
}

function build(emulatorState: Record<string, unknown> = {}, ideWindowVisible = true) {
  const state = stateWith(emulatorState);
  const toggleRecording = vi.fn();
  const items = createWindowRecordingMenuItems({
    state,
    ideWindowVisible,
    shortcut: "Ctrl+Shift+F7",
    toggleRecording
  });
  const item = (id: string): MenuItemConstructorOptions => {
    const found = items.find((i) => i.id === id);
    if (!found) throw new Error(`No item ${id}`);
    return found;
  };
  return { items, item, toggleRecording };
}

const click = (item: MenuItemConstructorOptions) => (item.click as any)?.();

describe("the IDE + Emulator recording menu item", () => {
  it("offers start with the shortcut when idle", () => {
    const { item } = build();
    const start = item("recording_ide_emu_start_stop");
    expect(start.label).toBe("Start IDE + Emulator recording");
    expect(start.accelerator).toBe("Ctrl+Shift+F7");
    expect(start.enabled).toBe(true);
  });

  it("offers stop while recording", () => {
    const { item } = build({ windowRecordingState: "recording" });
    expect(item("recording_ide_emu_start_stop").label).toBe("Stop IDE + Emulator recording");
    expect(item("recording_ide_emu_start_stop").enabled).toBe(true);
  });

  it("holds only the start/stop item: the preferences are in Settings", () => {
    expect(build().items.map((i) => i.id)).toEqual(["recording_ide_emu_start_stop"]);
  });

  it("cannot start while the emulator screen recording runs", () => {
    const { item } = build({ screenRecordingState: "recording" });
    expect(item("recording_ide_emu_start_stop").enabled).toBe(false);
  });

  it("cannot start while the IDE window is hidden", () => {
    const { item } = build({}, false);
    expect(item("recording_ide_emu_start_stop").enabled).toBe(false);
  });

  it("start/stop toggles the recording", async () => {
    const { item, toggleRecording } = build();
    await click(item("recording_ide_emu_start_stop"));
    expect(toggleRecording).toHaveBeenCalledOnce();
  });

});

describe("the IDE + Emulator recording preferences", () => {
  it("offers the four IDE positions", () => {
    expect(IDE_POSITION_ITEMS.map(([, label]) => label)).toEqual(["Left", "Right", "Top", "Bottom"]);
  });

  it("stores a position", () => {
    expect(windowRecordingPreferenceAction("idePosition", "top")).toEqual({
      type: "SET_WINDOW_RECORDING_IDE_POSITION",
      payload: { id: "top" }
    });
  });

  it("refuses a position that does not exist", () => {
    expect(windowRecordingPreferenceAction("idePosition", "diagonal")).toBeUndefined();
  });

  it("stores the flags", () => {
    expect([
      windowRecordingPreferenceAction("pointer", false),
      windowRecordingPreferenceAction("hiDpi", true),
      windowRecordingPreferenceAction("clicks", false)
    ]).toEqual([
      { type: "SET_WINDOW_RECORDING_POINTER", payload: { flag: false } },
      { type: "SET_WINDOW_RECORDING_HIDPI", payload: { flag: true } },
      { type: "SET_WINDOW_RECORDING_CLICKS", payload: { flag: false } }
    ]);
  });
});

describe("the IDE + Emulator recording shortcut", () => {
  it("defaults to Ctrl+Shift+F7", () => {
    expect(readRecordIdeEmuShortcut(undefined)).toBe(DEFAULT_RECORD_IDE_EMU_SHORTCUT);
    expect(DEFAULT_RECORD_IDE_EMU_SHORTCUT).toBe("Ctrl+Shift+F7");
  });

  it("can be overridden by the user setting", () => {
    expect(SHORTCUT_RECORD_IDE_EMU).toBe("shortcuts.recordIdeEmu");
    const state = { userSettings: { shortcuts: { recordIdeEmu: " Alt+F7 " } } } as unknown as AppState;
    expect(readRecordIdeEmuShortcut(state)).toBe("Alt+F7");
  });
});
