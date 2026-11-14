import fs from "fs";

import { DiskFsError } from "@common/diskfs/types";
import type { NextSdCardFileResult } from "@common/zxnext/nextSdCardFile";
import { readHardDiskFile } from "./hard-disk-images";
import { activeSdCardFile, defaultSdCardOf } from "./machine-menus/zx-next-menus";
import { withSdCardAccess } from "./sd-card-access";

/*
 * Reads one file from the SD card the ZX Spectrum Next uses now: the card selected in Machine › SD Card,
 * or the model's own card (`dev/plans/TBBLUE_TBU_VIEWER_PLAN.md`, Phase 5). Under the SD card lock, so
 * it never reads between the emulated machine's sector writes, which go to the file at once.
 */
export async function readNextSdCardFile(name: string): Promise<NextSdCardFileResult> {
  let card = activeSdCardFile();
  if (!card || !fs.existsSync(card)) {
    // --- The model's working copy is made from its base image when the machine first starts on it;
    // --- until then the base image is that very card
    const { workingCopy, baseImage } = defaultSdCardOf();
    if (card === workingCopy && fs.existsSync(baseImage)) {
      card = baseImage;
    } else {
      return { card: card ?? "", error: "noCard" };
    }
  }
  try {
    const contents = await withSdCardAccess(() => readHardDiskFile(card, name));
    return { card, contents };
  } catch (err) {
    if (err instanceof DiskFsError && err.code === "notFound") return { card, error: "notFound" };
    return { card, error: "unreadable", message: err instanceof Error ? err.message : String(err) };
  }
}
