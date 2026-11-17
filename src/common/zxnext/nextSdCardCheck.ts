import type { NextRomSetId } from "./romSets";

/*
 * The result of checking a ZX Spectrum Next SD card (`dev/plans/NEXT_SD_CARDS_PLAN.md` D-8): whether
 * NextZXOS can boot the card a model would use, and when it cannot, why. The main process makes it
 * (`src/main/next-sd/checkNextSdCard.ts`); the dialogs that offer a way out read it.
 *
 * Neutral: no Node or Electron imports.
 */

/** The files NextZXOS needs on the card before it can start */
export const NEXT_SD_SYSTEM_FILES = ["machines/next/enAltZX.rom", "nextzxos/enSystem.sys"] as const;

export type NextSdCardCheck =
  /** NextZXOS can boot it: the card has the system files of the model's NextZXOS release */
  | { status: "ok"; file: string }
  /** No file at that path (or it is not a regular file) */
  | { status: "missing"; file: string }
  /** The file cannot be read as a card image: a broken `.cim` header, a copy cut short, an I/O error */
  | { status: "unreadable"; file: string; message: string }
  /** No FAT16/FAT32 volume NextZXOS could mount ("Drive C: not found" at boot) */
  | { status: "noPartition"; file: string; message: string }
  /** A mountable volume without NextZXOS's system files */
  | { status: "noSystemFiles"; file: string; missing: string[] }
  /**
   * NextZXOS of another release: the card's `enAltZX.rom` is not the model's ROM set's, so the boot
   * stops on `c:/machines/next/enAltZX.rom`. `found` is the set the card belongs to, when Klive knows it.
   */
  | { status: "wrongRelease"; file: string; expected: NextRomSetId; found?: NextRomSetId };

export type NextSdCardCheckStatus = NextSdCardCheck["status"];
