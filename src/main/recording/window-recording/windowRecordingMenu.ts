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
 * The IDE + Emulator recording items of Machine | Recording (plan §5.2).
 *
 * Built from the state alone, so the enablement rules can be tested without the whole app menu.
 * Toggles read the *current* state at click time: the app menu is only rebuilt when its rendered
 * form changes, so a click handler may outlive the state it was built from.
 */
export type WindowRecordingMenuContext = {
  state: AppState | undefined;
  /** The current state, read at click time */
  getState: () => AppState | undefined;
  dispatch: (action: Action) => void;
  /** Persists the preferences (they live in the app settings) */
  saveSettings: () => void;
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

export function createWindowRecordingMenuItems(
  context: WindowRecordingMenuContext
): MenuItemConstructorOptions[] {
  const emulatorState = context.state?.emulatorState;
  const recording = emulatorState?.windowRecordingState === "recording";
  const screenState = emulatorState?.screenRecordingState;
  const screenIdle = !screenState || screenState === "idle";
  const pointer = emulatorState?.windowRecordingPointer ?? true;
  const position = emulatorState?.windowRecordingIdePosition ?? "left";
  const current = () => context.getState()?.emulatorState;

  const toggle = (action: Action) => {
    context.dispatch(action);
    context.saveSettings();
  };

  return [
    {
      id: "recording_ide_emu_start_stop",
      label: recording ? "Stop IDE + Emulator recording" : "Start IDE + Emulator recording",
      accelerator: context.shortcut,
      // --- One recording at a time; the IDE must be visible to be recorded
      enabled: recording || (screenIdle && context.ideWindowVisible),
      click: async () => await context.toggleRecording()
    },
    {
      id: "recording_ide_position",
      label: "IDE position",
      enabled: !recording,
      submenu: IDE_POSITION_ITEMS.map(([value, label]) => ({
        id: `recording_ide_position_${value}`,
        label,
        type: "radio" as const,
        checked: position === value,
        enabled: !recording,
        click: () => toggle(setWindowRecordingIdePositionAction(value))
      }))
    },
    {
      id: "recording_ide_emu_pointer",
      label: "Include pointer",
      type: "checkbox",
      checked: pointer,
      enabled: !recording,
      click: () => toggle(setWindowRecordingPointerAction(!(current()?.windowRecordingPointer ?? true)))
    },
    {
      id: "recording_ide_emu_clicks",
      label: "Show mouse clicks",
      type: "checkbox",
      checked: emulatorState?.windowRecordingClicks ?? true,
      enabled: !recording && pointer,
      click: () => toggle(setWindowRecordingClicksAction(!(current()?.windowRecordingClicks ?? true)))
    },
    {
      id: "recording_ide_emu_hidpi",
      label: "Full resolution (HiDPI)",
      type: "checkbox",
      checked: emulatorState?.windowRecordingHiDpi ?? false,
      enabled: !recording,
      click: () => toggle(setWindowRecordingHiDpiAction(!(current()?.windowRecordingHiDpi ?? false)))
    }
  ];
}
