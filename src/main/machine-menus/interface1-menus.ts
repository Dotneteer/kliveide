import path from "path";
import fs from "fs";
import { app, dialog, type BrowserWindow } from "electron";

import type { MachineMenuItem, MachineMenuRenderer } from "@common/machines/info-types";
import { MC_DIVMMC, MC_INTERFACE1 } from "@common/machines/constants";
import { hasInterface1, isInterface1Machine } from "@common/machines/interface1";
import { getModelConfig } from "@common/machines/machine-registry";
import { SETTING_EMU_FAST_MICRODRIVE, SETTING_EMU_IF1_ROM } from "@common/settings/setting-const";
import { MEDIA_MICRODRIVES } from "@common/structs/project-const";
import { createBlankMdr, mdrShape } from "@emu/machines/microdrive/mdrImage";
import { incMenuVersionAction, setMediaAction } from "@state/actions";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { mainStore } from "@main/main-store";
import { newCartridgeDialogFolder } from "@main/disk-folders";
import { createBooleanSettingsMenu } from "@main/menus/menu-utils";
import { saveKliveProject } from "@main/projects";
import { logEmuEvent, setMachineType } from "@main/registeredMachines";
import { appSettings, getSettingValue, saveAppSettings, setSettingValue } from "@main/settings-utils";
import { t } from "@common/i18n/i18n";
import { divMmcMenuRenderer } from "./divmmc-menus";

/*
 * The ZX Interface 1 and its Microdrives on the 48K and the 128K (`.plans/MICRODRIVE_PLAN.md`
 * Phase 3): Machine › Interfaces connects the interface (the machine config's `MC_INTERFACE1`, which
 * restarts the machine; it disconnects the DivMMC, which answers port $E7 too), runs a fast
 * Microdrive, and puts `.mdr` cartridges into drives 1 and 2. The ROM is Settings › Machine's, as the
 * other interfaces' ROMs are; without one named, the shipped v2 ROM.
 */

const MDR_FILE_FOLDER = "mdrFileFolder";
const IF1_ROM_SIZE = 0x2000;

/**
 * Machine › Interfaces on the 48K and the 128K: the DivMMC and the Interface 1 - edge-connector
 * interfaces, one at a time (Q4) - with both switches first, then the connected one's items. One
 * submenu for both keeps the Machine menu within its twelve items (MENU_REDESIGN_PLAN).
 */
export const interfacesMenuRenderer: MachineMenuRenderer = (windowInfo, machine, model, config) => {
  const divMmc = divMmcMenuRenderer(windowInfo, machine, model, config);
  const interface1 = interface1MenuRenderer(windowInfo, machine, model, config);
  const items: MachineMenuItem[] = [...divMmc.slice(0, 1), ...interface1.slice(0, 1)];
  const rest = [...divMmc.slice(1), ...interface1.slice(1)];
  if (rest.length > 0) items.push({ type: "separator" }, ...rest);
  return items;
};

export const interface1MenuRenderer: MachineMenuRenderer = (windowInfo, machine, model, config) => {
  const state = mainStore.getState();
  const effective = config ?? state?.emulatorState?.config ?? model?.config;
  if (!isInterface1Machine(machine.machineId, model?.modelId, effective)) return [];
  const connected = hasInterface1(machine.machineId, model?.modelId, effective);
  const items: MachineMenuItem[] = [
    {
      id: "if1_connect",
      label: t("menu.if1.connect"),
      type: "checkbox",
      checked: connected,
      click: async () => {
        await setInterface1Connected(!connected);
      }
    }
  ];
  if (!connected) return items;
  items.push(createBooleanSettingsMenu(SETTING_EMU_FAST_MICRODRIVE, { label: t("menu.if1.fast") }) as MachineMenuItem);
  // --- The Microdrive Loader: RUN loads "run" from drive 1 (MICRODRIVE_PLAN 4.3)
  items.push({
    id: "if1_boot",
    label: t("menu.if1.boot"),
    enabled: !!state?.media?.[MEDIA_MICRODRIVES[0]]?.diskFile,
    click: async () => {
      try {
        await getEmuApi().startMicrodriveBoot(false);
      } catch (err) {
        dialog.showErrorBox(t("messages.if1.cannotBoot"), (err as Error)?.message ?? String(err));
      }
    }
  });
  for (let drive = 0; drive < MEDIA_MICRODRIVES.length; drive++) {
    const media = state?.media?.[MEDIA_MICRODRIVES[drive]] ?? {};
    const inserted = !!media.diskFile;
    const number = String(drive + 1);
    items.push({ type: "separator" });
    items.push({
      id: `if1_insert_${number}`,
      label: inserted ? t("menu.if1.change", { drive: number }) : t("menu.if1.insert", { drive: number }),
      click: async () => {
        await selectMicrodriveFile(windowInfo.emuWindow, drive);
      }
    });
    items.push({
      id: `if1_new_${number}`,
      label: t("menu.if1.newBlank", { drive: number }),
      click: async () => {
        await newBlankCartridge(windowInfo.emuWindow, drive);
      }
    });
    if (inserted) {
      items.push(
        {
          id: `if1_save_${number}`,
          label: t("menu.if1.saveAs", { drive: number }),
          click: async () => {
            await saveCartridgeAs(windowInfo.emuWindow, drive);
          }
        },
        {
          id: `if1_eject_${number}`,
          label: t("menu.if1.eject", { drive: number }),
          click: async () => {
            await ejectMicrodrive(drive);
          }
        }
      );
    }
    items.push({
      id: `if1_protect_${number}`,
      label: t("menu.if1.writeProtect", { drive: number }),
      type: "checkbox",
      checked: !!media.writeProtected,
      enabled: inserted,
      click: async () => {
        await setMicrodriveWriteProtection(drive, !media.writeProtected);
      }
    });
  }
  return items;
};

/**
 * Connects or disconnects the Interface 1: the machine restarts with the new configuration. The
 * DivMMC goes, saying so (Q4).
 */
export async function setInterface1Connected(on: boolean): Promise<void> {
  const emulatorState = mainStore.getState()?.emulatorState;
  const machineId = emulatorState?.machineId;
  const modelId = emulatorState?.modelId;
  if (!machineId || !isInterface1Machine(machineId, modelId, emulatorState?.config)) return;
  const config = { ...(emulatorState?.config ?? getModelConfig(machineId, modelId) ?? {}) };
  const hadDivMmc = !!config[MC_DIVMMC];
  if (on) {
    config[MC_INTERFACE1] = true;
    delete config[MC_DIVMMC];
  } else {
    delete config[MC_INTERFACE1];
  }
  await setMachineType(machineId, modelId, config);
  mainStore.dispatch(incMenuVersionAction());
  await saveKliveProject();
  await logEmuEvent(on ? "Interface 1 connected" : "Interface 1 disconnected");
  if (on && hadDivMmc) {
    await dialog.showMessageBox({ type: "info", title: t("messages.if1.exclusiveTitle"), message: t("messages.if1.divMmcDisconnected") });
  }
}

/** Asks for a cartridge and puts it into the drive */
export async function selectMicrodriveFile(owner: BrowserWindow, drive: number): Promise<void> {
  const lastFile = mainStore.getState().media?.[MEDIA_MICRODRIVES[drive]]?.diskFile;
  const dialogResult = await dialog.showOpenDialog(owner, {
    title: t("messages.if1.selectCartridge"),
    defaultPath: appSettings?.folders?.[MDR_FILE_FOLDER] || (lastFile ? path.dirname(lastFile) : app.getPath("home")),
    filters: [
      { name: t("common.filter.mdrFiles"), extensions: ["mdr"] },
      { name: t("common.filter.allFiles"), extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;
  await setSelectedMicrodriveFile(drive, dialogResult.filePaths[0]);
  await saveKliveProject();
  saveAppSettings();
}

/**
 * Puts a cartridge file into a drive: the media state (saved with the project and the settings),
 * then the bytes to the emulator. Its write protection is the file's last byte unless `writeProtected`
 * says otherwise.
 */
export async function setSelectedMicrodriveFile(drive: number, filename: string, writeProtected?: boolean): Promise<void> {
  let contents: Uint8Array;
  let protect = !!writeProtected;
  try {
    contents = new Uint8Array(fs.readFileSync(filename));
    const shape = mdrShape(contents);
    if (writeProtected === undefined) protect = shape.writeProtected;
  } catch (err) {
    dialog.showErrorBox(t("messages.if1.readErrorTitle"), t("messages.if1.readError", { file: filename, error: (err as Error).message }));
    return;
  }
  mainStore.dispatch(setMediaAction(MEDIA_MICRODRIVES[drive], { diskFile: filename, writeProtected: protect }));
  mainStore.dispatch(incMenuVersionAction());
  appSettings.folders ??= {};
  appSettings.folders[MDR_FILE_FOLDER] = path.dirname(filename);
  try {
    await getEmuApi().setMicrodriveWriteProtection(drive, protect);
    await getEmuApi().setMicrodriveFile(drive, filename, contents);
    await logEmuEvent(`Microdrive ${drive + 1}: ${filename}`);
  } catch (err) {
    dialog.showErrorBox(t("messages.if1.readErrorTitle"), t("messages.if1.readError", { file: filename, error: (err as Error).message }));
  }
}

/** Creates an unformatted cartridge file - the emulated FORMAT prepares it - and inserts it */
async function newBlankCartridge(owner: BrowserWindow, drive: number): Promise<void> {
  const dialogResult = await dialog.showSaveDialog(owner, {
    title: t("messages.if1.newCartridge"),
    defaultPath: path.join(newCartridgeDialogFolder(appSettings?.folders?.[MDR_FILE_FOLDER]), "cartridge.mdr"),
    filters: [{ name: t("common.filter.mdrFiles"), extensions: ["mdr"] }]
  });
  if (dialogResult.canceled || !dialogResult.filePath) return;
  fs.writeFileSync(dialogResult.filePath, createBlankMdr());
  await setSelectedMicrodriveFile(drive, dialogResult.filePath, false);
  await saveKliveProject();
  saveAppSettings();
}

/** Saves the cartridge, as the guest left it, to a new file, which then takes the drive */
async function saveCartridgeAs(owner: BrowserWindow, drive: number): Promise<void> {
  const image = await getEmuApi().getMicrodriveImage(drive);
  if (!image) return;
  const current = mainStore.getState().media?.[MEDIA_MICRODRIVES[drive]]?.diskFile;
  const dialogResult = await dialog.showSaveDialog(owner, {
    title: t("messages.if1.saveCartridge"),
    defaultPath: current ?? path.join(app.getPath("home"), "cartridge.mdr"),
    filters: [{ name: t("common.filter.mdrFiles"), extensions: ["mdr"] }]
  });
  if (dialogResult.canceled || !dialogResult.filePath) return;
  fs.writeFileSync(dialogResult.filePath, image);
  await setSelectedMicrodriveFile(drive, dialogResult.filePath);
  await saveKliveProject();
  saveAppSettings();
}

export async function ejectMicrodrive(drive: number): Promise<void> {
  mainStore.dispatch(setMediaAction(MEDIA_MICRODRIVES[drive], {}));
  mainStore.dispatch(incMenuVersionAction());
  await getEmuApi().setMicrodriveFile(drive);
  await logEmuEvent(`Microdrive ${drive + 1} ejected`);
  await saveKliveProject();
  saveAppSettings();
}

async function setMicrodriveWriteProtection(drive: number, protect: boolean): Promise<void> {
  const media = mainStore.getState().media?.[MEDIA_MICRODRIVES[drive]] ?? {};
  mainStore.dispatch(setMediaAction(MEDIA_MICRODRIVES[drive], { ...media, writeProtected: protect }));
  mainStore.dispatch(incMenuVersionAction());
  await getEmuApi().setMicrodriveWriteProtection(drive, protect);
  await saveKliveProject();
  saveAppSettings();
}

/** Forgets the user's Interface 1 ROM: the shipped one comes back */
export async function forgetInterface1Rom(): Promise<void> {
  setSettingValue(SETTING_EMU_IF1_ROM, "");
  await restartForInterface1Rom("Interface 1 ROM: the shipped one");
}

/** Asks for an Interface 1 ROM and restarts the machine with it */
export async function selectInterface1RomFile(owner: BrowserWindow): Promise<void> {
  const current = getSettingValue(SETTING_EMU_IF1_ROM) as string | undefined;
  const dialogResult = await dialog.showOpenDialog(owner, {
    title: t("messages.if1.selectRom"),
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
  if (size !== IF1_ROM_SIZE) {
    dialog.showErrorBox(t("messages.if1.notRom"), t("messages.if1.wrongSize", { file: filename, size }));
    return;
  }
  setSettingValue(SETTING_EMU_IF1_ROM, filename);
  await restartForInterface1Rom(`Interface 1 ROM set to ${filename}`);
}

/** Rebuilds the machine, which reads the ROM setting when it starts */
async function restartForInterface1Rom(message: string): Promise<void> {
  const emulatorState = mainStore.getState()?.emulatorState;
  if (emulatorState?.machineId && hasInterface1(emulatorState.machineId, emulatorState.modelId, emulatorState.config)) {
    await setMachineType(emulatorState.machineId, emulatorState.modelId, emulatorState.config ?? {});
  }
  mainStore.dispatch(incMenuVersionAction());
  saveAppSettings();
  await logEmuEvent(message);
}
