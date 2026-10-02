import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_TAPE } from "@common/structs/project-const";
import type { MediaState } from "@common/state/AppState";

/**
 * One card of the ZX Spectrum media strip under the emulator screen.
 */
export type SpectrumMediaCard = {
  /** The medium the card stands for: MEDIA_TAPE, MEDIA_DISK_A or MEDIA_DISK_B */
  mediaId: string;
  /** The card's title, e.g. "Tape" or "Drive A" */
  title: string;
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
 * Describes the media strip's cards: always the tape, plus one card per floppy drive the model
 * has (the +3E's `diskSupport` config value: 0, 1 or 2).
 *
 * The media state is written by the main process (`zx-specrum-menus.ts`): the tape is a plain path
 * string ("" once ejected), a disk is `{ diskFile, writeProtected }` (`{}` once ejected).
 */
export function describeSpectrumMedia(
  media: MediaState | undefined,
  diskDrives: number
): SpectrumMediaCard[] {
  const cards: SpectrumMediaCard[] = [];
  const tapeFile = media?.[MEDIA_TAPE];
  const tapePath = typeof tapeFile === "string" && tapeFile ? tapeFile : undefined;
  cards.push({
    mediaId: MEDIA_TAPE,
    title: "Tape",
    fileName: tapePath ? mediaFileName(tapePath) : undefined,
    fullPath: tapePath,
    emptyText: "(no tape)"
  });

  const drives = Math.max(0, Math.min(2, diskDrives ?? 0));
  for (let i = 0; i < drives; i++) {
    const state = media?.[i ? MEDIA_DISK_B : MEDIA_DISK_A];
    const diskPath =
      state && typeof state === "object" && typeof state.diskFile === "string" && state.diskFile
        ? (state.diskFile as string)
        : undefined;
    cards.push({
      mediaId: i ? MEDIA_DISK_B : MEDIA_DISK_A,
      title: `Drive ${i ? "B" : "A"}`,
      fileName: diskPath ? mediaFileName(diskPath) : undefined,
      fullPath: diskPath,
      emptyText: "(no disk)",
      writeProtected: diskPath ? !!state.writeProtected : undefined
    });
  }
  return cards;
}
