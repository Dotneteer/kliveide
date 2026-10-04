import path from "path";

import type { MachineMenuRenderer, MachineMenuItem } from "@common/machines/info-types";

import { MI_ZX80 } from "@common/machines/constants";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { SETTING_EMU_FAST_LOAD } from "@common/settings/setting-const";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { createBooleanSettingsMenu } from "@main/app-menu";
import { mainStore } from "@main/main-store";
import { saveKliveProject } from "@main/projects";
import { appSettings } from "@main/settings-utils";
import { dialog, app } from "electron";
import { ejectMediaFile, setSelectedTapeFile } from "./zx-specrum-menus";

const TAPE_FILE_FOLDER = "tapeFileFolder";

/**
 * The ZX80 and ZX81 tape commands (`.plans/ZX8081_WASM_PLAN.md` §9, §11). A program file (`.p`/`.81`
 * for the ZX81, `.o`/`.80` for the ZX80) is the tape: "Load and Run" resets the machine, types the
 * load command and, once the ROM has loaded the program, RUN. Fast load reads the bytes straight
 * into the ROM's LOAD routine; without it they play in real time.
 */
export const zx8081TapeMenuRenderer: MachineMenuRenderer = (windowInfo, machine) => {
  const emuWindow = windowInfo.emuWindow;
  const appState = mainStore.getState();
  const isZx80 = machine.machineId === MI_ZX80;
  const items: MachineMenuItem[] = [
    createBooleanSettingsMenu(SETTING_EMU_FAST_LOAD) as any,
    {
      id: "select_tape_file",
      label: "Select Program File...",
      click: async () => {
        const lastFile = mainStore.getState().media?.[MEDIA_TAPE];
        const defaultPath =
          appSettings?.folders?.[TAPE_FILE_FOLDER] || (lastFile ? path.dirname(lastFile) : app.getPath("home"));
        const result = await dialog.showOpenDialog(emuWindow, {
          title: "Select Program File",
          defaultPath,
          filters: [
            isZx80
              ? { name: "ZX80 Program Files", extensions: ["o", "80", "p", "81"] }
              : { name: "ZX81 Program Files", extensions: ["p", "81"] },
            { name: "All Files", extensions: ["*"] }
          ],
          properties: ["openFile"]
        });
        if (result.canceled || result.filePaths.length < 1) return;
        await setSelectedTapeFile(result.filePaths[0]);
        await saveKliveProject();
      }
    },
    {
      id: "load_tape_program",
      label: "Load and Run the Program",
      enabled: !!appState.media?.[MEDIA_TAPE],
      click: async () => {
        await getEmuApi().startTapeLoad(false);
      }
    },
    {
      id: "rewind_tape",
      label: "Rewind Tape",
      click: async () => {
        await getEmuApi().issueMachineCommand("rewind");
      }
    },
    {
      id: "eject_tape",
      label: "Eject Program",
      enabled: !!appState.media?.[MEDIA_TAPE],
      click: async () => {
        await ejectMediaFile(MEDIA_TAPE);
      }
    }
  ];
  return items;
};
