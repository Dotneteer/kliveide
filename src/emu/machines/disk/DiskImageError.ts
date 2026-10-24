/**
 * Why a disk image could not be read or written.
 *
 * The code and its arguments are what a viewer translates (`panels.doc.dsk.error.<code>`); the
 * English message is for logs and for callers that only report the error.
 */
export type DiskImageErrorCode =
  | "notDsk"
  | "badHeader"
  | "badSides"
  | "badTracks"
  | "truncated"
  | "missingTrackInfo"
  | "badTrack"
  | "tooLarge"
  | "noSector";

export class DiskImageError extends Error {
  constructor (
    readonly code: DiskImageErrorCode,
    message: string,
    readonly args: Record<string, string | number> = {}
  ) {
    super(message);
    this.name = "DiskImageError";
  }
}
