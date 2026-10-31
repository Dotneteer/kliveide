import path from "path";
import fs from "fs";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MachineMenuItem, MachineMenuRenderer } from "@common/machines/info-types";
import { AppState } from "@common/state/AppState";
import { MEDIA_SD_CARD } from "@common/structs/project-const";
import { mainStore } from "@main/main-store";
import { saveKliveProject } from "@main/projects";
import { app, BrowserWindow, dialog } from "electron";
import { KLIVE_HOME_FOLDER } from "@main/settings";
import { getKliveHomeBase } from "@main/portable";
import { setMediaAction } from "@common/state/actions";
import { logEmuEvent } from "@main/registeredMachines";
import { CimHandler } from "@main/fat32/CimHandlers";
import { openHardDiskImage } from "@main/hard-disk-images";
import type { BlockDevice } from "@common/diskfs/blockDevice";
import { appSettings, getSettingValue, saveAppSettings, setSettingValue } from "@main/settings-utils";
import { getEmuApi } from "@common/messaging/MainToEmuMessenger";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { SETTING_EMU_NEXT_AUDIO_OUTPUT, SETTING_EMU_SCANLINE_EFFECT } from "@common/settings/setting-const";
import { NEXT_AUDIO_OUTPUTS, normalizeNextAudioOutput } from "@common/settings/next-audio-output";
import { englishLabel } from "@common/i18n/labels";
import { ensureSdCardBackupIfEnabled } from "./sd-card-backup";
import { withSdCardAccess } from "../sd-card-access";
import { t } from "@common/i18n/i18n";
import { NEXT_PROFILE_IDS, nextProfileOf, romSetOf } from "@emu/machines/zxNext/nextProfiles";

export const SD_CARD_FILE_FOLDER = "sdCardFileFolder";

/**
 * The active Next model's default SD card (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D7): each model has
 * its own working copy in the Klive home folder (`ks2.cim` for KS2 with core 3.02.01, the file every
 * earlier Klive wrote) and its ROM set's base image, so switching models never boots NextZXOS from a
 * card of another release. A user-selected card (`MEDIA_SD_CARD`) still overrides it.
 */
export function defaultSdCardOf(modelId: string | undefined = mainStore.getState().emulatorState?.modelId): {
  /** The working copy's full path */
  workingCopy: string;
  /** The base image's full path, which a new or reset working copy is copied from */
  baseImage: string;
} {
  const profile = nextProfileOf(modelId);
  return {
    workingCopy: path.join(getKliveHomeBase(), KLIVE_HOME_FOLDER, profile.sdWorkingCopy),
    baseImage: path.join(process.env.PUBLIC ?? "", romSetOf(profile).sdBaseImage.file)
  };
}

/** Whether a card is the default working copy of a Next model other than `modelId` */
function isAnotherModelsDefaultSdCard(file: string | undefined, modelId: string | undefined): boolean {
  if (!file) return false;
  const active = defaultSdCardOf(modelId).workingCopy;
  return NEXT_PROFILE_IDS.some((id) => {
    const workingCopy = defaultSdCardOf(id).workingCopy;
    return workingCopy !== active && path.resolve(workingCopy) === path.resolve(file);
  });
}

/** The active Next model's default SD card working copy (full path) */
export function getDefaultSdCardPath(): string {
  return defaultSdCardOf().workingCopy;
}

/**
 * Machine › SD Card
 */
export const sdCardMenuRenderer: MachineMenuRenderer = (windowInfo) => {
  const items: MachineMenuItem[] = [];
  const emuWindow = windowInfo.emuWindow;
  const appState = mainStore.getState();
  items.push({
    id: "select_sd_card",
    label: t("menu.next.selectImage"),
    enabled: isMachineStopped(),
    click: async () => {
      await setSdCardFile(emuWindow, appState);
      await saveKliveProject();
      saveAppSettings();
    }
  });
  items.push({
    id: "default_sd_card",
    label: t("menu.next.useDefaultImage"),
    enabled: isMachineStopped(),
    click: async () => {
      // --- Store the last selected tape file
      mainStore.dispatch(setMediaAction(MEDIA_SD_CARD, undefined));
      logSdCardEvent(getDefaultSdCardFile());
      await saveKliveProject();
      saveAppSettings();
    }
  });
  items.push({ type: "separator" });
  items.push({
    id: "reset_sd_card",
    label: t("menu.next.resetDefaultImage"),
    enabled:
      appState.emulatorState?.machineState === MachineControllerState.Stopped ||
      appState.emulatorState?.machineState === MachineControllerState.None,
    click: async () => {
      // --- Display an electron dialog to confirm the reset. Default is No.
      const result = await dialog.showMessageBox(emuWindow, {
        type: "question",
        buttons: [t("common.button.yes"), t("common.button.no")],
        defaultId: 1,
        title: t("messages.sdCard.resetTitle"),
        message: t("messages.sdCard.resetConfirm")
      });

      if (result.response === 0) {
        await resetToDefaultSdCardFile();
      }
    }
  });
  return items;
};

/**
 * Which of the Next's sound outputs Klive plays (`next-audio-output.ts`): the jack, the internal
 * speaker or HDMI. A setting rather than a machine option, so switching needs no restart.
 */
export const soundOutputMenuRenderer: MachineMenuRenderer = () => {
  const current = normalizeNextAudioOutput(getSettingValue(SETTING_EMU_NEXT_AUDIO_OUTPUT));
  return [
    {
      id: "zx_next_sound_output",
      label: t("menu.next.soundOutput"),
      submenu: NEXT_AUDIO_OUTPUTS.map((option) => ({
        id: `zx_next_sound_output_${option.value}`,
        label: option.label,
        type: "radio",
        checked: current === option.value,
        click: async () => {
          setSettingValue(SETTING_EMU_NEXT_AUDIO_OUTPUT, option.value);
          await logEmuEvent(`Sound output: ${englishLabel(option)}`);
        }
      }))
    }
  ];
};

export const hotkeyMenuRenderer: MachineMenuRenderer = () => {
  const items: MachineMenuItem[] = [
    {
      id: "zx_next_hotkeys",
      label: t("menu.next.hotkeys"),
      submenu: [
        {
          id: "zx_next_hotkey_f1",
          label: t("menu.next.hotkey.f1"),
          enabled: isMachineRunning(),
          click: async () => {
            await getEmuApi().issueMachineCommand("restart");
          }
        },
        {
          id: "zx_next_hotkey_f2",
          label: t("menu.next.hotkey.f2"),
          enabled: isMachineRunning(),
          click: async () => {
            const enabled = await getEmuApi().issueMachineCommand("custom", "toggleScandoubler");
            await logEmuEvent(`Scandoubler ${enabled ? "enabled" : "disabled"}`);
          }
        },
        {
          id: "zx_next_hotkey_f3",
          label: t("menu.next.hotkey.f3"),
          enabled: isMachineRunning(),
          click: async () => {
            const hz60Mode = await getEmuApi().issueMachineCommand("custom", "toggle5060Hz");
            await logEmuEvent(`Display mode ${hz60Mode ? "60Hz" : "50Hz"}`);
          }
        },
        {
          id: "zx_next_hotkey_f4",
          label: t("menu.next.hotkey.f4"),
          enabled: isMachineRunning(),
          click: async () => {
            await getEmuApi().issueMachineCommand("reset");
          }
        },
        {
          id: "zx_next_hotkey_f5",
          label: t("menu.next.hotkey.f5"),
          enabled: isMachineRunning(),
          click: async () => {
            const result = await getEmuApi().issueMachineCommand("custom", "enableExpansionBus");
            if (result === true) await logEmuEvent("Expansion Bus enabled");
          }
        },
        {
          id: "zx_next_hotkey_f6",
          label: t("menu.next.hotkey.f6"),
          enabled: isMachineRunning(),
          click: async () => {
            const result = await getEmuApi().issueMachineCommand("custom", "disableExpansionBus");
            if (result === false) await logEmuEvent("Expansion Bus disabled");
          }
        },
        {
          id: "zx_next_hotkey_f7",
          label: t("menu.next.hotkey.f7"),
          enabled: isMachineRunning(),
          click: async () => {
            const values = ["off", "50%", "25%", "12.5%"];
            const scanLineValue = await getEmuApi().issueMachineCommand(
              "custom",
              "adjustScanlineWeight"
            );
            setSettingValue(SETTING_EMU_SCANLINE_EFFECT, values[scanLineValue]);
            await logEmuEvent(`Scanline weight set to ${values[scanLineValue]}`);
          }
        },
        {
          id: "zx_next_hotkey_f8",
          label: t("menu.next.hotkey.f8"),
          enabled: isMachineRunning(),
          click: async () => {
            await getEmuApi().issueMachineCommand("custom", "cycleCpuSpeed");
          }
        },
        {
          id: "zx_next_hotkey_f9",
          label: t("menu.next.hotkey.f9"),
          enabled: isMachineRunning(),
          click: async () => {
            await getEmuApi().issueMachineCommand("custom", "multifaceNmi");
          }
        },
        {
          id: "zx_next_hotkey_f10",
          label: t("menu.next.hotkey.f10"),
          enabled: isMachineRunning(),
          click: async () => {
            await getEmuApi().issueMachineCommand("custom", "divmmcNmi");
          }
        }
      ]
    },
    { type: "separator" }
  ];
  return items;
};

export async function initializeZxSpectrumNext(modelId?: string): Promise<void> {
  // --- This is where the SD Card file is stored
  const { workingCopy: sdCardPath, baseImage: sourceSdCardPath } = defaultSdCardOf(modelId);
  if (!fs.existsSync(sdCardPath)) {
    // --- Create the folder if it does not exist
    fs.mkdirSync(path.dirname(sdCardPath), { recursive: true });
  }

  if (fs.existsSync(sdCardPath) && fs.statSync(sdCardPath).isFile()) {
    // --- The file exits, we are done
    return;
  }

  // --- Copy the SD Card file from the source
  if (fs.existsSync(sourceSdCardPath) && fs.statSync(sourceSdCardPath).isFile()) {
    fs.copyFileSync(sourceSdCardPath, sdCardPath);
    // --- Create initial backup after copying
    await ensureSdCardBackupIfEnabled(sdCardPath);
  }
}

export async function setupZxSpectrumNext(modelId?: string): Promise<void> {
  const targetModel = modelId ?? mainStore.getState().emulatorState?.modelId;
  // --- The model being switched to has its own default card (D7): make its working copy on first use
  await initializeZxSpectrumNext(targetModel);
  // --- Check, if the SD Card is set at all. Another model's default card counts as no choice:
  // --- switching models switches default cards
  const appState = mainStore.getState();
  const selected = appState.media?.[MEDIA_SD_CARD];
  const sdCardFile = isAnotherModelsDefaultSdCard(selected, targetModel) ? undefined : selected;
  if (sdCardFile) {
    // --- Use the file stored in settings
    await logSdCardEvent(sdCardFile);
    // --- Ensure backup on startup
    await ensureSdCardBackupIfEnabled(sdCardFile);
  } else {
    // --- Set the default SD Card file
    const defaultSdCard = defaultSdCardOf(targetModel).workingCopy;
    mainStore.dispatch(setMediaAction(MEDIA_SD_CARD, defaultSdCard));
    await logSdCardEvent(defaultSdCard);
    // --- Ensure backup on startup
    await ensureSdCardBackupIfEnabled(defaultSdCard);
  }
}

function getDefaultSdCardFile(): string {
  return getDefaultSdCardPath();
}

async function logSdCardEvent(filename: string): Promise<void> {
  await logEmuEvent(`ZX Spectrum Next SD card image: ${filename}`);
}

async function resetToDefaultSdCardFile(): Promise<void> {
  const { workingCopy: sdCardPath, baseImage: sourceSdCardPath } = defaultSdCardOf();

  // --- Rewriting the image must not overlap with emulated sector I/O or a file copy, all of
  // --- which work on the very same file.
  await withSdCardAccess(async () => {
    // --- Release the cached handler before touching the file. It holds an open descriptor on the
    // --- image: on Windows that descriptor makes the unlink below fail outright, and everywhere
    // --- else the cache would happily keep serving a handler bound to the deleted file (the
    // --- cache is only invalidated when the *file name* changes, and it does not change here).
    invalidateSdCardHandler();

    // --- Get the default SD Card file, and delete the current one
    if (fs.existsSync(sdCardPath) && fs.statSync(sdCardPath).isFile()) {
      // --- Delete the file
      fs.unlinkSync(sdCardPath);
    }

    // --- Copy the SD Card file from the source
    if (fs.existsSync(sourceSdCardPath) && fs.statSync(sourceSdCardPath).isFile()) {
      fs.copyFileSync(sourceSdCardPath, sdCardPath);
    }

    // --- Create backup of reset file
    await ensureSdCardBackupIfEnabled(sdCardPath);

    // --- Make the file writeable
    const cimHandler = getSdCardHandler();
    cimHandler.setReadOnly(false);
  });

  mainStore.dispatch(setMediaAction(MEDIA_SD_CARD, undefined));
  await saveKliveProject();
  saveAppSettings();
  await logEmuEvent(`Default SD card image is reset to its original state`);
  await logSdCardEvent(getDefaultSdCardFile());
}

/** The SD card image file the Next uses now (the media store's, or the default one) */
export function activeSdCardFile(): string {
  return mainStore.getState().media?.[MEDIA_SD_CARD] ?? getDefaultSdCardFile();
}

let cimHandler: CimHandler;
let currentSdCardFile: string;

// --- Use this function to get the CIM handler
export function getSdCardHandler(): CimHandler {
  const appState = mainStore.getState();
  const sdCardFile = appState.media?.[MEDIA_SD_CARD] ?? getDefaultSdCardFile();
  
  // --- Invalidate cache if SD card file has changed
  if (cimHandler && currentSdCardFile !== sdCardFile) {
    cimHandler.close();
    cimHandler = undefined;
  }
  
  if (!cimHandler) {
    cimHandler = new CimHandler(sdCardFile);
    currentSdCardFile = sdCardFile;
  }
  return cimHandler;
}

/**
 * Invalidates the cached CimHandler so it is re-created with fresh header data
 * on the next access. Must be called after external modifications to the .cim file
 * (e.g. copyToSdCard) so that the emulator sees the updated cluster map.
 */
export function invalidateSdCardHandler(): void {
  if (cimHandler) {
    cimHandler.close();
    cimHandler = undefined;
  }
  if (rawSdCard) {
    rawSdCard.device.close();
    rawSdCard = undefined;
  }
}

/** The SD card's sectors, whatever its container (`getSdCardDevice`) */
export type SdCardDevice = {
  readonly totalSectors: number;
  readSector(sector: number): Uint8Array;
  /** Written and flushed to the disk before it returns */
  writeSector(sector: number, data: Uint8Array): void;
};

let rawSdCard: { file: string; device: BlockDevice & { close(): void } } | undefined;

/**
 * The machine's SD card as sectors (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md C5): a `.cim` through
 * its handler (the Next's card, and the default one), a raw `.img` or an `.hdf` (the DivMMC's cards are
 * often those) as a block device over the file
 */
export function getSdCardDevice(): SdCardDevice {
  const sdCardFile = activeSdCardFile();
  if (sdCardFile.toLowerCase().endsWith(".cim")) {
    const handler = getSdCardHandler();
    return {
      totalSectors: (handler.cimInfo.maxSize * 2048) / handler.cimInfo.sectorSize,
      readSector: (sector) => handler.readSector(sector),
      writeSector: (sector, data) => handler.writeSector(sector, data)
    };
  }
  if (rawSdCard && rawSdCard.file !== sdCardFile) {
    rawSdCard.device.close();
    rawSdCard = undefined;
  }
  if (!rawSdCard) rawSdCard = { file: sdCardFile, device: openHardDiskImage(sdCardFile) };
  const device = rawSdCard.device;
  return {
    totalSectors: device.sectorCount,
    readSector: (sector) => (sector < device.sectorCount ? device.readSector(sector) : new Uint8Array(512)),
    writeSector: (sector, data) => {
      if (sector >= device.sectorCount) throw new Error(`Sector ${sector} is past the card's end`);
      device.writeSector(sector, data);
      (device as { flush?(): void }).flush?.();
    }
  };
}

// ============================================================================
// Helper functions

/**
 * Sets the tape file to use with the machine
 * @param browserWindow Host browser window
 * @returns The data blocks read from the tape, if successful; otherwise, undefined.
 */
async function setSdCardFile(browserWindow: BrowserWindow, state: AppState): Promise<void> {
  const lastFile = state.media?.[MEDIA_SD_CARD];
  const defaultPath =
    appSettings?.folders?.[SD_CARD_FILE_FOLDER] ||
    (lastFile ? path.dirname(lastFile) : app.getPath("home"));
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    // --- Was "Select Tape File", a copy-paste slip: this picks the Next's SD card image
    title: t("messages.sdCard.select"),
    defaultPath,
    filters: [
      { name: t("common.filter.cimImages"), extensions: ["cim"] },
      { name: t("common.filter.allFiles"), extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;

  // --- Read the file
  await setSelectedSdCardFile(dialogResult.filePaths[0]);
}

export async function setSelectedSdCardFile(filename: string): Promise<void> {
  // --- Read the file
  const sdCardFolder = path.dirname(filename);

  // --- Store the last selected tape file
  mainStore.dispatch(setMediaAction(MEDIA_SD_CARD, filename));
  await logSdCardEvent(filename);

  // --- Save the folder into settings
  appSettings.folders ??= {};
  appSettings.folders[SD_CARD_FILE_FOLDER] = sdCardFolder;

  // --- Create backup if needed
  await ensureSdCardBackupIfEnabled(filename);
}

function isMachineRunning(): boolean {
  const state = mainStore.getState();
  return (
    state.emulatorState?.machineState === MachineControllerState.Running ||
    state.emulatorState?.machineState === MachineControllerState.Paused
  );
}

function isMachineStopped(): boolean {
  const state = mainStore.getState();
  return (
    state.emulatorState?.machineState === MachineControllerState.Stopped ||
    state.emulatorState?.machineState === MachineControllerState.None
  );
}

/**
 * View › Machine Views on the Next: the Copper List document (`.plans/COPPER_DEBUGGING_PLAN.md`
 * §4.5), the Sprite Inspector (`.plans/SPRITE_INSPECTOR_PLAN.md` §4.4), the Tilemap Inspector
 * (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.4), the Layer 2 Inspector (`.plans/LAYER2_INSPECTOR_PLAN.md`
 * §4.4) and the Layers document (`.plans/LAYER_COMPOSITION_PLAN.md`). All go through the IDE's
 * commands, so the menu, the command line and the panels share one implementation. The layer
 * toggles themselves live on the Layers strip under the screen, which has every one of them.
 */
export const nextViewsMenuRenderer: MachineMenuRenderer = () => [
  { id: "show_copper_list", label: t("menu.next.copperList"), click: ideCommand("show-copper") },
  { id: "show_sprite_inspector", label: t("menu.next.spriteInspector"), click: ideCommand("show-sprites") },
  { id: "show_tilemap_inspector", label: t("menu.next.tilemapInspector"), click: ideCommand("show-tilemap") },
  { id: "show_layer2_inspector", label: t("menu.next.layer2Inspector"), click: ideCommand("show-layer2") },
  { id: "next_layers_document", label: t("menu.next.layers"), click: ideCommand("show-layers") }
];

/** Debug › Step Copper on the Next */
export const nextDebugMenuRenderer: MachineMenuRenderer = () => [
  {
    id: "step_copper",
    label: t("menu.next.stepCopper"),
    enabled: mainStore.getState()?.emulatorState?.machineState !== MachineControllerState.Running,
    click: ideCommand("step-copper")
  }
];

function ideCommand(command: string): () => Promise<void> {
  return async () => {
    await getIdeApi().executeCommand(command);
  };
}
