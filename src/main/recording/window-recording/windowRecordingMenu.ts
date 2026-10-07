import type { MenuItemConstructorOptions } from "electron";
import type { AppState, RecordingIdePosition } from "@common/state/AppState";
import type { Action } from "@common/state/Action";
import {
  setWindowRecordingClicksAction,
  setWindowRecordingHiDpiAction,
  setWindowRecordingIdePositionAction,
  setWindowRecordingPointerAction
} from "@common/state/actions";

/**
 * The IDE + Emulator recording item of Machine › Record (`.plans/IDE_EMU_RECORDING_PLAN.md` §5.2).
 *
 * Built from the state alone, so the enablement rules can be tested without the whole app menu.
 */
export type WindowRecordingMenuContext = {
  state: AppState | undefined;
  ideWindowVisible: boolean;
  /** Accelerator of the start/stop item */
  shortcut: string;
  toggleRecording: () => Promise<void> | void;
};

export const IDE_POSITION_ITEMS: [RecordingIdePosition, string][] = [
  ["left", "Left"],
  ["right", "Right"],
  ["top", "Top"],
  ["bottom", "Bottom"]
];

/**
 * The IDE + Emulator recording item of Machine › Record: start or stop. Its preferences (the IDE's
 * position, the pointer, the clicks, HiDPI) are in Settings › Recording
 * (`.plans/MENU_REDESIGN_PLAN.md` §4.1), which writes them with `windowRecordingPreferenceAction`.
 */
export function createWindowRecordingMenuItems(
  context: WindowRecordingMenuContext
): MenuItemConstructorOptions[] {
  const emulatorState = context.state?.emulatorState;
  const recording = emulatorState?.windowRecordingState === "recording";
  const screenState = emulatorState?.screenRecordingState;
  const screenIdle = !screenState || screenState === "idle";
  return [
    {
      id: "recording_ide_emu_start_stop",
      label: recording ? "Stop IDE + Emulator recording" : "Start IDE + Emulator recording",
      accelerator: context.shortcut,
      // --- One recording at a time; the IDE must be visible to be recorded
      enabled: recording || (screenIdle && context.ideWindowVisible),
      click: async () => await context.toggleRecording()
    }
  ];
}

/** The IDE + Emulator recording preferences Settings › Recording edits */
export type WindowRecordingPreference = "idePosition" | "pointer" | "clicks" | "hiDpi";

/**
 * The action that stores one IDE + Emulator recording preference. The caller persists the app
 * settings afterwards (the preferences live there).
 */
export function windowRecordingPreferenceAction(
  preference: WindowRecordingPreference,
  value: unknown
): Action | undefined {
  switch (preference) {
    case "idePosition":
      return IDE_POSITION_ITEMS.some(([v]) => v === value)
        ? setWindowRecordingIdePositionAction(value as RecordingIdePosition)
        : undefined;
    case "pointer":
      return setWindowRecordingPointerAction(!!value);
    case "clicks":
      return setWindowRecordingClicksAction(!!value);
    case "hiDpi":
      return setWindowRecordingHiDpiAction(!!value);
    default:
      return undefined;
  }
}
