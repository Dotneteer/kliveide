import path from "path";
import fs from "fs";

import type { MachineMenuRenderer, MachineMenuItem } from "@common/machines/info-types";
import type { AppState } from "@state/AppState";

import { MF_TAPE_SUPPORT, MC_DISK_SUPPORT, MC_SP48_ROM_FILE } from "@common/machines/constants";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { setVolatileDocStateAction, setMediaAction, incMenuVersionAction } from "@state/actions";
import { BASIC_PANEL_ID } from "@state/common-ids";
import { mainStore } from "@main/main-store";
import { saveKliveProject } from "@main/projects";
import { logEmuEvent, setMachineType } from "@main/registeredMachines";
import { dialog, BrowserWindow, app } from "electron";
import { MEDIA_DISK_A, MEDIA_MICRODRIVES, MEDIA_DISK_B, MEDIA_DOCK, MEDIA_TAPE } from "@common/structs/project-const";
import { ejectMicrodrive, selectMicrodriveFile } from "./interface1-menus";
import { ejectDock, selectDockFile } from "./timex-menus";
import { CREATE_DISK_DIALOG } from "@messaging/dialog-ids";
import { createBooleanSettingsMenu } from "@main/menus/menu-utils";
import {
  SETTING_EMU_FAST_LOAD,
  SETTING_EMU_TRDOS_ROM,
  SETTING_EMU_ULA_LATE_TIMING,
  SETTING_EMU_ULA_SNOW
} from "@common/settings/setting-const";
import { appSettings, getSettingValue, saveAppSettings, setSettingValue } from "@main/settings-utils";
import { spectrumSnapshotSaveCommandText } from "@common/spectrum/snapshot/spectrumSnapshotSaveTypes";
import {
  MI_SCORPION,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_TIMEX,
  MI_HT1080Z,
  MI_TVC,
  MI_ENTERPRISE
} from "@common/machines/constants";

/** The machines whose drives are a Beta 128's (TR-DOS disks): the Pentagon's and the Scorpion's */
function isBeta128Machine(machineId: string | undefined): boolean {
  return machineId === MI_SPECTRUM_128 || machineId === MI_SCORPION;
}
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { getModelConfig } from "@common/machines/machine-registry";
import { t } from "@common/i18n/i18n";

const TAPE_FILE_FOLDER = "tapeFileFolder";
const DISK_FILE_FOLDER = "diskFileFolder";

type DiskMediaState = {
  diskFile?: string;
  writeProtected?: boolean;
};

/**
 * Renders tape commands
 */
export const tapeMenuRenderer: MachineMenuRenderer = (windowInfo, machine) => {
  const items: MachineMenuItem[] = [];
  const emuWindow = windowInfo.emuWindow;
  const appState = mainStore.getState();
  if (machine.features?.[MF_TAPE_SUPPORT]) {
    items.push({
      id: "rewind_tape",
      label: t("menu.tape.rewind"),
      click: async () => {
        await getEmuApi().issueMachineCommand("rewind");
      }
    });
    items.push({
      id: "select_tape_file",
      label: t("menu.tape.insert"),
      click: async () => {
        await setTapeFile(emuWindow, appState);
        await saveKliveProject();
      }
    });
    items.push({
      id: "eject_tape",
      label: t("menu.tape.eject"),
      enabled: !!appState.media?.[MEDIA_TAPE],
      click: async () => {
        await ejectTape(true);
        await saveKliveProject();
      }
    });
    items.push({ type: "separator" });
    items.push(createBooleanSettingsMenu(SETTING_EMU_FAST_LOAD, { label: t("menu.tape.fastLoad") }) as any);
  }
  return items;
};

/**
 * The Sinclair ULA's variants (`.plans/SPECTRUM_ULA_ACCURACY_PLAN.md` Phases 4, 5): the snow effect
 * and late timing, on the 16K/48K and the 128K. The Pentagon among the 128K's models ignores them.
 */
export const ulaHardwareRenderer: MachineMenuRenderer = () => [
  createBooleanSettingsMenu(SETTING_EMU_ULA_SNOW, { label: t("menu.spectrum.snowEffect") }) as any,
  createBooleanSettingsMenu(SETTING_EMU_ULA_LATE_TIMING, { label: t("menu.spectrum.lateUlaTiming") }) as any
];

/**
 * Renders disk commands
 */
export const diskMenuRenderer: MachineMenuRenderer = (windowInfo, _, model) => {
  const appState = mainStore.getState();
  const emuWindow = windowInfo.emuWindow;
  const disksSupported = model?.config?.[MC_DISK_SUPPORT] ?? 0;
  if (!disksSupported) {
    return [];
  }

  const floppySubMenu: MachineMenuItem[] = [
    {
      id: "create_disk_file",
      label: t("menu.disk.createDiskFile"),
      click: async () => {
        await getEmuApi().displayDialog(CREATE_DISK_DIALOG);
      }
    },
    { type: "separator" }
  ];
  // --- The Pentagon and the Scorpion: boot the disk in drive A through TR-DOS (`trdosFlows.ts`)
  if (isBeta128Machine(mainStore.getState()?.emulatorState?.machineId)) {
    floppySubMenu.push({
      id: "boot_disk",
      label: t("menu.disk.bootDriveA"),
      enabled: !!getDiskMediaState(0).diskFile,
      click: async () => {
        try {
          await getEmuApi().startDiskBoot(false);
        } catch (err) {
          dialog.showErrorBox(t("messages.disk.cannotBoot"), (err as Error)?.message ?? String(err));
        }
      }
    });
  }
  createDiskMenu(0, "a");
  if (disksSupported > 1) {
    createDiskMenu(1, "b");
  }

  return [
    { type: "separator" },
    {
      id: "floppy_menu",
      label: t("menu.disk.floppyDisks"),
      submenu: floppySubMenu
    }
  ];

  function createDiskMenu(index: number, suffix: string): void {
    const state = appState?.media?.[index ? MEDIA_DISK_B : MEDIA_DISK_A] ?? {};
    const hasDisk = !!state?.diskFile;
    // --- An `.scl` on the Pentagon is never written back: it can be saved as a `.trd` instead
    if (hasDisk && String(state.diskFile).toLowerCase().endsWith(".scl")) {
      floppySubMenu.push({
        id: `save_trd_${suffix}`,
        label: t("menu.disk.saveAsTrd", { drive: suffix.toUpperCase() }),
        click: async () => {
          await saveTrdosDiskAsTrd(emuWindow, index, suffix);
        }
      });
    }
    floppySubMenu.push({ type: "separator" });
    if (hasDisk) {
      floppySubMenu.push({
        id: `eject_disk_${suffix}`,
        label: t("menu.disk.eject", { drive: suffix.toUpperCase() }),
        click: async () => {
          await ejectDiskFile(index, suffix);
        }
      });
    }
    floppySubMenu.push({
      id: `protect_disk_${suffix}`,
      type: "checkbox",
      checked: !!state.writeProtected,
      enabled: hasDisk,
      label: t("menu.disk.writeProtect", { drive: suffix.toUpperCase() }),
      click: async () => {
        if (!hasDisk) return;
        const writeProtected = !state.writeProtected;
        mainStore.dispatch(
          setMediaAction(index ? MEDIA_DISK_B : MEDIA_DISK_A, {
            ...state,
            writeProtected
          })
        );
        mainStore.dispatch(incMenuVersionAction());
        await setDiskWriteProtection(index, suffix, writeProtected);
        await saveKliveProject();
      }
    });
    floppySubMenu.push({
      id: `insert_disk_${suffix}`,
      label: state?.diskFile
        ? t("menu.disk.change", { drive: suffix.toUpperCase() })
        : t("menu.disk.insert", { drive: suffix.toUpperCase() }),
      click: async () => {
        await setDiskFile(emuWindow, index, suffix);
        await saveKliveProject();
      }
    });
  }
};

/**
 * The TR-DOS ROM of the Pentagon's Beta 128 (`.plans/BETA128_TRDOS_PLAN.md` Q1): Klive cannot ship
 * it, so the user names their own copy in Settings › Machine; the machine restarts with it.
 */
export async function forgetTrdosRom(): Promise<void> {
  setSettingValue(SETTING_EMU_TRDOS_ROM, "");
  await restartForTrdosRom("TR-DOS ROM cleared");
}

/** Asks for the TR-DOS ROM and restarts the machine with it */
export async function selectTrdosRomFile(emuWindow: BrowserWindow): Promise<void> {
  const current = getSettingValue(SETTING_EMU_TRDOS_ROM) as string | undefined;
  const dialogResult = await dialog.showOpenDialog(emuWindow, {
    title: t("messages.trdos.selectRom"),
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
  if (size !== ROM_SIZE) {
    dialog.showErrorBox(t("messages.trdos.notRom"), t("messages.trdos.wrongSize", { file: filename, size }));
    return;
  }
  setSettingValue(SETTING_EMU_TRDOS_ROM, filename);
  await restartForTrdosRom(`TR-DOS ROM set to ${filename}`);
}

/** Rebuilds the machine, which reads the TR-DOS ROM setting when it starts */
async function restartForTrdosRom(message: string): Promise<void> {
  const emulatorState = mainStore.getState()?.emulatorState;
  await setMachineType(emulatorState?.machineId, emulatorState?.modelId, emulatorState?.config ?? {});
  mainStore.dispatch(incMenuVersionAction());
  saveAppSettings();
  await logEmuEvent(message);
}

/** Saves the Pentagon's disk in a drive (an `.scl`, with the guest's writes) as a new `.trd` */
async function saveTrdosDiskAsTrd(emuWindow: BrowserWindow, index: number, suffix: string): Promise<void> {
  const image = await getEmuApi().getTrdosDiskImage(index);
  if (!image) {
    dialog.showErrorBox(t("messages.trdos.noDisk"), t("messages.trdos.noDiskInDrive", { drive: suffix.toUpperCase() }));
    return;
  }
  const current = getDiskMediaState(index).diskFile;
  const result = await dialog.showSaveDialog(emuWindow, {
    title: t("messages.trdos.saveAsTrd"),
    defaultPath: current ? current.replace(/\.scl$/i, ".trd") : undefined,
    filters: [{ name: t("common.filter.trdosDisks"), extensions: ["trd"] }]
  });
  if (result.canceled || !result.filePath) return;
  fs.writeFileSync(result.filePath, image);
  // --- The new `.trd` takes the drive, so later writes go back to it
  await setSelectedDiskFile(index, result.filePath, getDiskMediaState(index).writeProtected ?? false, suffix);
  await logEmuEvent(`Disk in drive ${suffix.toUpperCase()} saved as ${result.filePath}`);
}

/**
 * Renders ZX Spectrum IDE commands
 */
export const spectrumIdeRenderer: MachineMenuRenderer = () => {
  const volatileDocs = mainStore.getState()?.ideView?.volatileDocs ?? {};
  return [
    {
      id: "show_basic",
      label: t("menu.spectrum.basicListing"),
      type: "checkbox",
      checked: volatileDocs[BASIC_PANEL_ID],
      click: async () => {
        await getIdeApi().showBasic(!volatileDocs[BASIC_PANEL_ID]);
        mainStore.dispatch(
          setVolatileDocStateAction(BASIC_PANEL_ID, !volatileDocs[BASIC_PANEL_ID])
        );
      }
    }
  ];
};

/**
 * Inserts a tape file into the machine, remembering it as the selected medium.
 * @param filename The tape's full path
 * @param showErrors Report a failure in a message box (the menu); the IDE's `tape-load` command
 * passes false and reports the returned message itself
 * @param restoring Startup is restoring the last session's tape: a tape of another machine (a TVC
 * or HT-1080Z .cas) waits for it without a message box; errors are still reported
 * @returns The failure's message, or undefined when the tape was inserted
 */
export async function setSelectedTapeFile(
  filename: string,
  showErrors = true,
  restoring = false
): Promise<string | undefined> {
  // --- Read the file
  const tapeFileFolder = path.dirname(filename);

  // --- Store the last selected tape file
  mainStore.dispatch(setMediaAction(MEDIA_TAPE, filename));

  // --- Save the folder into settings
  appSettings.folders ??= {};
  appSettings.folders[TAPE_FILE_FOLDER] = tapeFileFolder;

  try {
    const contents = fs.readFileSync(filename);
    await getEmuApi().setTapeFile(filename, new Uint8Array(contents), undefined, undefined, restoring || undefined);
    await logEmuEvent(`Tape file set to ${filename}`);
    return undefined;
  } catch (err) {
    if (showErrors) {
      dialog.showErrorBox(
        t("messages.tape.readErrorTitle"),
        t("messages.tape.readError", { file: filename, error: err.message })
      );
    }
    await ejectTape();
    return t("messages.readFileError", { file: filename, error: err.message });
  }
}

/**
 * Inserts a tape or disk through the open-file dialog, exactly as the Machine menu's
 * "Select Tape File..." / "Insert Disk into Drive X..." items do. The emulator's media strip uses it.
 * @param browserWindow The window that owns the dialog
 * @param mediaId MEDIA_TAPE, MEDIA_DISK_A or MEDIA_DISK_B
 */
export async function selectMediaFile(browserWindow: BrowserWindow, mediaId: string): Promise<void> {
  if (mediaId === MEDIA_DOCK) {
    await selectDockFile(browserWindow);
  } else if (mediaId === MEDIA_TAPE) {
    await setTapeFile(browserWindow, mainStore.getState());
  } else if (mediaId === MEDIA_DISK_A || mediaId === MEDIA_DISK_B) {
    const index = mediaId === MEDIA_DISK_B ? 1 : 0;
    await setDiskFile(browserWindow, index, index ? "b" : "a");
  } else if ((MEDIA_MICRODRIVES as readonly string[]).includes(mediaId)) {
    await selectMicrodriveFile(browserWindow, MEDIA_MICRODRIVES.indexOf(mediaId as never));
  } else {
    return;
  }
  await saveKliveProject();
}

/**
 * Ejects a tape (after the same confirmation the menu asks for) or a disk, exactly as the Machine
 * menu does. The emulator's media strip uses it.
 * @param mediaId MEDIA_TAPE, MEDIA_DISK_A or MEDIA_DISK_B
 */
export async function ejectMediaFile(mediaId: string): Promise<void> {
  if (mediaId === MEDIA_DOCK) {
    await ejectDock();
  } else if (mediaId === MEDIA_TAPE) {
    await ejectTape(true);
  } else if (mediaId === MEDIA_DISK_A || mediaId === MEDIA_DISK_B) {
    const index = mediaId === MEDIA_DISK_B ? 1 : 0;
    await ejectDiskFile(index, index ? "b" : "a");
  } else if ((MEDIA_MICRODRIVES as readonly string[]).includes(mediaId)) {
    await ejectMicrodrive(MEDIA_MICRODRIVES.indexOf(mediaId as never));
  } else {
    return;
  }
  await saveKliveProject();
}

// ============================================================================
// Helper functions

/**
 * Sets the tape file to use with the machine
 * @param browserWindow Host browser window
 * @returns The data blocks read from the tape, if successful; otherwise, undefined.
 */
async function setTapeFile(browserWindow: BrowserWindow, state: AppState): Promise<void> {
  const lastFile = state.media?.[MEDIA_TAPE];
  const defaultPath =
    appSettings?.folders?.[TAPE_FILE_FOLDER] ||
    (lastFile ? path.dirname(lastFile) : app.getPath("home"));
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    title: t("messages.tape.select"),
    defaultPath,
    filters: [
      // --- The media strip's Insert button asks here on the HT-1080Z too (`.plans/HT1080Z_PLAN.md` §9)
      state.emulatorState?.machineId === MI_HT1080Z
        ? { name: t("common.filter.ht1080zTapes"), extensions: ["cas", "cmd", "bas"] }
        : state.emulatorState?.machineId === MI_TVC
          ? { name: t("common.filter.tvcTapes"), extensions: ["cas"] }
          : { name: t("common.filter.tapeFiles"), extensions: ["tap", "tzx"] },
      { name: t("common.filter.allFiles"), extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;

  // --- Read the file
  await setSelectedTapeFile(dialogResult.filePaths[0]);
}

/**
 * Ejects the current tape file
 * @param browserWindow Host browser window
 */
async function ejectTape(confirm = false): Promise<void> {
  if (confirm) {
    const result = await dialog.showMessageBox({
      type: "question",
      buttons: [t("common.button.yes"), t("common.button.no")],
      title: t("messages.tape.ejectTitle"),
      message: t("messages.tape.ejectConfirm")
    });
    if (result.response !== 0) return;
  }
  // --- Store the last selected tape file
  mainStore.dispatch(setMediaAction(MEDIA_TAPE, ""));
  await getEmuApi().setTapeFile("", new Uint8Array(0));
  await logEmuEvent(`Tape file ejected.`);
}

/**
 * Sets the disk file to use with the machine
 * @param browserWindow Host browser window
 * @param index Disk drive index (0: A, 1: B)
 * @returns The data blocks read from the tape, if successful; otherwise, undefined.
 */
async function setDiskFile(
  browserWindow: BrowserWindow,
  index: number,
  suffix: string
): Promise<void> {
  const lastFile = getDiskMediaState(index).diskFile;
  const defaultPath =
    appSettings?.folders?.[DISK_FILE_FOLDER] ||
    (lastFile ? path.dirname(lastFile) : app.getPath("home"));
  // --- The Pentagon's and the Scorpion's Beta 128 reads TR-DOS images; the +3 reads CPC DSK; the
  // --- Enterprise's EXDOS card raw FAT12 images (`EpDiskImage.ts`)
  const machineId = mainStore.getState()?.emulatorState?.machineId;
  const trdos = isBeta128Machine(machineId);
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    title: t("messages.disk.select"),
    defaultPath,
    filters: [
      trdos
        ? { name: t("common.filter.trdosDisks"), extensions: ["trd", "scl"] }
        : machineId === MI_ENTERPRISE
          ? { name: t("common.filter.epDisks"), extensions: ["img", "dsk"] }
          : { name: t("common.filter.diskFiles"), extensions: ["dsk"] },
      { name: t("common.filter.allFiles"), extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;

  // --- Read the file
  const filename = dialogResult.filePaths[0];
  await setSelectedDiskFile(index, filename, true, suffix);
}

export async function setSelectedDiskFile(
  index: number,
  filename: string,
  writeProtected = true,
  suffix = index ? "b" : "a"
): Promise<void> {
  const mediaId = index ? MEDIA_DISK_B : MEDIA_DISK_A;
  const diskFileFolder = path.dirname(filename);

  // --- Store the last selected disk file
  mainStore.dispatch(
    setMediaAction(mediaId, {
      diskFile: filename,
      writeProtected
    })
  );
  mainStore.dispatch(incMenuVersionAction());

  // --- Save the folder into settings
  appSettings.folders ??= {};
  appSettings.folders[DISK_FILE_FOLDER] = diskFileFolder;

  try {
    const contents = fs.readFileSync(filename);
    await getEmuApi().setDiskWriteProtection(index, writeProtected);
    await getEmuApi().setDiskFile(index, filename, new Uint8Array(contents));
    await logEmuEvent(`Disk file in drive ${suffix.toUpperCase()} set to ${filename}`);
  } catch (err) {
    dialog.showErrorBox(
      t("messages.disk.readErrorTitle"),
      t("messages.disk.readError", { file: filename, error: err.message })
    );
    await ejectDiskFile(index, suffix);
  }
}

/**
 * Sets the disk file to use with the machine
 * @param browserWindow Host browser window
 * @param index Disk drive index (0: A, 1: B)
 * @returns The data blocks read from the tape, if successful; otherwise, undefined.
 */
async function ejectDiskFile(index: number, suffix: string): Promise<void> {
  mainStore.dispatch(setMediaAction(index ? MEDIA_DISK_B : MEDIA_DISK_A, {}));
  mainStore.dispatch(incMenuVersionAction());
  try {
    await getEmuApi().setDiskFile(index);
    await logEmuEvent(`Disk ejected from drive ${suffix.toUpperCase()}`);
  } catch (err) {
    dialog.showErrorBox(t("messages.disk.ejectErrorTitle"), t("messages.disk.ejectError", { error: err.message }));
  }
}

async function setDiskWriteProtection(
  index: number,
  suffix: string,
  protect: boolean
): Promise<void> {
  try {
    await getEmuApi().setDiskWriteProtection(index, protect);
    await logEmuEvent(
      `Write protection turned ${protect ? "on" : "off"} for drive ${suffix.toUpperCase()}`
    );
  } catch (err) {
    // --- Intentionally ignored
  }
}

function getDiskMediaState(index: number): DiskMediaState {
  const media = mainStore.getState()?.media?.[index ? MEDIA_DISK_B : MEDIA_DISK_A];
  return typeof media === "object" && media ? media : {};
}

const ROM_FILE_FOLDER = "sp48RomFileFolder";
const ROM_SIZE = 16384;

/**
 * Opens a file dialog to select a ZX Spectrum 48 ROM file (exactly 16K).
 * Stores the path in the emulator config and restarts the machine.
 */
export async function selectSp48RomFile(emuWindow: BrowserWindow): Promise<void> {
  const emulatorState = mainStore.getState()?.emulatorState;
  const defaultPath =
    appSettings?.folders?.[ROM_FILE_FOLDER] ?? app.getPath("home");

  const dialogResult = await dialog.showOpenDialog(emuWindow, {
    title: t("messages.rom.select"),
    defaultPath,
    filters: [
      { name: t("common.filter.romFiles"), extensions: ["rom", "bin"] },
      { name: t("common.filter.allFiles"), extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;

  const filename = dialogResult.filePaths[0];

  // --- Validate file size (must be exactly 16K)
  let contents: Buffer;
  try {
    contents = fs.readFileSync(filename);
  } catch (err) {
    dialog.showErrorBox(t("messages.rom.readErrorTitle"), t("messages.rom.readError", { file: filename, error: err.message }));
    return;
  }
  if (contents.length !== ROM_SIZE) {
    dialog.showErrorBox(
      t("messages.rom.invalidTitle"),
      t("messages.rom.invalidSp48", { size: contents.length, romSize: ROM_SIZE })
    );
    return;
  }

  // --- Save the folder for next time
  appSettings.folders ??= {};
  appSettings.folders[ROM_FILE_FOLDER] = path.dirname(filename);

  // --- Update config and restart the machine
  const machineId = emulatorState?.machineId;
  const modelId = emulatorState?.modelId;
  const config = { ...(getModelConfig(machineId, modelId) ?? emulatorState?.config ?? {}) };
  config[MC_SP48_ROM_FILE] = filename;
  await setMachineType(machineId, modelId, config);
  mainStore.dispatch(incMenuVersionAction());
  await logEmuEvent(`Custom ROM file set to ${filename}`);
  await saveKliveProject();
}

/**
 * Clears the custom ROM file from config and restarts the machine with the default ROM.
 */
export async function resetSp48RomFile(): Promise<void> {
  const result = await dialog.showMessageBox({
    type: "question",
    buttons: [t("common.button.yes"), t("common.button.no")],
    title: t("messages.rom.resetTitle"),
    message: t("messages.rom.resetConfirm")
  });
  if (result.response !== 0) return;

  const emulatorState = mainStore.getState()?.emulatorState;
  const machineId = emulatorState?.machineId;
  const modelId = emulatorState?.modelId;
  const config = { ...(getModelConfig(machineId, modelId) ?? emulatorState?.config ?? {}) };
  delete config[MC_SP48_ROM_FILE];
  await setMachineType(machineId, modelId, config);
  mainStore.dispatch(incMenuVersionAction());
  await logEmuEvent("ROM reset to default");
  await saveKliveProject();
}

/** The settings key of the folder the last ZX Spectrum snapshot was saved to */
const SPECTRUM_SNAPSHOT_FOLDER = "spectrumSnapshotFolder";

/**
 * Can the emulator's machine be saved as a ZX Spectrum snapshot now? It must be a 48K, 128K,
 * +2E/+3E or TC2048 with a state: running or paused (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` D4).
 */
export function canSaveSpectrumSnapshot(state: AppState = mainStore.getState()): boolean {
  const machineId = state?.emulatorState?.machineId;
  const execState = state?.emulatorState?.machineState;
  return (
    !!machineId &&
    [MI_SPECTRUM_48, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_TIMEX, MI_SCORPION].includes(machineId) &&
    (execState === MachineControllerState.Running || execState === MachineControllerState.Paused)
  );
}

/** A default snapshot file name: the project's (or the machine's) name and the time */
export function defaultSnapshotFileName(state: AppState, now = new Date()): string {
  const folder = state?.project?.folderPath;
  const base = folder
    ? path.basename(folder)
    : (state?.emulatorState?.machineId ?? "spectrum");
  const pad = (n: number) => `${n}`.padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${base}-${stamp}.szx`;
}

/**
 * Asks for a file and saves the machine into it through the IDE's `zx-snapshot-save` command
 * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.4). The extension picks the format, `.szx`
 * first. What the chosen format could not hold is shown afterwards, unless the user turned that
 * notice off for the format. The machine menus and File -> Save ZX Spectrum Snapshot... share it.
 * @param browserWindow The window that owns the dialogs
 */
export async function saveSpectrumSnapshotAs(browserWindow: BrowserWindow): Promise<void> {
  const state = mainStore.getState();
  const folder = appSettings?.folders?.[SPECTRUM_SNAPSHOT_FOLDER] || app.getPath("home");
  const dialogResult = await dialog.showSaveDialog(browserWindow, {
    title: t("messages.snapshot.saveTitle"),
    defaultPath: path.join(folder, defaultSnapshotFileName(state)),
    filters: [
      { name: t("common.filter.szxSnapshot"), extensions: ["szx"] },
      { name: t("common.filter.z80Snapshot"), extensions: ["z80"] },
      { name: t("common.filter.snaSnapshot"), extensions: ["sna"] }
    ],
    properties: ["showOverwriteConfirmation", "createDirectory"]
  });
  if (dialogResult.canceled || !dialogResult.filePath) return;

  let filename = dialogResult.filePath;
  if (!/\.(szx|z80|sna)$/i.test(filename)) filename += ".szx";
  appSettings.folders ??= {};
  appSettings.folders[SPECTRUM_SNAPSHOT_FOLDER] = path.dirname(filename);
  saveAppSettings();

  // --- The dialog has already confirmed any overwrite
  const result = await getIdeApi().executeCommand(spectrumSnapshotSaveCommandText(filename, true));
  if (!result?.success) {
    await dialog.showMessageBox(browserWindow, {
      type: "error",
      title: t("messages.snapshot.title"),
      message: result?.finalMessage ?? t("messages.snapshot.couldNotSave", { file: filename })
    });
    return;
  }

  const losses: string[] = result.value?.losses ?? [];
  const format: string = result.value?.format ?? "";
  const muted = appSettings.snapshotLossNoticesMuted ?? [];
  if (!losses.length || muted.includes(format)) return;
  const answer = await dialog.showMessageBox(browserWindow, {
    type: "warning",
    title: t("messages.snapshot.title"),
    message: t("messages.snapshot.lossy", { format }),
    detail: losses.map((l) => `• ${l}`).join("\n") + "\n\n" + t("messages.snapshot.lossyHint"),
    checkboxLabel: t("messages.snapshot.dontShowAgain", { format })
  });
  if (answer.checkboxChecked) {
    appSettings.snapshotLossNoticesMuted = [...muted, format];
    saveAppSettings();
  }
}

