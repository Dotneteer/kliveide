import { describe, expect, it, vi } from "vitest";
import type { MenuItemConstructorOptions } from "electron";
import type { AppState } from "@common/state/AppState";
import { createWindowRecordingMenuItems } from "@main/recording/window-recording/windowRecordingMenu";
import {
  DEFAULT_RECORD_IDE_EMU_SHORTCUT,
  readRecordIdeEmuShortcut,
  SHORTCUT_RECORD_IDE_EMU
} from "@common/utils/recordingShortcuts";

/*
 * Machine | Recording: the IDE + Emulator recording items (.plans/IDE_EMU_RECORDING_PLAN.md §5.2).
 */

function stateWith(emulatorState: Record<string, unknown>): AppState {
  return { emulatorState } as unknown as AppState;
}

function build(emulatorState: Record<string, unknown> = {}, ideWindowVisible = true) {
  const state = stateWith(emulatorState);
  const dispatch = vi.fn();
  const saveSettings = vi.fn();
  const toggleRecording = vi.fn();
  const items = createWindowRecordingMenuItems({
    state,
    getState: () => state,
    dispatch,
    saveSettings,
    ideWindowVisible,
    shortcut: "Ctrl+Shift+F7",
    toggleRecording
  });
  const item = (id: string): MenuItemConstructorOptions => {
    const found = items.find((i) => i.id === id);
    if (!found) throw new Error(`No item ${id}`);
    return found;
  };
  return { items, item, dispatch, saveSettings, toggleRecording };
}

const click = (item: MenuItemConstructorOptions) => (item.click as any)?.();

describe("the IDE + Emulator recording menu items", () => {
  it("offers start with the shortcut when idle", () => {
    const { item } = build();
    const start = item("recording_ide_emu_start_stop");
    expect(start.label).toBe("Start IDE + Emulator recording");
    expect(start.accelerator).toBe("Ctrl+Shift+F7");
    expect(start.enabled).toBe(true);
  });

  it("offers stop while recording, and locks the options", () => {
    const { item } = build({ windowRecordingState: "recording" });
    expect(item("recording_ide_emu_start_stop").label).toBe("Stop IDE + Emulator recording");
    expect(item("recording_ide_emu_start_stop").enabled).toBe(true);
    expect(item("recording_ide_position").enabled).toBe(false);
    expect(item("recording_ide_emu_pointer").enabled).toBe(false);
    expect(item("recording_ide_emu_clicks").enabled).toBe(false);
    expect(item("recording_ide_emu_hidpi").enabled).toBe(false);
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

  it("defaults: IDE on the left, pointer and clicks on, 1x", () => {
    const { item } = build();
    const positions = item("recording_ide_position").submenu as MenuItemConstructorOptions[];
    expect(positions.map((p) => p.label)).toEqual(["Left", "Right", "Top", "Bottom"]);
    expect(positions.find((p) => p.checked)?.label).toBe("Left");
    expect(item("recording_ide_emu_pointer").checked).toBe(true);
    expect(item("recording_ide_emu_clicks").checked).toBe(true);
    expect(item("recording_ide_emu_hidpi").checked).toBe(false);
  });

  it("choosing a position stores and saves it", () => {
    const { item, dispatch, saveSettings } = build();
    const positions = item("recording_ide_position").submenu as MenuItemConstructorOptions[];
    click(positions[2]);
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_WINDOW_RECORDING_IDE_POSITION",
      payload: { id: "top" }
    });
    expect(saveSettings).toHaveBeenCalledOnce();
  });

  it("Show mouse clicks needs Include pointer", () => {
    expect(build({ windowRecordingPointer: false }).item("recording_ide_emu_clicks").enabled).toBe(false);
    expect(build({ windowRecordingPointer: true }).item("recording_ide_emu_clicks").enabled).toBe(true);
  });

  it("checkboxes toggle the current value", () => {
    const { item, dispatch } = build({ windowRecordingPointer: true, windowRecordingHiDpi: false });
    click(item("recording_ide_emu_pointer"));
    click(item("recording_ide_emu_hidpi"));
    click(item("recording_ide_emu_clicks"));
    expect(dispatch.mock.calls.map((c) => c[0])).toEqual([
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
