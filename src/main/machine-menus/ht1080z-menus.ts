import path from "path";

import type { MachineMenuItem, MachineMenuRenderer } from "@common/machines/info-types";

import { MachineControllerState } from "@common/abstractions/MachineControllerState";
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
 * The HT-1080Z's tape (`.plans/HT1080Z_PLAN.md` §9): a `.cas`, a `.cmd` or a tokenised `.bas` goes in
 * the deck (the emulator turns the last two into the tapes the ROM would have written); "Load and Run"
 * powers the machine on and has it type `CLOAD` and `RUN`, or `SYSTEM`, the name and `/`. Fast load
 * reads the tape through the ROM's own cassette routines; without it the tape plays in real time.
 */
export const ht1080zTapeMenuRenderer: MachineMenuRenderer = (windowInfo) => {
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
            { name: t("common.filter.ht1080zTapes"), extensions: ["cas", "cmd", "bas"] },
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

/**
 * The HT-1080Z's hardware items (`.plans/HT1080Z_PLAN.md` §7, §11): the RESET key on the back panel,
 * an NMI that takes BASIC back to READY with the memory kept. It is not the IDE's reset, which
 * powers the machine on again. The video switches and the tape join in Phases 6 and 8.
 */
export const ht1080zHardwareRenderer: MachineMenuRenderer = () => {
  const execState = mainStore.getState()?.emulatorState?.machineState;
  return [
    { type: "separator" },
    {
      id: "ht1080z_reset_key",
      label: t("menu.ht1080z.resetKey"),
      enabled: execState === MachineControllerState.Running,
      click: async () => {
        await getEmuApi().issueMachineCommand("custom", "reset_key");
      }
    }
  ];
};
