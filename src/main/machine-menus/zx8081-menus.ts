import path from "path";

import type { MachineMenuRenderer, MachineMenuItem } from "@common/machines/info-types";

import { MI_ZX80 } from "@common/machines/constants";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { SETTING_EMU_FAST_LOAD } from "@common/settings/setting-const";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { createBooleanSettingsMenu } from "@main/menus/menu-utils";
import { mainStore } from "@main/main-store";
import { saveKliveProject } from "@main/projects";
import { appSettings } from "@main/settings-utils";
import { dialog, app } from "electron";
import { ejectMediaFile, setSelectedTapeFile } from "./zx-specrum-menus";
import { t } from "@common/i18n/i18n";

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
    createBooleanSettingsMenu(SETTING_EMU_FAST_LOAD, { label: t("menu.tape.fastLoad") }) as any,
    {
      id: "select_tape_file",
      label: t("menu.program.select"),
      click: async () => {
        const lastFile = mainStore.getState().media?.[MEDIA_TAPE];
        const defaultPath =
          appSettings?.folders?.[TAPE_FILE_FOLDER] || (lastFile ? path.dirname(lastFile) : app.getPath("home"));
        const result = await dialog.showOpenDialog(emuWindow, {
          title: t("messages.program.select"),
          defaultPath,
          filters: [
            isZx80
              ? { name: t("common.filter.zx80Programs"), extensions: ["o", "80", "p", "81"] }
              : { name: t("common.filter.zx81Programs"), extensions: ["p", "81"] },
            { name: t("common.filter.allFiles"), extensions: ["*"] }
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
      label: t("menu.program.loadAndRun"),
      enabled: !!appState.media?.[MEDIA_TAPE],
      click: async () => {
        await getEmuApi().startTapeLoad(false);
      }
    },
    {
      id: "rewind_tape",
      label: t("menu.program.rewind"),
      click: async () => {
        await getEmuApi().issueMachineCommand("rewind");
      }
    },
    {
      id: "eject_tape",
      label: t("menu.program.eject"),
      enabled: !!appState.media?.[MEDIA_TAPE],
      click: async () => {
        await ejectMediaFile(MEDIA_TAPE);
      }
    }
  ];
  return items;
};
