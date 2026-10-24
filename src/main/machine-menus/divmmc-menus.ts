import path from "path";
import fs from "fs";
import { app, dialog, type BrowserWindow } from "electron";

import type { MachineMenuItem, MachineMenuRenderer } from "@common/machines/info-types";
import { MC_DIVMMC, MC_INTERFACE1 } from "@common/machines/constants";
import { hasDivMmc, isDivMmcMachine } from "@common/machines/divMmc";
import { getModelConfig } from "@common/machines/machine-registry";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { SETTING_EMU_ESXDOS_ROM } from "@common/settings/setting-const";
import { MEDIA_SD_CARD } from "@common/structs/project-const";
import { incMenuVersionAction, setMediaAction } from "@state/actions";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { mainStore } from "@main/main-store";
import { saveKliveProject } from "@main/projects";
import { logEmuEvent, setMachineType } from "@main/registeredMachines";
import { appSettings, getSettingValue, saveAppSettings, setSettingValue } from "@main/settings-utils";
import { t } from "@common/i18n/i18n";
import { SD_CARD_FILE_FOLDER, setSelectedSdCardFile } from "./zx-next-menus";

/*
 * The DivMMC on the 48K, the 128K and the +2A/+3/+2E/+3E (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md,
 * C5): Machine › SD Card connects it (the machine config's `MC_DIVMMC`, which restarts the machine),
 * names the card it reads - the same media slot the Next's card uses, so a `.cim`, `.img` or `.hdf` -
 * and presses its NMI button. Its esxDOS ROM is the user's (Settings › Machine), as the TR-DOS ROM is.
 */

const ESXDOS_ROM_SIZE = 0x2000;

export const divMmcMenuRenderer: MachineMenuRenderer = (windowInfo, machine, model, config) => {
  const state = mainStore.getState()?.emulatorState;
  const effective = config ?? state?.config ?? model?.config;
  if (!isDivMmcMachine(machine.machineId, model?.modelId, effective)) return [];
  const connected = hasDivMmc(machine.machineId, model?.modelId, effective);
  const items: MachineMenuItem[] = [
    {
      id: "divmmc_connect",
      label: t("menu.divMmc.connect"),
      type: "checkbox",
      checked: connected,
      click: async () => {
        await setDivMmcConnected(!connected);
      }
    }
  ];
  if (!connected) return items;
  const romSet = !!getSettingValue(SETTING_EMU_ESXDOS_ROM);
  items.push(
    {
      id: "divmmc_esxdos_rom",
      label: romSet ? t("menu.divMmc.changeRom") : t("menu.divMmc.selectRom"),
      click: async () => {
        await selectEsxDosRomFile(windowInfo.emuWindow);
      }
    },
    { type: "separator" },
    {
      id: "divmmc_select_sd_card",
      label: t("menu.divMmc.selectImage"),
      enabled: isMachineStopped(),
      click: async () => {
        await selectDivMmcSdCard(windowInfo.emuWindow);
        await saveKliveProject();
        saveAppSettings();
      }
    },
    {
      id: "divmmc_default_sd_card",
      label: t("menu.divMmc.useDefaultImage"),
      enabled: isMachineStopped() && !!mainStore.getState().media?.[MEDIA_SD_CARD],
      click: async () => {
        mainStore.dispatch(setMediaAction(MEDIA_SD_CARD, undefined));
        await saveKliveProject();
        saveAppSettings();
      }
    },
    { type: "separator" },
    {
      id: "divmmc_nmi",
      label: t("menu.divMmc.nmi"),
      enabled: isMachineRunning(),
      click: async () => {
        await getEmuApi().issueMachineCommand("custom", "divMmcNmi");
      }
    }
  );
  return items;
};

/** Connects or disconnects the DivMMC: the machine restarts with the new configuration */
export async function setDivMmcConnected(on: boolean): Promise<void> {
  const emulatorState = mainStore.getState()?.emulatorState;
  const machineId = emulatorState?.machineId;
  const modelId = emulatorState?.modelId;
  if (!machineId || !isDivMmcMachine(machineId, modelId, emulatorState?.config)) return;
  const config = { ...(emulatorState?.config ?? getModelConfig(machineId, modelId) ?? {}) };
  // --- The Interface 1 answers port $E7 too: it goes, saying so (MICRODRIVE_PLAN Q4)
  const hadInterface1 = !!config[MC_INTERFACE1];
  if (on) {
    config[MC_DIVMMC] = true;
    delete config[MC_INTERFACE1];
  } else delete config[MC_DIVMMC];
  await setMachineType(machineId, modelId, config);
  mainStore.dispatch(incMenuVersionAction());
  await saveKliveProject();
  await logEmuEvent(on ? "DivMMC connected" : "DivMMC disconnected");
  if (on && hadInterface1) {
    await dialog.showMessageBox({ type: "info", title: t("messages.if1.exclusiveTitle"), message: t("messages.if1.if1Disconnected") });
  }
}

/** Asks for the SD card image the DivMMC reads (the media slot the Next's card uses too) */
async function selectDivMmcSdCard(browserWindow: BrowserWindow): Promise<void> {
  const lastFile = mainStore.getState().media?.[MEDIA_SD_CARD];
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    title: t("messages.sdCard.select"),
    defaultPath: appSettings?.folders?.[SD_CARD_FILE_FOLDER] || (lastFile ? path.dirname(lastFile) : app.getPath("home")),
    filters: [
      { name: t("common.filter.sdCardImages"), extensions: ["img", "hdf", "cim"] },
      { name: t("common.filter.allFiles"), extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;
  await setSelectedSdCardFile(dialogResult.filePaths[0]);
}

/** Forgets the esxDOS ROM: the DivMMC stays off until another is named */
export async function forgetEsxDosRom(): Promise<void> {
  setSettingValue(SETTING_EMU_ESXDOS_ROM, "");
  await restartForEsxDosRom("esxDOS ROM cleared");
}

/** Asks for the esxDOS ROM and restarts the machine with it */
export async function selectEsxDosRomFile(owner: BrowserWindow): Promise<void> {
  const current = getSettingValue(SETTING_EMU_ESXDOS_ROM) as string | undefined;
  const dialogResult = await dialog.showOpenDialog(owner, {
    title: t("messages.divMmc.selectRom"),
    defaultPath: current ? path.dirname(current) : app.getPath("home"),
    filters: [
      { name: t("common.filter.romFiles"), extensions: ["rom", "bin"] },
      { name: t("common.filter.allFiles"), extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;
  const filename = dialogResult.filePaths[0];
  const size = fs.statSync(filename).size;
  if (size !== ESXDOS_ROM_SIZE) {
    dialog.showErrorBox(t("messages.divMmc.notRom"), t("messages.divMmc.wrongSize", { file: filename, size }));
    return;
  }
  setSettingValue(SETTING_EMU_ESXDOS_ROM, filename);
  await restartForEsxDosRom(`esxDOS ROM set to ${filename}`);
}

/** Rebuilds the machine, which reads the esxDOS ROM setting when it starts */
async function restartForEsxDosRom(message: string): Promise<void> {
  const emulatorState = mainStore.getState()?.emulatorState;
  if (emulatorState?.machineId && hasDivMmc(emulatorState.machineId, emulatorState.modelId, emulatorState.config)) {
    await setMachineType(emulatorState.machineId, emulatorState.modelId, emulatorState.config ?? {});
  }
  mainStore.dispatch(incMenuVersionAction());
  saveAppSettings();
  await logEmuEvent(message);
}

function isMachineRunning(): boolean {
  const state = mainStore.getState().emulatorState?.machineState;
  return state === MachineControllerState.Running || state === MachineControllerState.Paused;
}

function isMachineStopped(): boolean {
  const state = mainStore.getState().emulatorState?.machineState;
  return state === MachineControllerState.Stopped || state === MachineControllerState.None;
}
