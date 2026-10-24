import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_DOCK, MEDIA_MICRODRIVES, MEDIA_TAPE } from "@common/structs/project-const";
import type { MediaState } from "@common/state/AppState";
import { t } from "@common/i18n/i18n";

/**
 * One card of the ZX Spectrum media strip under the emulator screen.
 */
export type SpectrumMediaCard = {
  /** The medium the card stands for: MEDIA_TAPE, MEDIA_DISK_A/B, MEDIA_DOCK or MEDIA_MICRODRIVE_1/2 */
  mediaId: string;
  /** The card's title, e.g. "Tape" or "Drive A" (translated) */
  title: string;
  /** Disks: the drive letter; Microdrives: the drive number - hardware, never translated */
  driveLetter?: "A" | "B" | "1" | "2";
  /** The file name shown on the card; undefined when nothing is inserted */
  fileName?: string;
  /** The full path, for the tooltip; undefined when nothing is inserted */
  fullPath?: string;
  /** What to show when nothing is inserted */
  emptyText: string;
  /** Disks and Microdrives: whether the medium is write-protected */
  writeProtected?: boolean;
  /** Microdrives only: the drive's motor is running */
  motorOn?: boolean;
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
 * has (the +3E's `diskSupport` config value: 0, 1 or 2), plus the Interface 1's two Microdrives when
 * it is connected, plus the cartridge on a Timex 2068.
 *
 * The media state is written by the main process (`zx-specrum-menus.ts`): the tape is a plain path
 * string ("" once ejected), a disk is `{ diskFile, writeProtected }` (`{}` once ejected).
 */
export function describeSpectrumMedia(
  media: MediaState | undefined,
  diskDrives: number,
  dock = false,
  microdrives?: { motors: number }
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
  // --- The Interface 1's two Microdrives (`.plans/MICRODRIVE_PLAN.md`), as `{ diskFile, writeProtected }`
  if (microdrives) {
    MEDIA_MICRODRIVES.forEach((mediaId, i) => {
      const state = media?.[mediaId];
      const file =
        state && typeof state === "object" && typeof state.diskFile === "string" && state.diskFile
          ? (state.diskFile as string)
          : undefined;
      const drive = i ? "2" : "1";
      cards.push({
        mediaId,
        title: t("emu.media.microdrive.title", { drive }),
        driveLetter: drive,
        fileName: file ? mediaFileName(file) : undefined,
        fullPath: file,
        emptyText: t("emu.media.microdrive.empty"),
        writeProtected: file ? !!state.writeProtected : undefined,
        motorOn: (microdrives.motors & (1 << i)) !== 0
      });
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
