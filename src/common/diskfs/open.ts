import { isDskImage } from "@emu/machines/disk/disk-changes";
import { MicrodriveFileSystem } from "./mdrfs";
import { Plus3DosFileSystem } from "./plus3dos";
import { TrdosFileSystem } from "./trdos";
import { DiskFsError, type DiskFileSystem } from "./types";

/** The kinds of disk image the file-system layer opens */
export type DiskImageKind = "dsk" | "trd" | "scl" | "mdr";

/** The image kind a file's name (or, failing that, its bytes) says */
export function diskImageKind (fileName: string, bytes?: Uint8Array): DiskImageKind {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".scl")) return "scl";
  if (lower.endsWith(".trd")) return "trd";
  if (lower.endsWith(".dsk")) return "dsk";
  if (lower.endsWith(".mdr")) return "mdr";
  return bytes && isDskImage(bytes) ? "dsk" : "trd";
}

/** Opens the file system of a disk image: +3DOS on a `.dsk`, TR-DOS on a `.trd` or `.scl`, a Microdrive cartridge on an `.mdr` */
export function openDiskFileSystem (bytes: Uint8Array, fileName: string): DiskFileSystem {
  const kind = diskImageKind(fileName, bytes);
  if (kind === "dsk") return new Plus3DosFileSystem(bytes);
  if (kind === "trd" || kind === "scl") return new TrdosFileSystem(bytes);
  if (kind === "mdr") return new MicrodriveFileSystem(bytes);
  throw new DiskFsError("unsupported", `${fileName} is not a disk image Klive can open.`, { name: fileName });
}

/** The bytes to write back for a file system opened from `fileName` (an `.scl` stays an `.scl`) */
export function diskImageBytes (fs: DiskFileSystem, fileName: string): Uint8Array {
  if (fs instanceof TrdosFileSystem && diskImageKind(fileName) === "scl") return fs.scl();
  return fs.image();
}
