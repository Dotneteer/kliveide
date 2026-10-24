/*
 * The file-system layer over disk images (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, D1/B0).
 *
 * React-free and process-agnostic: the Disk Explorer, the `disk` IDE commands, the CLI and the
 * compilers' disk export all work through `DiskFileSystem`. A file system holds the image in memory;
 * every change is made to that copy, and `image()` gives the bytes to write back.
 */

/** What a file holds, as its header says (or `raw` without one) */
export type DiskFileKind = "basic" | "numberArray" | "charArray" | "code" | "raw";

/** A file's attributes (+3DOS keeps all three; TR-DOS has none) */
export type DiskFileAttributes = {
  readOnly: boolean;
  system: boolean;
  archive: boolean;
};

/** Where a part of a file (or of the file system) sits on the disk */
export type DiskSectorRef = {
  /** The track's index in the image (cylinder * sides + side) */
  trackIndex: number;
  /** The sector's index within that track's sector list */
  sectorIndex: number;
};

/** A file on the disk */
export type DiskFileEntry = {
  /** As the disk's own catalogue shows it: `NAME.EXT` (+3DOS), `NAME<type>` (TR-DOS) */
  name: string;
  /** The name part, without padding */
  baseName: string;
  /** The extension (+3DOS) or the type letter (TR-DOS) */
  extension: string;
  /** +3DOS user area 0..15 */
  user?: number;
  kind: DiskFileKind;
  /** Bytes of the file's contents (its header excluded) */
  size: number;
  /** Bytes the file takes on the disk */
  allocated: number;
  /** BASIC: the auto-run line (undefined: none); CODE: the load address */
  start?: number;
  /** BASIC: the offset of the variables (the program's length) */
  variablesOffset?: number;
  /** Arrays: the variable's letter */
  variableName?: string;
  attributes: DiskFileAttributes;
  /** A deleted entry the disk still lists */
  deleted: boolean;
  /** The sectors the file's bytes occupy, in file order (empty on a hard disk: see `FatFileSystem`) */
  sectors: DiskSectorRef[];
  /** A folder (FAT) */
  isDirectory?: boolean;
  /** Hidden (FAT) */
  hidden?: boolean;
};

/** A new file to put on the disk */
export type NewDiskFile = {
  /** `NAME.EXT` (+3DOS) or `NAME.T` / `NAME` (TR-DOS, the type from `kind`) */
  name: string;
  kind: DiskFileKind;
  data: Uint8Array;
  /** BASIC: the auto-run line; CODE: the load address */
  start?: number;
  /** BASIC: the program's length within `data` (the variables follow) */
  variablesOffset?: number;
  /** Arrays: the variable's letter */
  variableName?: string;
  user?: number;
};

/** The file system as a whole */
export type DiskFsInfo = {
  /** "+3DOS" or "TR-DOS" */
  system: string;
  /** The format, e.g. "+3 (173K)", "CPC data", "PCW/+3 double-sided" */
  format: string;
  label?: string;
  totalBytes: number;
  freeBytes: number;
  /** The allocation unit */
  blockSize: number;
  directoryEntries: number;
  usedEntries: number;
};

/** What a sector of the disk is used for (the Layout view) */
export type DiskSectorRole =
  | { role: "system" }
  | { role: "directory" }
  | { role: "free" }
  | { role: "file"; file: string }
  | { role: "unused" };

/** Why a file-system operation failed */
export type DiskFsErrorCode =
  | "unformatted"
  | "notFound"
  | "exists"
  | "badName"
  | "diskFull"
  | "directoryFull"
  | "readOnly"
  | "unsupported";

export class DiskFsError extends Error {
  constructor (
    readonly code: DiskFsErrorCode,
    message: string,
    readonly args: Record<string, string | number> = {}
  ) {
    super(message);
    this.name = "DiskFsError";
  }
}

export interface DiskFileSystem {
  readonly system: "+3dos" | "trdos" | "fat";
  info(): DiskFsInfo;
  /** The files, in catalogue order; deleted ones too when asked; on FAT, those of a folder */
  list(options?: { deleted?: boolean; dir?: string }): DiskFileEntry[];
  /** A file's contents, its header excluded */
  read(name: string): Uint8Array;
  write(file: NewDiskFile): DiskFileEntry;
  delete(name: string): void;
  rename(name: string, newName: string): void;
  setAttributes(name: string, attributes: Partial<DiskFileAttributes>): void;
  /** Every sector's role, keyed `trackIndex * 256 + sectorIndex` */
  layout(): Map<number, DiskSectorRole>;
  /** The image's bytes, with every change made so far */
  image(): Uint8Array;
}
