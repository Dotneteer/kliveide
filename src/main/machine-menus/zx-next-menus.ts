import path from "path";
import fs from "fs";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MachineMenuItem, MachineMenuRenderer } from "@common/machines/info-types";
import { AppState } from "@common/state/AppState";
import { MEDIA_DIVMMC_SD_CARD, MEDIA_SD_CARD, MEDIA_SD_CARD_2, SD_CARD_DIVMMC } from "@common/structs/project-const";
import { mainStore } from "@main/main-store";
import { saveKliveProject } from "@main/projects";
import { app, BrowserWindow, dialog } from "electron";
import { dimMenuAction, setMediaAction } from "@common/state/actions";
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
import { availableCardOf, downloadedCards, workingCopyPath, writeCardFrom } from "@main/next-sd/nextSdCards";
import { offerNextSdCardDownload } from "@main/next-sd/nextModelGate";
import { checkNextSdCard } from "@main/next-sd/checkNextSdCard";
import type { NextSdCardCheck } from "@common/zxnext/nextSdCardCheck";
import { formatMegabytes } from "@common/zxnext/nextSdDownload";
import { t } from "@common/i18n/i18n";
import {
  NEXT_PROFILE_IDS,
  nextProfileOf,
  romSetOf
} from "@emu/machines/zxNext/nextProfiles";
import { getMachineName } from "@common/machines/machine-registry";
import { MI_ZXNEXT } from "@common/machines/constants";

export const SD_CARD_FILE_FOLDER = "sdCardFileFolder";

/**
 * The active Next model's default SD card (`dev/ai/zxnext-models.md` D7): each model has
 * its own working copy in the Klive home folder (`ks2.cim` for KS2 with core 3.02.01, the file every
 * earlier Klive wrote), made from its ROM set's base card (`@main/next-sd/nextSdCards`), so switching
 * models never boots NextZXOS from a card of another release. A user-selected card (`MEDIA_SD_CARD`)
 * still overrides it.
 */
export function defaultSdCardOf(modelId: string | undefined = mainStore.getState().emulatorState?.modelId): {
  /** The working copy's full path */
  workingCopy: string;
} {
  return { workingCopy: workingCopyPath(modelId) };
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
  // --- The cards downloaded for the other models (NEXT_SD_CARDS_PLAN phase 5, D-11): a card the running
  // --- model's set needs stays (Reset makes its working copy from it); the installer's is not listed
  items.push({
    id: "downloaded_sd_cards",
    label: t("menu.next.downloadedCards"),
    type: "submenu",
    submenu: downloadedCardItems(emuWindow, romSetOf(nextProfileOf(appState.emulatorState?.modelId)).id)
  });
  // --- The core update file on the card the Next boots from, in the TBU viewer
  // --- (`dev/plans/TBBLUE_TBU_VIEWER_PLAN.md`, Phase 5); a read, so in any machine state
  items.push({ type: "separator" });
  items.push({
    id: "show_tbu",
    label: t("menu.next.showTbu"),
    click: async () => await showNextSdCardFile(windowInfo.ideWindow ?? emuWindow, "show-tbu", t("menu.next.showTbuFailed"))
  });
  // --- The firmware file beside it (`dev/plans/TBBLUE_FW_VIEWER_PLAN.md`, Phase 3)
  items.push({
    id: "show_fw",
    label: t("menu.next.showFw"),
    click: async () => await showNextSdCardFile(windowInfo.ideWindow ?? emuWindow, "show-fw", t("menu.next.showFwFailed"))
  });
  // --- A board with a second card reader (the KS3): card 1, an empty slot until an image is chosen
  if (nextProfileOf(appState.emulatorState?.modelId).sdReaders === 2) {
    items.push({ type: "separator" });
    items.push({
      id: "select_sd_card_2",
      label: t("menu.next.selectImage2"),
      enabled: isMachineStopped(),
      click: async () => {
        await setSdCard2File(emuWindow);
        await saveKliveProject();
        saveAppSettings();
      }
    });
    items.push({
      id: "eject_sd_card_2",
      label: t("menu.next.ejectImage2"),
      enabled: isMachineStopped() && !!activeSdCard2File(),
      click: async () => {
        await withSdCardAccess(() => closeSdCard2());
        mainStore.dispatch(setMediaAction(MEDIA_SD_CARD_2, undefined));
        await logEmuEvent("ZX Spectrum Next SD card 2: empty");
        await saveKliveProject();
      }
    });
  }
  return items;
};

/** Machine › SD Card › Select Image for SD Card 2: the second reader's image (card 1) */
async function setSdCard2File(browserWindow: BrowserWindow): Promise<void> {
  const lastFile = activeSdCard2File();
  const defaultPath =
    appSettings?.folders?.[SD_CARD_FILE_FOLDER] || (lastFile ? path.dirname(lastFile) : app.getPath("home"));
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    title: t("messages.sdCard.select2"),
    defaultPath,
    filters: [
      { name: t("common.filter.cimImages"), extensions: ["cim"] },
      { name: t("common.filter.allFiles"), extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;
  const filename = dialogResult.filePaths[0];
  await withSdCardAccess(() => closeSdCard2());
  mainStore.dispatch(setMediaAction(MEDIA_SD_CARD_2, filename));
  await logEmuEvent(`ZX Spectrum Next SD card 2 image: ${filename}`);
  appSettings.folders ??= {};
  appSettings.folders[SD_CARD_FILE_FOLDER] = path.dirname(filename);
  await ensureSdCardBackupIfEnabled(filename);
}

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

/**
 * Makes the model's default SD card working copy from its ROM set's base card on first use.
 * @returns Whether the working copy is there now. It is not when the base card is not on this machine
 * (this Klive ships only the default model's card, `dev/plans/NEXT_SD_CARDS_PLAN.md`) or is not the
 * manifest's card.
 */
export async function initializeZxSpectrumNext(modelId?: string): Promise<boolean> {
  const sdCardPath = workingCopyPath(modelId);
  if (isExistingFile(sdCardPath)) return true;

  const baseCard = availableCardOf(modelId);
  if (!baseCard) return false;
  try {
    // --- Written under a temporary name and checked, so a copy cut short never passes for a card
    await writeCardFrom(baseCard, sdCardPath);
  } catch (err) {
    await logEmuEvent(`The SD card could not be made from ${baseCard.file}: ${errorMessage(err)}`, "bright-red");
    return false;
  }
  // --- Create initial backup after copying
  await ensureSdCardBackupIfEnabled(sdCardPath);
  return true;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Prepares the SD card of the Next model the emulator switches to (the machine's `setup`).
 * A model whose card is not on this computer goes through the gate (NEXT_SD_CARDS_PLAN phase 5): the
 * download dialog. Declining it declines the machine change.
 * @returns false when the model cannot run (its card is not here and the user did not get it)
 */
export async function setupZxSpectrumNext(modelId?: string): Promise<false | void> {
  const targetModel = modelId ?? mainStore.getState().emulatorState?.modelId;
  // --- The model being switched to has its own default card (D7): make its working copy on first use
  let hasDefaultCard = await initializeZxSpectrumNext(targetModel);
  // --- Check, if the SD Card is set at all. Another model's default card counts as no choice:
  // --- switching models switches default cards
  const appState = mainStore.getState();
  const selected = appState.media?.[MEDIA_SD_CARD];
  let sdCardFile = isAnotherModelsDefaultSdCard(selected, targetModel) ? undefined : selected;
  if (sdCardFile && path.resolve(sdCardFile) === path.resolve(defaultSdCardOf(targetModel).workingCopy)) {
    // --- The model's own default card is no choice either: it is what the default branch sets
    sdCardFile = undefined;
  } else if (sdCardFile && !isExistingFile(sdCardFile)) {
    // --- A card chosen earlier and moved or deleted since: the model's own card instead of no card
    await logEmuEvent(`ZX Spectrum Next SD card image not found: ${sdCardFile}; using the default card`, "yellow");
    sdCardFile = undefined;
  }
  if (!sdCardFile && !hasDefaultCard) {
    const model = getMachineName(MI_ZXNEXT, nextProfileOf(targetModel).id);
    await logEmuEvent(
      `The SD card of the ${model} is not on this computer (no ${romSetOf(nextProfileOf(targetModel)).id} base card)`,
      "bright-red"
    );
    if (!(await offerNextSdCardDownload(targetModel))) return false;
    hasDefaultCard = await initializeZxSpectrumNext(targetModel);
    if (!hasDefaultCard) return false;
  }
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
  // --- The card the Next boots from must be one NextZXOS can boot (D-8): say what is wrong, offer a way out
  return await checkBootCard(targetModel);
}

/**
 * Checks the card the Next is about to boot from (NEXT_SD_CARDS_PLAN phase 5, D-8). A card NextZXOS
 * cannot boot opens one dialog that says why and offers what fits: the model's own card back (a broken
 * working copy is renamed aside first, D-9), another image, or going on anyway.
 * @returns false when the user wanted the model's card back and it could not be had
 */
async function checkBootCard(modelId: string | undefined): Promise<false | void> {
  const card = mainStore.getState().media?.[MEDIA_SD_CARD];
  if (!card) return;
  const result = await withSdCardAccess(() => checkNextSdCard(card, modelId));
  if (result.status === "ok") return;

  const model = getMachineName(MI_ZXNEXT, nextProfileOf(modelId).id);
  const ownCard = workingCopyPath(modelId);
  const isOwnCard = path.resolve(card) === path.resolve(ownCard);
  await logEmuEvent(`The SD card ${card} may not boot: ${checkSummary(result)}`, "bright-red");
  const buttons = [
    isOwnCard ? t("messages.sdCard.check.reset") : t("messages.sdCard.check.useDefault"),
    t("messages.sdCard.check.select"),
    t("messages.sdCard.check.continue")
  ];
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  mainStore.dispatch(dimMenuAction(true));
  let response: number;
  try {
    const options = {
      type: "warning" as const,
      title: t("messages.sdCard.check.title"),
      message: t("messages.sdCard.check.message", { model }),
      detail: checkDetail(result, model),
      buttons,
      defaultId: 0,
      cancelId: buttons.length - 1
    };
    response = (window ? await dialog.showMessageBox(window, options) : await dialog.showMessageBox(options)).response;
  } finally {
    mainStore.dispatch(dimMenuAction(false));
  }

  if (response === 0) {
    if (isOwnCard && isExistingFile(ownCard)) {
      // --- D-9: never lose a card silently. The broken one is kept under another name.
      const aside = brokenCardName(ownCard, new Date());
      fs.renameSync(ownCard, aside);
      await logEmuEvent(`The previous SD card was kept as ${aside}`, "yellow");
      if (!(await initializeZxSpectrumNext(modelId)) && !(await downloadAndInitialize(modelId))) {
        fs.renameSync(aside, ownCard);
        await logEmuEvent(`The SD card was not replaced: its base card is not on this computer`, "bright-red");
        return false;
      }
    } else if (!(await initializeZxSpectrumNext(modelId)) && !(await downloadAndInitialize(modelId))) {
      return false;
    }
    mainStore.dispatch(setMediaAction(MEDIA_SD_CARD, ownCard));
    await logSdCardEvent(ownCard);
    return;
  }
  if (response === 1 && window) {
    const picked = await pickSdCardImage(window, mainStore.getState());
    if (picked) {
      mainStore.dispatch(setMediaAction(MEDIA_SD_CARD, picked));
      await logSdCardEvent(picked);
    }
  }
}

async function downloadAndInitialize(modelId: string | undefined): Promise<boolean> {
  return (await offerNextSdCardDownload(modelId)) && (await initializeZxSpectrumNext(modelId));
}

/** `ks3-30303.cim` -> `ks3-30303.broken-20261117-153000.cim` (D-9) */
export function brokenCardName(file: string, when: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${when.getFullYear()}${pad(when.getMonth() + 1)}${pad(when.getDate())}-` +
    `${pad(when.getHours())}${pad(when.getMinutes())}${pad(when.getSeconds())}`;
  const ext = path.extname(file);
  return path.join(path.dirname(file), `${path.basename(file, ext)}.broken-${stamp}${ext}`);
}

/** One line for the Emulator pane (English, like every log line) */
function checkSummary(result: NextSdCardCheck): string {
  switch (result.status) {
    case "ok":
      return "ok";
    case "missing":
      return "the file does not exist";
    case "unreadable":
      return `it cannot be read (${result.message})`;
    case "noPartition":
      return `no partition NextZXOS can mount (${result.message})`;
    case "noSystemFiles":
      return `NextZXOS's system files are missing (${result.missing.join(", ")})`;
    case "wrongRelease":
      return `it holds NextZXOS ${result.found ?? "of another release"}, not ${result.expected}`;
  }
}

/** The dialog's explanation of a failed check */
function checkDetail(result: NextSdCardCheck, model: string): string {
  switch (result.status) {
    case "ok":
      return "";
    case "missing":
      return t("messages.sdCard.check.missing", { file: result.file });
    case "unreadable":
      return t("messages.sdCard.check.unreadable", { file: result.file });
    case "noPartition":
      return t("messages.sdCard.check.noPartition", { file: result.file });
    case "noSystemFiles":
      return t("messages.sdCard.check.noSystemFiles", { file: result.file, files: result.missing.join(", ") });
    case "wrongRelease":
      return t("messages.sdCard.check.wrongRelease", { file: result.file, model });
  }
}

/** One item per downloaded base card: its name and size, and Delete */
function downloadedCardItems(window: BrowserWindow, inUse: string): MachineMenuItem[] {
  const cards = downloadedCards();
  if (!cards.length) return [{ id: "downloaded_sd_cards_none", label: t("menu.next.noDownloadedCards"), enabled: false }];
  return cards.map((card) => ({
    id: `delete_sd_card_${card.setId}`,
    label: t("menu.next.deleteDownloadedCard", { card: card.setId, size: formatMegabytes(card.bytes) }),
    enabled: card.setId !== inUse,
    click: async () => {
      const result = await dialog.showMessageBox(window, {
        type: "question",
        buttons: [t("common.button.yes"), t("common.button.no")],
        defaultId: 1,
        cancelId: 1,
        title: t("menu.next.downloadedCards"),
        message: t("messages.sdCard.deleteDownloaded", { card: card.setId })
      });
      if (result.response !== 0) return;
      fs.rmSync(card.file, { force: true });
      await logEmuEvent(`Deleted the downloaded SD card ${card.file}`);
    }
  }));
}

function isExistingFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function getDefaultSdCardFile(): string {
  return getDefaultSdCardPath();
}

async function logSdCardEvent(filename: string): Promise<void> {
  await logEmuEvent(`ZX Spectrum Next SD card image: ${filename}`);
}

async function resetToDefaultSdCardFile(): Promise<void> {
  const { workingCopy: sdCardPath } = defaultSdCardOf();
  const modelId = mainStore.getState().emulatorState?.modelId;

  // --- Without the base card there is nothing to reset to (D-7: a working copy runs without one,
  // --- only Reset needs it): offer the download. Declined, the working copy stays as it is.
  if (!availableCardOf(modelId) && !(await offerNextSdCardDownload(modelId))) {
    await logEmuEvent(`The SD card was not reset: its base card is not on this computer`, "bright-red");
    return;
  }
  const baseCard = availableCardOf(modelId);

  // --- Rewriting the image must not overlap with emulated sector I/O or a file copy, all of
  // --- which work on the very same file.
  const failure = await withSdCardAccess(async () => {
    // --- Release the cached handler before touching the file. It holds an open descriptor on the
    // --- image: on Windows that descriptor makes replacing the file fail outright, and everywhere
    // --- else the cache would happily keep serving a handler bound to the replaced file (the
    // --- cache is only invalidated when the *file name* changes, and it does not change here).
    invalidateSdCardHandler();

    // --- The fresh card replaces the working copy only once it is complete and checked: a failed
    // --- reset leaves the user's card as it was
    try {
      await writeCardFrom(baseCard, sdCardPath);
    } catch (err) {
      return errorMessage(err);
    }

    // --- Create backup of reset file
    await ensureSdCardBackupIfEnabled(sdCardPath);

    // --- Make the file writeable
    const cimHandler = getSdCardHandler();
    cimHandler.setReadOnly(false);
    return undefined;
  });
  if (failure) {
    await logEmuEvent(`The SD card could not be reset from ${baseCard.file}: ${failure}`, "bright-red");
    return;
  }

  mainStore.dispatch(setMediaAction(MEDIA_SD_CARD, undefined));
  await saveKliveProject();
  saveAppSettings();
  await logEmuEvent(`Default SD card image is reset to its original state`);
  await logSdCardEvent(getDefaultSdCardFile());
}

/**
 * The media slot of the current machine's SD card: the Next's, or the DivMMC's on any other machine
 * (`dev/plans/NEXT_SD_CARDS_PLAN.md` D-10)
 */
export function activeSdCardSlot(): typeof MEDIA_SD_CARD | typeof MEDIA_DIVMMC_SD_CARD {
  return mainStore.getState().emulatorState?.machineId === MI_ZXNEXT ? MEDIA_SD_CARD : MEDIA_DIVMMC_SD_CARD;
}

/**
 * The SD card image file the machine uses now: on a Next the card selected in its slot or the model's
 * own working copy; on a DivMMC machine the card in the DivMMC's slot, or undefined for an empty slot
 */
export function activeSdCardFile(): string | undefined {
  return activeSdCardSlot() === MEDIA_SD_CARD ? nextSdCardFile() : divMmcSdCardFile();
}

/** The Next's SD card (card 0): the image selected in its slot, or the model's own working copy */
export function nextSdCardFile(): string {
  return mainStore.getState().media?.[MEDIA_SD_CARD] ?? getDefaultSdCardFile();
}

/** The DivMMC's SD card, or undefined for an empty slot */
export function divMmcSdCardFile(): string | undefined {
  return mainStore.getState().media?.[MEDIA_DIVMMC_SD_CARD] || undefined;
}

/** The second SD card's image (card 1, a KS3's second reader), or undefined for an empty slot */
export function activeSdCard2File(): string | undefined {
  return mainStore.getState().media?.[MEDIA_SD_CARD_2] || undefined;
}

let cimHandler: CimHandler;
let currentSdCardFile: string;

// --- Use this function to get the CIM handler
export function getSdCardHandler(sdCardFile: string = nextSdCardFile()): CimHandler {

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
  closeSdCard2();
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
 * An SD card as sectors (dev/plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md C5): a `.cim` through its
 * handler, a raw `.img` or an `.hdf` (the DivMMC's cards are often those) as a block device over the file.
 * @param card 0 and 1: a Next's cards; `SD_CARD_DIVMMC`: the DivMMC's (`dev/plans/NEXT_SD_CARDS_PLAN.md` D-10)
 */
export function getSdCardDevice(card = 0): SdCardDevice {
  if (card === 1) return getSdCard2Device();
  const sdCardFile = card === SD_CARD_DIVMMC ? divMmcSdCardFile() : nextSdCardFile();
  // --- A DivMMC with no card: an empty slot, which the core treats as no card
  if (!sdCardFile) return emptySdCardDevice("No SD card image in the DivMMC");
  if (sdCardFile.toLowerCase().endsWith(".cim")) {
    const handler = getSdCardHandler(sdCardFile);
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

/** A slot with no card: 0 sectors, which the core treats as no card (`zx-spectrum-sd.c`) */
function emptySdCardDevice(writeError: string): SdCardDevice {
  return {
    totalSectors: 0,
    readSector: () => new Uint8Array(512),
    writeSector: () => {
      throw new Error(writeError);
    }
  };
}

/* The second card's open image: a `.cim` through its handler, anything else as a block device */
let sdCard2:
  | { file: string; cim?: CimHandler; raw?: BlockDevice & { close(): void } }
  | undefined;

function closeSdCard2(): void {
  sdCard2?.cim?.close();
  sdCard2?.raw?.close();
  sdCard2 = undefined;
}

/**
 * The second SD card (card 1) as sectors: the image in `MEDIA_SD_CARD_2`, or an empty slot of 0
 * sectors, which the core treats as no card (`zx-spectrum-sd.c`, `zxSdCardPresent`).
 */
function getSdCard2Device(): SdCardDevice {
  const file = activeSdCard2File();
  if (!file) {
    closeSdCard2();
    return emptySdCardDevice("No card in the second SD card reader");
  }
  if (sdCard2 && sdCard2.file !== file) closeSdCard2();
  if (!sdCard2) {
    sdCard2 = file.toLowerCase().endsWith(".cim") ? { file, cim: new CimHandler(file) } : { file, raw: openHardDiskImage(file) };
  }
  const { cim, raw } = sdCard2;
  if (cim) {
    return {
      totalSectors: (cim.cimInfo.maxSize * 2048) / cim.cimInfo.sectorSize,
      readSector: (sector) => cim.readSector(sector),
      writeSector: (sector, data) => cim.writeSector(sector, data)
    };
  }
  const device = raw!;
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
  const picked = await pickSdCardImage(browserWindow, state);
  if (picked) await setSelectedSdCardFile(picked);
}

/** Asks for an SD card image for the Next; undefined when the user closed the picker */
async function pickSdCardImage(browserWindow: BrowserWindow, state: AppState): Promise<string | undefined> {
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
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return undefined;
  return dialogResult.filePaths[0];
}

/**
 * Puts an image into an SD card slot: the Next's (`MEDIA_SD_CARD`) or the DivMMC's
 * (`MEDIA_DIVMMC_SD_CARD`), and remembers its folder for the next selection
 */
export async function setSelectedSdCardFile(
  filename: string,
  slot: typeof MEDIA_SD_CARD | typeof MEDIA_DIVMMC_SD_CARD = MEDIA_SD_CARD
): Promise<void> {
  const sdCardFolder = path.dirname(filename);

  mainStore.dispatch(setMediaAction(slot, filename));
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
 * View › Machine Views on the Next: the Copper List document (`dev/plans/COPPER_DEBUGGING_PLAN.md`
 * §4.5), the Sprite Inspector (`dev/plans/SPRITE_INSPECTOR_PLAN.md` §4.4), the Tilemap Inspector
 * (`dev/plans/TILEMAP_INSPECTOR_PLAN.md` §4.4), the Layer 2 Inspector (`dev/plans/LAYER2_INSPECTOR_PLAN.md`
 * §4.4) and the Layers document (`dev/plans/LAYER_COMPOSITION_PLAN.md`). All go through the IDE's
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

/**
 * Machine › SD Card › Show TBBLUE.TBU / Show TBBLUE.FW: the document opens in the IDE, so the IDE window
 * comes up first; a card without the file (or no card) is said in a message box, not only in the Build
 * pane.
 */
async function showNextSdCardFile(window: BrowserWindow, command: string, failedTitle: string): Promise<void> {
  // --- Loaded at the click: the app's entry module must not load with the menus (tests build them)
  const { showIdeWindow } = await import("../index");
  showIdeWindow();
  const result = await getIdeApi().executeCommand(command);
  if (result?.success) return;
  // --- As every menu-started message box: the menu stays dimmed while it is up
  mainStore.dispatch(dimMenuAction(true));
  try {
    await dialog.showMessageBox(window, {
      type: "error",
      title: failedTitle,
      message: result?.finalMessage ?? t("messages.command.failed")
    });
  } finally {
    mainStore.dispatch(dimMenuAction(false));
  }
}

function ideCommand(command: string): () => Promise<void> {
  return async () => {
    await getIdeApi().executeCommand(command);
  };
}
