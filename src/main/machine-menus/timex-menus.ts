import path from "path";
import fs from "fs";

import type { MachineMenuItem, MachineMenuRenderer } from "@common/machines/info-types";

import { app, BrowserWindow, dialog } from "electron";
import { mainStore } from "@main/main-store";
import { logEmuEvent, setMachineType } from "@main/registeredMachines";
import { getSettingValue, saveAppSettings, setSettingValue } from "@main/settings-utils";
import { incMenuVersionAction } from "@state/actions";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { JOYSTICK_BINDINGS_DIALOG } from "@common/messaging/dialog-ids";
import { SETTING_EMU_JOYSTICK_BINDINGS, SETTING_EMU_TC2048_ROM } from "@common/settings/setting-const";
import { JOYSTICK_SOURCES, normalizeJoystickBindings } from "@common/settings/joystick-bindings";
import { TC2048_ROM_SIZE } from "@emu/machines/timex/timexModels";

/**
 * The TC2048 ROM (`.plans/TIMEX_SCORPION_PLAN.md` P5): Klive cannot ship it, so the user names their
 * own copy; without one the machine boots the Sinclair 48K ROM. Choosing or forgetting it restarts
 * the machine.
 */
export const timexRomMenuRenderer: MachineMenuRenderer = (windowInfo) => {
  const romFile = getSettingValue(SETTING_EMU_TC2048_ROM) as string | undefined;
  return [
    {
      id: "timex_rom_menu",
      label: "TC2048 ROM",
      submenu: [
        {
          id: "timex_rom_status",
          label: romFile ? `Using ${path.basename(romFile)}` : "No TC2048 ROM set: booting the 48K ROM",
          enabled: false
        },
        {
          id: "select_timex_rom",
          label: "Select TC2048 ROM File...",
          click: async () => {
            await selectTimexRomFile(windowInfo.emuWindow);
          }
        },
        {
          id: "clear_timex_rom",
          label: "Forget the TC2048 ROM",
          enabled: !!romFile,
          click: async () => {
            setSettingValue(SETTING_EMU_TC2048_ROM, "");
            await restartForTimexRom("TC2048 ROM cleared: the 48K ROM boots");
          }
        }
      ]
    }
  ];
};

/**
 * The TC2048's built-in Kempston port, driven by joystick 1's host bindings (the same table the
 * Next's joysticks use). The TC2048 has one socket and one mode, so there is no mode menu.
 */
export const kempstonJoystickMenuRenderer: MachineMenuRenderer = () => {
  const bindings = normalizeJoystickBindings(getSettingValue(SETTING_EMU_JOYSTICK_BINDINGS));
  const sourceItems: MachineMenuItem[] = JOYSTICK_SOURCES.map((option) => ({
    id: `timex_joy_source_${option.value}`,
    label: option.label,
    type: "radio",
    checked: bindings.left.source === option.value,
    click: async () => {
      setSettingValue(SETTING_EMU_JOYSTICK_BINDINGS, {
        ...bindings,
        left: { ...bindings.left, source: option.value }
      });
      await logEmuEvent(`Kempston joystick: ${option.label.toLowerCase()}`);
    }
  }));
  return [
    {
      id: "timex_joystick",
      label: "Kempston Joystick",
      submenu: [
        { id: "timex_joy_source", label: "Driven by", submenu: sourceItems },
        { type: "separator" },
        {
          id: "timex_joy_bindings",
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

async function selectTimexRomFile(emuWindow: BrowserWindow): Promise<void> {
  const current = getSettingValue(SETTING_EMU_TC2048_ROM) as string | undefined;
  const dialogResult = await dialog.showOpenDialog(emuWindow, {
    title: "Select the TC2048 ROM (16K)",
    defaultPath: current ? path.dirname(current) : app.getPath("home"),
    filters: [
      { name: "ROM Files", extensions: ["rom", "bin"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;
  const filename = dialogResult.filePaths[0];
  const size = fs.statSync(filename).size;
  if (size !== TC2048_ROM_SIZE) {
    dialog.showErrorBox("Not a TC2048 ROM", `The TC2048 ROM is ${TC2048_ROM_SIZE} bytes; ${filename} has ${size}.`);
    return;
  }
  setSettingValue(SETTING_EMU_TC2048_ROM, filename);
  await restartForTimexRom(`TC2048 ROM set to ${filename}`);
}

/** Rebuilds the machine, which reads the TC2048 ROM setting when it starts */
async function restartForTimexRom(message: string): Promise<void> {
  const emulatorState = mainStore.getState()?.emulatorState;
  await setMachineType(emulatorState?.machineId, emulatorState?.modelId, emulatorState?.config ?? {});
  mainStore.dispatch(incMenuVersionAction());
  saveAppSettings();
  await logEmuEvent(message);
}
