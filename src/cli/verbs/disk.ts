import fs from "fs";
import path from "path";

import { applyDiskEdit, readDiskFile } from "@common/diskfs/edit";
import { hostFileToDiskFiles } from "@common/diskfs/importFiles";
import { openDiskFileSystem } from "@common/diskfs/open";
import { DiskFsError } from "@common/diskfs/types";
import { isHardDiskImage } from "@common/diskfs/hardDisk";
import { BLANK_DSK_TYPES, createBlankDsk, isBlankDskType } from "@emu/machines/disk/blank-dsk";
import { createBlankTrd } from "@emu/machines/disk/trd/trdImage";
import {
  copyHostFolderToHardDisk,
  createHardDiskImage,
  editHardDisk,
  queryHardDisk,
  readHardDiskFile
} from "@main/hard-disk-images";
import { parseArgs } from "../args";
import { CliError, EXIT_FAILED, EXIT_OK, usageError } from "../exit-codes";
import type { CliIo } from "../io";

/*
 * `klive disk` (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B6): the `disk` IDE command's
 * operations on image files, headless - for scripts and CI that build or inspect disks without a
 * running Klive. It edits the file directly; to edit a disk in a running machine's drive, use
 * `klive ide cmd "disk ..."`, which goes through the IDE (D4).
 */

export const DISK_HELP = `Usage: klive disk <action> <image> [<arguments>] [--json]

Actions:
  ls <image> [--deleted]               List the files
  info <image>                         The file system and its free space
  add <image> <host-file> [<name>] [--start <address>]
                                       Put a file on the disk (.tap: its files; .scr: a SCREEN$;
                                       .bas: tokenised BASIC; anything else: CODE at --start)
  get <image> <disk-file> <host-file>  Save a file from the disk
  rm <image> <disk-file>               Delete a file
  mv <image> <disk-file> <new-name>    Rename a file
  compact <image>                      Lay a TR-DOS disk's files down without the deleted ones
  new <image> <type>                   A blank disk: ${BLANK_DSK_TYPES.join(", ")}, trd80ds, trd40ds, trd80ss, trd40ss

Images: .dsk (+3DOS), .trd and .scl (TR-DOS). A changed image keeps a .bak of the original.

Hard-disk images and SD cards - .img, .hdf, .cim - with a FAT16 or FAT32 file system:
  new <image> fat16|fat32 <MB> [--label <text>] [--whole]
                                       A formatted image (--whole: no partition table)
  ls <image> [<folder>] [--deleted]    List a folder (the root by default)
  info <image>                         The volume, its partitions and free space
  add <image> <host-file-or-folder> [<folder>]
                                       Copy a file, or a folder with what it holds, as it is
  get <image> <path> <host-file>       Save a file from the image
  rm <image> <path>                    Delete a file or an empty folder
  mv <image> <path> <new-name>         Rename in place
  mkdir <image> <folder>               Make a folder (and the ones above it)
  --partition <n>                      Work on partition n (1-4) of a partitioned image
Hard-disk images are edited in place, with no .bak (they can be gigabytes).`;

const TRD_TYPES: Record<string, { cylinders: number; sides: number }> = {
  trd80ds: { cylinders: 80, sides: 2 },
  trd40ds: { cylinders: 40, sides: 2 },
  trd80ss: { cylinders: 80, sides: 1 },
  trd40ss: { cylinders: 40, sides: 1 }
};

export async function runDiskVerb (argv: string[], io: CliIo): Promise<number> {
  const { positional, options } = parseArgs(argv, { flags: ["json", "deleted", "help", "whole"], values: ["start", "partition", "label"] });
  if (options.help || positional.length === 0) {
    io.out(DISK_HELP);
    return EXIT_OK;
  }
  const [action, imageArg, arg1, arg2] = positional;
  if (!imageArg) throw usageError(`'klive disk ${action}' needs an image. Run 'klive disk --help'.`);
  const image = path.resolve(io.cwd, imageArg);
  const json = !!options.json;
  const start = options.start === undefined ? undefined : Number(options.start);
  if (start !== undefined && !(Number.isInteger(start) && start >= 0 && start <= 0xffff)) {
    throw usageError("--start must be an address from 0 to 65535.");
  }
  const need = (value: string | undefined, what: string) => {
    if (!value) throw usageError(`'klive disk ${action}' needs ${what}. Run 'klive disk --help'.`);
    return value;
  };
  if (isHardDiskImage(image)) {
    const partition = options.partition === undefined ? undefined : Number(options.partition) - 1;
    if (partition !== undefined && !(Number.isInteger(partition) && partition >= 0 && partition <= 3)) {
      throw usageError("--partition must be 1, 2, 3 or 4.");
    }
    try {
      return runHardDiskAction(io, action, image, positional.slice(2), { json, partition, deleted: !!options.deleted, whole: !!options.whole, label: options.label as string | undefined }, need);
    } catch (err) {
      if (err instanceof CliError) throw err;
      throw new CliError(String((err as Error)?.message ?? err), EXIT_FAILED);
    }
  }
  const read = () => new Uint8Array(fs.readFileSync(image));
  const save = (bytes: Uint8Array) => {
    fs.copyFileSync(image, `${image}.bak`);
    const temporary = `${image}.klive-tmp`;
    fs.writeFileSync(temporary, bytes);
    fs.renameSync(temporary, image);
  };

  try {
    switch (action) {
      case "new": {
        const type = need(arg1, "a disk type");
        const bytes = isBlankDskType(type) ? createBlankDsk(type) : TRD_TYPES[type] ? createBlankTrd(TRD_TYPES[type], path.parse(image).name.slice(0, 8)) : undefined;
        if (!bytes) throw usageError(`Unknown disk type '${type}'.`);
        if (fs.existsSync(image)) throw new CliError(`${image} already exists.`, EXIT_FAILED);
        fs.writeFileSync(image, bytes);
        io.out(json ? JSON.stringify({ file: image }) : `Created ${image}`);
        return EXIT_OK;
      }
      case "ls":
      case "info": {
        const disk = openDiskFileSystem(read(), image);
        const info = disk.info();
        const files = disk.list({ deleted: !!options.deleted }).filter((f) => options.deleted || !f.deleted);
        if (json) {
          io.out(JSON.stringify(action === "info" ? info : files.map(({ sectors: _s, ...f }) => f), undefined, 2));
          return EXIT_OK;
        }
        io.out(`${info.system} (${info.format}): ${info.freeBytes >> 10}K free of ${info.totalBytes >> 10}K, ${disk.list().length} files`);
        if (action === "ls") {
          for (const f of files) {
            const name = (f.deleted ? `(${f.name})` : f.name).padEnd(14);
            io.out(`${name}${f.kind.padEnd(12)}${String(f.size).padStart(6)}${f.start === undefined ? "" : String(f.start).padStart(7)}`);
          }
        }
        return EXIT_OK;
      }
      case "add": {
        const host = path.resolve(io.cwd, need(arg1, "a host file"));
        const bytes = read();
        const system = openDiskFileSystem(bytes, image).system;
        let files = hostFileToDiskFiles(host, new Uint8Array(fs.readFileSync(host)), { system, codeStart: start });
        if (arg2) files = files.map((f, i) => (i === 0 ? { ...f, name: arg2 } : f));
        save(applyDiskEdit(bytes, image, { kind: "add", files }));
        io.out(json ? JSON.stringify({ added: files.map((f) => f.name) }) : `Added ${files.map((f) => f.name).join(", ")}`);
        return EXIT_OK;
      }
      case "get": {
        const name = need(arg1, "a disk file");
        const target = path.resolve(io.cwd, need(arg2, "a host file"));
        const data = readDiskFile(read(), image, name);
        fs.writeFileSync(target, data);
        io.out(json ? JSON.stringify({ file: target, bytes: data.length }) : `Saved ${name} to ${target} (${data.length} bytes)`);
        return EXIT_OK;
      }
      case "rm":
        save(applyDiskEdit(read(), image, { kind: "delete", names: [need(arg1, "a disk file")] }));
        io.out(json ? JSON.stringify({ deleted: arg1 }) : `Deleted ${arg1}`);
        return EXIT_OK;
      case "mv":
        save(applyDiskEdit(read(), image, { kind: "rename", name: need(arg1, "a disk file"), newName: need(arg2, "a new name") }));
        io.out(json ? JSON.stringify({ renamed: arg1, to: arg2 }) : `Renamed ${arg1} to ${arg2}`);
        return EXIT_OK;
      case "compact":
        save(applyDiskEdit(read(), image, { kind: "compact" }));
        io.out(json ? JSON.stringify({ compacted: image }) : `Compacted ${image}`);
        return EXIT_OK;
      default:
        throw usageError(`Unknown action '${action}'. Run 'klive disk --help'.`);
    }
  } catch (err) {
    if (err instanceof CliError) throw err;
    if (err instanceof DiskFsError) throw new CliError(err.message, EXIT_FAILED);
    throw new CliError(String((err as Error)?.message ?? err), EXIT_FAILED);
  }
}

type HardDiskOptions = { json: boolean; partition?: number; deleted: boolean; whole: boolean; label?: string };

/** The actions on a `.img`, `.hdf` or `.cim` (C2): made in place through the main process's block devices */
function runHardDiskAction (
  io: CliIo,
  action: string,
  image: string,
  [arg1, arg2]: string[],
  options: HardDiskOptions,
  need: (value: string | undefined, what: string) => string
): number {
  const { json, partition } = options;
  const out = (data: unknown, text: string) => io.out(json ? JSON.stringify(data, undefined, 2) : text);
  switch (action) {
    case "new": {
      const fatType = need(arg1, "a file system (fat16 or fat32)");
      if (fatType !== "fat16" && fatType !== "fat32") throw usageError(`Unknown file system '${fatType}': fat16 or fat32.`);
      const sizeMb = Number(need(arg2, "a size in MB"));
      if (!Number.isInteger(sizeMb) || sizeMb < 1) throw usageError("The size must be a whole number of MB.");
      if (fs.existsSync(image)) throw new CliError(`${image} already exists.`, EXIT_FAILED);
      createHardDiskImage(image, { sizeMb, fatType: fatType === "fat16" ? 16 : 32, label: options.label, partitioned: !options.whole });
      out({ file: image }, `Created ${image}`);
      return EXIT_OK;
    }
    case "ls":
    case "info": {
      const view = queryHardDisk(image, { partition, dir: action === "ls" ? arg1 : undefined, deleted: options.deleted });
      if (view.fsError) throw new CliError(`No FAT file system: ${view.fsError.code}`, EXIT_FAILED);
      const files = view.files.filter((f) => options.deleted || !f.deleted);
      if (json) {
        out(action === "info" ? { info: view.info, partitions: view.partitions, partition: view.partition } : files.map(({ sectors: _s, ...f }) => f), "");
        return EXIT_OK;
      }
      const info = view.info!;
      io.out(`${info.system}${info.label ? ` "${info.label}"` : ""}: ${Math.round(info.freeBytes / 1048576)}M free of ${Math.round(info.totalBytes / 1048576)}M`);
      if (action === "info") {
        for (const p of view.partitions) io.out(`  partition ${p.index + 1}: type ${p.type.toString(16).padStart(2, "0")}, ${p.sectorCount} sectors from ${p.firstLba}${p.whole ? " (whole disk)" : ""}`);
      } else {
        for (const f of files) {
          const name = f.name.slice(f.name.lastIndexOf("/") + 1);
          io.out(`${(f.deleted ? `(${name})` : name).padEnd(32)}${f.isDirectory ? "<DIR>".padStart(12) : String(f.size).padStart(12)}`);
        }
      }
      return EXIT_OK;
    }
    case "add": {
      const host = path.resolve(io.cwd, need(arg1, "a host file or folder"));
      const base = path.basename(host);
      const target = arg2 ? `${arg2.replace(/\/+$/, "")}/${base}` : base;
      if (fs.statSync(host).isDirectory()) {
        const count = copyHostFolderToHardDisk(image, host, target, partition);
        out({ added: target, files: count }, `Added ${target} (${count} files)`);
      } else {
        editHardDisk(image, { kind: "add", files: [{ name: target, kind: "raw", data: new Uint8Array(fs.readFileSync(host)) }], replace: true }, partition);
        out({ added: [target] }, `Added ${target}`);
      }
      return EXIT_OK;
    }
    case "get": {
      const name = need(arg1, "a path on the image");
      const target = path.resolve(io.cwd, need(arg2, "a host file"));
      const data = readHardDiskFile(image, name, partition);
      fs.writeFileSync(target, data);
      out({ file: target, bytes: data.length }, `Saved ${name} to ${target} (${data.length} bytes)`);
      return EXIT_OK;
    }
    case "rm":
      editHardDisk(image, { kind: "delete", names: [need(arg1, "a path on the image")] }, partition);
      out({ deleted: arg1 }, `Deleted ${arg1}`);
      return EXIT_OK;
    case "mv":
      editHardDisk(image, { kind: "rename", name: need(arg1, "a path on the image"), newName: need(arg2, "a new name") }, partition);
      out({ renamed: arg1, to: arg2 }, `Renamed ${arg1} to ${arg2}`);
      return EXIT_OK;
    case "mkdir":
      editHardDisk(image, { kind: "mkdir", path: need(arg1, "a folder") }, partition);
      out({ created: arg1 }, `Created ${arg1}`);
      return EXIT_OK;
    default:
      throw usageError(`Unknown action '${action}' for a hard-disk image. Run 'klive disk --help'.`);
  }
}
