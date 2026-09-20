import type { MachineMenuItem, MachineMenuRenderer } from "@common/machines/info-types";

import {
  MOUSE_POINTER_DISPLAYS,
  MOUSE_SENSITIVITIES,
  normalizeMousePointerDisplay,
  normalizeMouseSensitivity
} from "@common/settings/mouse-capture";
import {
  SETTING_EMU_MOUSE_CAPTURE,
  SETTING_EMU_MOUSE_SENSITIVITY,
  SETTING_EMU_MOUSE_SHOW_POINTER
} from "@common/settings/setting-const";
import { JOYSTICK_BINDINGS_DIALOG } from "@common/messaging/dialog-ids";
import { getEmuApi } from "@common/messaging/MainToEmuMessenger";
import {
  JOYSTICK_SIDE_LABELS,
  JOYSTICK_SIDES,
  JOYSTICK_SOURCES,
  normalizeJoystickBindings,
  type JoystickSide
} from "@common/settings/joystick-bindings";
import { SETTING_EMU_JOYSTICK_BINDINGS } from "@common/settings/setting-const";
import { logEmuEvent } from "@main/registeredMachines";
import { getSettingValue, setSettingValue } from "@main/settings-utils";

/**
 * The Machine | Mouse submenu.
 *
 * This is where the mouse feature is switched on at all, which is why it exists this early: with
 * capture off - the default, because turning it on changes what a click on the screen does - the
 * toolbar button is disabled and nothing else in the app can flip the setting.
 *
 * **It cannot capture the mouse, only arm it.** Pointer lock needs the transient activation of a
 * real DOM event in the emulator renderer, and a menu click runs in the main process and arrives
 * over IPC with none. The capture itself is the toolbar button, a click on the screen, or Ctrl+M.
 *
 * The menu is rebuilt on every store change, so `checked` follows the settings without any
 * bookkeeping here.
 */
export const mouseMenuRenderer: MachineMenuRenderer = () => {
  const captureEnabled = !!getSettingValue(SETTING_EMU_MOUSE_CAPTURE);
  const pointerDisplay = normalizeMousePointerDisplay(getSettingValue(SETTING_EMU_MOUSE_SHOW_POINTER));
  const sensitivity = normalizeMouseSensitivity(getSettingValue(SETTING_EMU_MOUSE_SENSITIVITY));

  const pointerItems: MachineMenuItem[] = MOUSE_POINTER_DISPLAYS.map((option) => ({
    id: `zx_next_mouse_pointer_${option.value}`,
    label: option.label,
    type: "radio",
    checked: pointerDisplay === option.value,
    enabled: captureEnabled,
    click: async () => {
      setSettingValue(SETTING_EMU_MOUSE_SHOW_POINTER, option.value);
      await logEmuEvent(`Captured pointer shown: ${option.label.toLowerCase()}`);
    }
  }));

  const sensitivityLabel =
    MOUSE_SENSITIVITIES.find((o) => o.value === sensitivity)?.label ?? `${sensitivity}x`;

  const sensitivityItems: MachineMenuItem[] = MOUSE_SENSITIVITIES.map((option) => ({
    id: `zx_next_mouse_sensitivity_${option.value}`,
    label: option.label,
    type: "radio",
    checked: sensitivity === option.value,
    enabled: captureEnabled,
    click: async () => {
      setSettingValue(SETTING_EMU_MOUSE_SENSITIVITY, option.value);
      await logEmuEvent(`Mouse sensitivity set to ${option.label}`);
    }
  }));

  return [
    {
      id: "zx_next_mouse",
      label: "Mouse",
      submenu: [
        {
          id: "zx_next_mouse_capture",
          label: "Capture the mouse",
          type: "checkbox",
          checked: captureEnabled,
          click: async () => {
            setSettingValue(SETTING_EMU_MOUSE_CAPTURE, !captureEnabled);
            await logEmuEvent(
              captureEnabled
                ? "Mouse capture disabled"
                : "Mouse capture enabled - click the screen, press Ctrl+M, or use the toolbar button"
            );
          }
        },
        {
          id: "zx_next_mouse_show_pointer",
          label: "Show the captured pointer",
          enabled: captureEnabled,
          submenu: pointerItems
        },
        { type: "separator" },
        {
          id: "zx_next_mouse_sensitivity",
          // --- The current rung is in the label: a bare "Sensitivity" gives no hint that there is
          // --- anything to adjust, and this is the first thing reached for when the pointer feels
          // --- wrong. Note it scales the hand, not the machine's own DPI, so it moves Klive's
          // --- indicator and the machine's pointer together and cannot change the ratio between
          // --- them - NextReg $0A is what sets that.
          label: `Sensitivity (${sensitivityLabel})`,
          enabled: captureEnabled,
          submenu: sensitivityItems
        }
      ]
    },
    { type: "separator" }
  ];
};

/**
 * The joystick modes NextReg `$05` offers, in its own 3-bit encoding.
 *
 * Only the first two of each pair reach a port; the rest press keys through the joymap inside the
 * core. The host binds pins either way, so this list changes what the machine *does* with them, not
 * what Klive sends.
 */
const JOYSTICK_MODES: { label: string; value: number }[] = [
  { label: "Sinclair 2 (keys 1-5)", value: 0 },
  { label: "Kempston 1 (port $1F)", value: 1 },
  { label: "Cursor / Protek", value: 2 },
  { label: "Sinclair 1 (keys 6-0)", value: 3 },
  { label: "Kempston 2 (port $37)", value: 4 },
  { label: "MD 1 (port $1F)", value: 5 },
  { label: "MD 2 (port $37)", value: 6 },
  { label: "User-defined (joymap)", value: 7 }
];

/**
 * The Machine | Joystick submenu.
 *
 * Two independent things per connector, and the difference matters:
 *
 * - **Mode** is the *machine's* state (NextReg `$05`). Choosing one writes that register, exactly
 *   as a program would - and NextZXOS rewrites it from its own configuration when it boots, so a
 *   mode picked beforehand will not survive. The label says so rather than pretending otherwise.
 * - **Source** is Klive's: which host device drives the connector's pins. It is independent of the
 *   mode, because the pins mean whatever `$05` says they mean.
 */
export const joystickMenuRenderer: MachineMenuRenderer = () => {
  const bindings = normalizeJoystickBindings(getSettingValue(SETTING_EMU_JOYSTICK_BINDINGS));

  const sideMenu = (side: JoystickSide): MachineMenuItem => ({
    id: `zx_next_joy_${side}`,
    label: JOYSTICK_SIDE_LABELS[side],
    submenu: [
      {
        id: `zx_next_joy_${side}_source`,
        label: "Driven by",
        submenu: JOYSTICK_SOURCES.map((option) => ({
          id: `zx_next_joy_${side}_source_${option.value}`,
          label: option.label,
          type: "radio",
          checked: bindings[side].source === option.value,
          click: async () => {
            setSettingValue(SETTING_EMU_JOYSTICK_BINDINGS, {
              ...bindings,
              [side]: { ...bindings[side], source: option.value }
            });
            await logEmuEvent(`${JOYSTICK_SIDE_LABELS[side]}: ${option.label.toLowerCase()}`);
          }
        }))
      },
      {
        id: `zx_next_joy_${side}_mode`,
        // --- Not a setting: this writes the machine's own register, and the machine may write it
        // --- back. Naming that in the label is cheaper than a support question.
        label: "Set machine mode (NextReg $05, NextZXOS may override)",
        submenu: JOYSTICK_MODES.map((mode) => ({
          id: `zx_next_joy_${side}_mode_${mode.value}`,
          label: mode.label,
          click: async () => {
            await getEmuApi().issueMachineCommand("custom", `joystickMode:${side}:${mode.value}`);
            await logEmuEvent(`${JOYSTICK_SIDE_LABELS[side]} mode set to ${mode.label}`);
          }
        }))
      }
    ]
  });

  return [
    {
      id: "zx_next_joystick",
      label: "Joystick",
      submenu: [
        ...JOYSTICK_SIDES.map(sideMenu),
        { type: "separator" },
        {
          id: "zx_next_joy_bindings",
          label: "Configure bindings...",
          click: async () => {
            await getEmuApi().displayDialog(JOYSTICK_BINDINGS_DIALOG);
          }
        }
      ]
    },
    { type: "separator" }
  ];
};
