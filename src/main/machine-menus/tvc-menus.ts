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
import { MC_DISK_SUPPORT, MC_TVC_HBF } from "@common/machines/constants";
import { getModelConfig } from "@common/machines/machine-registry";
import { incMenuVersionAction } from "@state/actions";
import { logEmuEvent, setMachineType } from "@main/registeredMachines";
import { diskMenuRenderer, ejectMediaFile, setSelectedTapeFile } from "./zx-specrum-menus";
import { t } from "@common/i18n/i18n";

const TAPE_FILE_FOLDER = "tapeFileFolder";

/**
 * The Videoton TVC's tape (`.plans/VIDEOTON_TVC_PLAN.md` §9): a `.cas` goes in the deck and plays
 * while the ROM runs the recorder's motor (type `LOAD` in BASIC). Fast load runs the machine faster
 * while the tape plays; without it the tape plays in real time.
 */
export const tvcTapeMenuRenderer: MachineMenuRenderer = (windowInfo) => {
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
            { name: t("common.filter.tvcTapes"), extensions: ["cas"] },
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
 * The HBF floppy interface (`.plans/VIDEOTON_TVC_PLAN.md` §9.4): a switch that plugs the card into
 * slot 0 (the machine config's `MC_TVC_HBF`, which restarts the machine), and with it the two
 * drives' items - the Spectrum's disk menu, without its "create a disk" (that makes a +3 image).
 */
export const tvcDiskMenuRenderer: MachineMenuRenderer = (windowInfo, machine, model, config) => {
  const effective = config ?? mainStore.getState()?.emulatorState?.config ?? model?.config;
  const hbf = effective?.[MC_TVC_HBF] === true;
  const items: MachineMenuItem[] = [
    {
      id: "tvc_hbf",
      label: t("menu.tvc.hbf"),
      type: "checkbox",
      checked: hbf,
      click: async () => {
        await setTvcHbf(!hbf);
      }
    }
  ];
  if (!hbf) return items;
  const disks = diskMenuRenderer(windowInfo, machine, { ...model, config: { [MC_DISK_SUPPORT]: 2 } } as any, config);
  const floppy = disks.find((item) => item.id === "floppy_menu");
  const drives = (floppy?.submenu ?? []).filter((item) => item.id !== "create_disk_file");
  while (drives[0]?.type === "separator") drives.shift();
  return [...items, { type: "separator" }, ...drives];
};

/** Plugs the HBF card in or out: the machine restarts with the new configuration */
async function setTvcHbf(on: boolean): Promise<void> {
  const emulatorState = mainStore.getState()?.emulatorState;
  const machineId = emulatorState?.machineId;
  const modelId = emulatorState?.modelId;
  if (!machineId) return;
  const config = { ...(emulatorState?.config ?? getModelConfig(machineId, modelId) ?? {}) };
  if (on) config[MC_TVC_HBF] = true;
  else delete config[MC_TVC_HBF];
  await setMachineType(machineId, modelId, config);
  mainStore.dispatch(incMenuVersionAction());
  await saveKliveProject();
  await logEmuEvent(on ? "HBF floppy interface plugged in" : "HBF floppy interface removed");
}
