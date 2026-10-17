import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_DOCK, MEDIA_TAPE } from "@common/structs/project-const";
import type { MediaState } from "@common/state/AppState";
import { t } from "@common/i18n/i18n";

/**
 * One card of the ZX Spectrum media strip under the emulator screen.
 */
export type SpectrumMediaCard = {
  /** The medium the card stands for: MEDIA_TAPE, MEDIA_DISK_A, MEDIA_DISK_B or MEDIA_DOCK */
  mediaId: string;
  /** The card's title, e.g. "Tape" or "Drive A" (translated) */
  title: string;
  /** Disks only: the drive letter, which is hardware and never translated */
  driveLetter?: "A" | "B";
  /** The file name shown on the card; undefined when nothing is inserted */
  fileName?: string;
  /** The full path, for the tooltip; undefined when nothing is inserted */
  fullPath?: string;
  /** What to show when nothing is inserted */
  emptyText: string;
  /** Disks only: whether the medium is write-protected */
  writeProtected?: boolean;
};

/**
 * The last segment of a path. The renderer has no `path` module, and the main process stores
 * whatever separator its host uses, so both are accepted.
 */
export function mediaFileName(fullPath: string): string {
  const parts = fullPath.split(/[\\/]/);
  return parts[parts.length - 1] || fullPath;
}

/**
 * Describes the media strip's cards (their texts in the current display language; call it at render): always the tape, plus one card per floppy drive the model
 * has (the +3E's `diskSupport` config value: 0, 1 or 2), plus the cartridge on a Timex 2068.
 *
 * The media state is written by the main process (`zx-specrum-menus.ts`): the tape is a plain path
 * string ("" once ejected), a disk is `{ diskFile, writeProtected }` (`{}` once ejected).
 */
export function describeSpectrumMedia(
  media: MediaState | undefined,
  diskDrives: number,
  dock = false
): SpectrumMediaCard[] {
  const cards: SpectrumMediaCard[] = [];
  const tapeFile = media?.[MEDIA_TAPE];
  const tapePath = typeof tapeFile === "string" && tapeFile ? tapeFile : undefined;
  cards.push({
    mediaId: MEDIA_TAPE,
    title: t("emu.media.tape.title"),
    fileName: tapePath ? mediaFileName(tapePath) : undefined,
    fullPath: tapePath,
    emptyText: t("emu.media.tape.empty")
  });

  const drives = Math.max(0, Math.min(2, diskDrives ?? 0));
  for (let i = 0; i < drives; i++) {
    const state = media?.[i ? MEDIA_DISK_B : MEDIA_DISK_A];
    const diskPath =
      state && typeof state === "object" && typeof state.diskFile === "string" && state.diskFile
        ? (state.diskFile as string)
        : undefined;
    const driveLetter = i ? "B" : "A";
    cards.push({
      mediaId: i ? MEDIA_DISK_B : MEDIA_DISK_A,
      title: t("emu.media.drive.title", { drive: driveLetter }),
      driveLetter,
      fileName: diskPath ? mediaFileName(diskPath) : undefined,
      fullPath: diskPath,
      emptyText: t("emu.media.drive.empty"),
      writeProtected: diskPath ? !!state.writeProtected : undefined
    });
  }
  if (dock) {
    const dockFile = media?.[MEDIA_DOCK];
    const dockPath = typeof dockFile === "string" && dockFile ? dockFile : undefined;
    cards.push({
      mediaId: MEDIA_DOCK,
      title: t("emu.media.cartridge.title"),
      fileName: dockPath ? mediaFileName(dockPath) : undefined,
      fullPath: dockPath,
      emptyText: t("emu.media.cartridge.empty")
    });
  }
  return cards;
}
