import path from "path";

import type { MachineMenuItem, MachineMenuRenderer } from "@common/machines/info-types";

import { getEmuApi } from "@common/messaging/MainToEmuMessenger";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { SETTING_EMU_FAST_LOAD } from "@common/settings/setting-const";
import { createBooleanSettingsMenu } from "@main/menus/menu-utils";
import { mainStore } from "@main/main-store";
import { saveKliveProject } from "@main/projects";
import { appSettings } from "@main/settings-utils";
import { dialog, app } from "electron";
import { ejectMediaFile, setSelectedTapeFile } from "./zx-specrum-menus";
import { t } from "@common/i18n/i18n";

const TAPE_FILE_FOLDER = "tapeFileFolder";

/**
 * The Enterprise 64/128's tape (`.plans/ENTERPRISE_PLAN.md` §9.3): a `.tap` (ep128emu's or EPTE's) or a
 * `.wav` goes in the deck and plays while EXOS runs a remote relay (`LOAD` in IS-BASIC). Load and Run
 * starts the machine and types the command; fast load runs the machine faster while the tape plays,
 * without it the tape plays in real time. A SAVE to tape is handed over as an ep128emu `.tap`.
 */
export const epTapeMenuRenderer: MachineMenuRenderer = (windowInfo) => {
  const emuWindow = windowInfo.emuWindow;
  const appState = mainStore.getState();
  const items: MachineMenuItem[] = [
    {
      id: "select_tape_file",
      label: t("menu.tape.insert"),
      click: async () => {
        const lastFile = mainStore.getState().media?.[MEDIA_TAPE];
        const defaultPath =
          appSettings?.folders?.[TAPE_FILE_FOLDER] || (lastFile ? path.dirname(lastFile) : app.getPath("home"));
        const result = await dialog.showOpenDialog(emuWindow, {
          title: t("messages.tape.select"),
          defaultPath,
          filters: [
            { name: t("common.filter.epTapes"), extensions: ["tap", "wav"] },
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
      label: t("menu.tape.loadAndRun"),
      enabled: !!appState.media?.[MEDIA_TAPE],
      click: async () => {
        await getEmuApi().startTapeLoad(false);
      }
    },
    {
      id: "rewind_tape",
      label: t("menu.tape.rewind"),
      click: async () => {
        await getEmuApi().issueMachineCommand("rewind");
      }
    },
    {
      id: "eject_tape",
      label: t("menu.tape.eject"),
      enabled: !!appState.media?.[MEDIA_TAPE],
      click: async () => {
        await ejectMediaFile(MEDIA_TAPE);
      }
    },
    { type: "separator" },
    createBooleanSettingsMenu(SETTING_EMU_FAST_LOAD, { label: t("menu.tape.fastLoad") }) as any
  ];
  return items;
};
