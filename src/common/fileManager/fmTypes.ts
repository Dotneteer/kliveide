import type { DiskFileAttributes, DiskFileKind } from "@common/diskfs/types";

/*
 * The File Manager's drives and listings (.plans/FILE_MANAGER_PLAN.md §5.1). Process-agnostic: the
 * main process builds these, the renderer shows them. Texts are not here - a drive carries its
 * `role` and the renderer words it with `t()` at display time.
 */

/** Where a drive's files come from */
export type FmDriveKind = "host" | "project" | "image" | "hardDisk";

/** What a drive is to the user: picks its icon and how its name is worded */
export type FmDriveRole =
  | "root"
  | "volume"
  | "home"
  | "klive"
  | "kliveProjects"
  | "project"
  | "image"
  | "partition";

/** The drive menu's groups (§4.2) */
export type FmDriveGroup = "computer" | "project" | "images";

/** The columns a listing shows, by its file system (§4.1) */
export type FmColumnSet = "host" | "plus3dos" | "trdos" | "microdrive" | "fat";

/** A drive a pane can show */
export type FmDriveRef = {
  /** Stable for the session: `host:/`, `project:/path`, `image:/path/x.dsk`, `hd:/path/x.img#1` */
  id: string;
  kind: FmDriveKind;
  role: FmDriveRole;
  group: FmDriveGroup;
  /** A proper name (a volume's or a file's name), never a translated word */
  name: string;
  /** The host folder at the drive's top, or the image file */
  root: string;
  /** A hard-disk image's partition */
  partition?: number;
  /** "+3DOS", "TR-DOS", "Microdrive", "FAT16", "FAT32", or empty on the host */
  fileSystem: string;
  readOnly: boolean;
  freeBytes?: number;
  totalBytes?: number;
};

/** What the Spectrum's own catalogue says of a file */
export type FmSpectrumFacts = {
  kind: DiskFileKind;
  start?: number;
  /** BASIC: where the variables start (the program's length) */
  variablesOffset?: number;
  user?: number;
  variableName?: string;
  attributes?: DiskFileAttributes;
};

/** A file or folder in a listing */
export type FmEntry = {
  name: string;
  /** What `fmList` (a folder) or `fmRead` (a file) takes */
  path: string;
  isDirectory: boolean;
  size: number;
  /** Milliseconds since the epoch, when the file system keeps it */
  modified?: number;
  hidden?: boolean;
  /** An image the pane can enter like a folder (§3, D9) */
  imageKind?: FmImageKind;
  spectrum?: FmSpectrumFacts;
};

/** A step of a pane's path */
export type FmCrumb = {
  /** The folder's name; empty for a drive's top (the renderer shows the drive's name there) */
  label: string;
  dir: string;
};

/** A folder of a drive */
export type FmListing = {
  /** The drive, with its free space read again */
  drive: FmDriveRef;
  dir: string;
  /** The folder above, or undefined at the drive's top */
  parentDir?: string;
  crumbs: FmCrumb[];
  columns: FmColumnSet;
  entries: FmEntry[];
};

/** Why a File Manager request failed, as an i18n-able code */
export type FmErrorCode =
  | "notFound"
  | "notAFolder"
  | "accessDenied"
  | "unsupported"
  | "unformatted"
  | "noProject"
  | "exists"
  | "readOnly"
  | "diskFull"
  | "directoryFull"
  | "badName"
  | "sameFolder"
  | "intoItself"
  | "failed";

/** The kinds of image a pane can enter */
export type FmImageKind = "image" | "hardDisk";

const FLOPPY_IMAGE = /\.(dsk|trd|scl|mdr)$/i;
const HARD_DISK_IMAGE = /\.(img|hdf|cim)$/i;

/** Is this file an image the File Manager opens as a drive? */
export function fmImageKindOf (fileName: string): FmImageKind | undefined {
  if (FLOPPY_IMAGE.test(fileName)) return "image";
  if (HARD_DISK_IMAGE.test(fileName)) return "hardDisk";
  return undefined;
}

/** The columns a listing on a file system shows */
export function fmColumnSetOf (fileSystem: string): FmColumnSet {
  if (fileSystem === "+3DOS") return "plus3dos";
  if (fileSystem === "TR-DOS") return "trdos";
  if (fileSystem === "Microdrive") return "microdrive";
  if (/^FAT/.test(fileSystem)) return "fat";
  return "host";
}

/** A request failure carrying its code across the IPC boundary (the message holds it) */
export class FmError extends Error {
  constructor (readonly code: FmErrorCode, message: string, readonly args: Record<string, string | number> = {}) {
    super(`[fm:${code}] ${message}`);
    this.name = "FmError";
  }
}

/** The code an error message carries, when it came from an `FmError` (IPC keeps only the message) */
export function fmErrorCodeOf (error: unknown): FmErrorCode {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = /\[fm:([a-zA-Z]+)\]/.exec(message);
  return (match?.[1] as FmErrorCode) ?? "failed";
}
