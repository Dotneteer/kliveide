import { diskImageBytes, openDiskFileSystem } from "./open";
import { Plus3DosFileSystem } from "./plus3dos";
import { TrdosFileSystem } from "./trdos";
import { FatFileSystem } from "./fat";
import { DiskFsError, type DiskFileAttributes, type DiskFileSystem, type NewDiskFile } from "./types";

/*
 * The edits the Disk Explorer, the `disk` IDE command and `klive disk` make
 * (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B4/B6), as pure functions of an image's bytes.
 */

/** An edit to a disk image */
export type DiskEdit =
  | { kind: "add"; files: NewDiskFile[]; replace?: boolean }
  | { kind: "delete"; names: string[] }
  | { kind: "rename"; name: string; newName: string }
  | { kind: "attributes"; name: string; attributes: Partial<DiskFileAttributes> }
  | { kind: "user"; name: string; user: number }
  | { kind: "compact" }
  | { kind: "label"; label: string }
  | { kind: "mkdir"; path: string };

/**
 * An edit applied to an image's bytes
 * @returns The new image, in the file's own format (an `.scl` stays an `.scl`)
 * @throws DiskFsError when the file system refuses it
 */
export function applyDiskEdit (bytes: Uint8Array, fileName: string, edit: DiskEdit): Uint8Array {
  const fs = openDiskFileSystem(bytes, fileName);
  applyEdit(fs, edit);
  return diskImageBytes(fs, fileName);
}

/**
 * An edit applied to an open file system (a hard disk's, on its device)
 * @throws DiskFsError when the file system refuses it
 */
export function applyEdit (fs: DiskFileSystem, edit: DiskEdit): void {
  switch (edit.kind) {
    case "add":
      for (const file of edit.files) {
        if (edit.replace) {
          const slash = file.name.lastIndexOf("/");
          const dir = slash >= 0 ? file.name.slice(0, slash) : "";
          const same = fs.list({ dir }).find((f) => f.name.toUpperCase() === file.name.toUpperCase());
          if (same) fs.delete(same.name);
        }
        fs.write(file);
      }
      break;
    case "delete":
      edit.names.forEach((name) => fs.delete(name));
      break;
    case "rename":
      fs.rename(edit.name, edit.newName);
      break;
    case "attributes":
      fs.setAttributes(edit.name, edit.attributes);
      break;
    case "user":
      if (!(fs instanceof Plus3DosFileSystem)) throw new DiskFsError("unsupported", "Only +3DOS has user areas.");
      fs.setUser(edit.name, edit.user);
      break;
    case "compact":
      if (!(fs instanceof TrdosFileSystem)) throw new DiskFsError("unsupported", "Only TR-DOS disks are compacted.");
      fs.compact();
      break;
    case "label":
      if (!(fs instanceof TrdosFileSystem)) throw new DiskFsError("unsupported", "Only TR-DOS disks have a label.");
      fs.setLabel(edit.label);
      break;
    case "mkdir":
      if (!(fs instanceof FatFileSystem)) throw new DiskFsError("unsupported", "Only FAT disks have folders.");
      fs.mkdir(edit.path);
      break;
  }
}

/** A file's contents, as the disk's file system reads them */
export function readDiskFile (bytes: Uint8Array, fileName: string, name: string): Uint8Array {
  return openDiskFileSystem(bytes, fileName).read(name);
}
