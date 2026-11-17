import { app, BrowserWindow, dialog, net } from "electron";

import { t } from "@common/i18n/i18n";
import type { NextSdDownloadStatus, NextSdImportResult } from "@common/zxnext/nextSdDownload";
import { NEXT_ROM_SETS, type NextRomSetId } from "@common/zxnext/romSets";
import { downloadNextSdCard, importNextSdCard, nextSdCardFailureOf, nextSdCardsBaseUrl } from "./downloadNextSdCard";
import { NextSdDownloads } from "./nextSdDownloads";

/*
 * The Electron side of the Next SD card download dialog (`dev/plans/NEXT_SD_CARDS_PLAN.md`, phase 4):
 * downloads go through Electron's `net`, which uses the system's proxy settings, from the one fixed
 * host (D-5); an import asks for the file with the system's open dialog. The renderer reaches these
 * through `MainApi`.
 */

const downloads = new NextSdDownloads((setId, { onProgress, signal }) =>
  downloadNextSdCard(setId, {
    fetch: (url, init) => net.fetch(url, init),
    baseUrl: nextSdCardsBaseUrl(app.isPackaged),
    onProgress,
    signal
  })
);

/** Checks a set id that came from a renderer */
function knownSet(setId: string): NextRomSetId {
  if (!Object.prototype.hasOwnProperty.call(NEXT_ROM_SETS, setId) || !NEXT_ROM_SETS[setId as NextRomSetId].sdBaseImage) {
    throw new Error(`Unknown ZX Spectrum Next ROM set: ${setId}`);
  }
  return setId as NextRomSetId;
}

export function startNextSdCardDownload(setId: string): void {
  void downloads.start(knownSet(setId));
}

export function nextSdCardDownloadStatus(setId: string): NextSdDownloadStatus {
  return downloads.status(knownSet(setId));
}

export function cancelNextSdCardDownload(setId: string): void {
  downloads.cancel(knownSet(setId));
}

/** Asks for a `.cim.gz` or `.cim` the user downloaded elsewhere and imports it */
export async function importNextSdCardFile(window: BrowserWindow | undefined, setId: string): Promise<NextSdImportResult> {
  const set = knownSet(setId);
  const options: Electron.OpenDialogOptions = {
    title: t("dialog.nextSdDownload.importTitle"),
    properties: ["openFile"],
    filters: [
      { name: t("dialog.nextSdDownload.importFilter"), extensions: ["gz", "cim"] },
      { name: t("common.filter.allFiles"), extensions: ["*"] }
    ]
  };
  const picked = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
  if (picked.canceled || picked.filePaths.length < 1) return { kind: "cancelled" };
  try {
    await importNextSdCard(set, picked.filePaths[0]);
    return { kind: "imported" };
  } catch (err) {
    return { kind: "failed", error: nextSdCardFailureOf(err) };
  }
}
