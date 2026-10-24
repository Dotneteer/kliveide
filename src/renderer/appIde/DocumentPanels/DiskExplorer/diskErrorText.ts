import type { MessageKey } from "@common/i18n/keys.generated";
import type { useT } from "@common/i18n/useT";
import { DiskImageError, type DiskImageErrorCode } from "@emu/machines/disk/DiskImageError";
import type { DiskActionFailure } from "./diskExplorerActions";

/** The viewer's message for each reason a disk image cannot be read */
const READ_ERROR_KEYS: Partial<Record<DiskImageErrorCode, MessageKey>> = {
  notDsk: "panels.doc.dsk.error.notDsk",
  badHeader: "panels.doc.dsk.error.badHeader",
  badSides: "panels.doc.dsk.error.badSides",
  badTracks: "panels.doc.dsk.error.badTracks",
  truncated: "panels.doc.dsk.error.truncated",
  missingTrackInfo: "panels.doc.dsk.error.missingTrackInfo",
  badTrack: "panels.doc.dsk.error.badTrack"
};

/** Why an edit or a file system failed, by `DiskFsError` code */
const FS_ERROR_KEYS: Record<string, MessageKey> = {
  unformatted: "panels.diskExplorer.error.unformatted",
  notFound: "panels.diskExplorer.error.notFound",
  exists: "panels.diskExplorer.error.exists",
  badName: "panels.diskExplorer.error.badName",
  diskFull: "panels.diskExplorer.error.diskFull",
  directoryFull: "panels.diskExplorer.error.directoryFull",
  readOnly: "panels.diskExplorer.error.readOnly",
  unsupported: "panels.diskExplorer.error.unsupported",
  io: "panels.diskExplorer.error.io"
};

/** The text explaining why the disk image could not be read */
export function readErrorText (error: unknown, t: ReturnType<typeof useT>): string {
  const key = error instanceof DiskImageError ? READ_ERROR_KEYS[error.code] : undefined;
  return key ? t(key, error instanceof DiskImageError ? error.args : undefined) : t("panels.doc.dsk.unreadable");
}

/** The text of an action's (or the file system's) failure */
export function failureText (failure: DiskActionFailure, t: ReturnType<typeof useT>): string {
  return t(FS_ERROR_KEYS[failure.code] ?? "panels.diskExplorer.error.io", { name: "", message: "", ...failure.args });
}
