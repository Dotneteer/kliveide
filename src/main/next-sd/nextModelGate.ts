import { app } from "electron";

import { NEXT_SD_DOWNLOAD_DIALOG } from "@common/messaging/dialog-ids";
import { getEmuApi } from "@common/messaging/MainToEmuMessenger";
import { MI_ZXNEXT } from "@common/machines/constants";
import { getMachineName } from "@common/machines/machine-registry";
import type { NextSdDownloadDialogData, NextSdDownloadDialogResult } from "@common/zxnext/nextSdDownload";
import { NEXT_ROM_SETS } from "@common/zxnext/romSets";
import { favoriteKey } from "@common/machines/machine-favorites";
import { NEXT_PROFILE_IDS, nextProfileOf, romSetOf } from "@emu/machines/zxNext/nextProfiles";
import { nextSdCardUrl, nextSdCardsBaseUrl } from "./downloadNextSdCard";
import { availableCardOf, needsDownload } from "./nextSdCards";

/*
 * The gate in front of a ZX Spectrum Next model whose SD card is not on this computer
 * (`dev/plans/NEXT_SD_CARDS_PLAN.md`, phase 5, D-7): the download dialog, in the emulator window.
 */

/** What the download dialog shows for a model */
export function nextSdDownloadDialogData(modelId: string | undefined): NextSdDownloadDialogData {
  const profile = nextProfileOf(modelId);
  const setId = romSetOf(profile).id;
  const { gzSize, size } = NEXT_ROM_SETS[setId].sdBaseImage;
  return {
    modelId: profile.id,
    modelName: getMachineName(MI_ZXNEXT, profile.id),
    setId,
    gzSize,
    size,
    url: nextSdCardUrl(setId, nextSdCardsBaseUrl(app.isPackaged))
  };
}

/**
 * Offers to download (or import) a model's base card. Resolves to true when the card is on this
 * computer afterwards, false when the user declined or the dialog could not be shown.
 */
export async function offerNextSdCardDownload(modelId: string | undefined): Promise<boolean> {
  if (availableCardOf(modelId)) return true;
  let result: NextSdDownloadDialogResult | undefined;
  try {
    result = (await getEmuApi().displayDialog(
      NEXT_SD_DOWNLOAD_DIALOG,
      nextSdDownloadDialogData(modelId)
    )) as NextSdDownloadDialogResult | undefined;
  } catch (err) {
    console.error("Could not show the SD card download dialog", err);
    return false;
  }
  return result === "ready" && availableCardOf(modelId) !== undefined;
}

/**
 * The Next models whose card must be downloaded before they run, for the model lists (phase 5): their
 * `favoriteKey` and the download's size in bytes
 */
export function nextModelsNeedingDownload(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const modelId of NEXT_PROFILE_IDS) {
    if (!needsDownload(modelId)) continue;
    const setId = romSetOf(nextProfileOf(modelId)).id;
    result[favoriteKey({ machineId: MI_ZXNEXT, modelId })] = NEXT_ROM_SETS[setId].sdBaseImage.gzSize;
  }
  return result;
}
