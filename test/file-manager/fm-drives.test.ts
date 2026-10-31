import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

import { Plus3DosFileSystem } from "@common/diskfs/plus3dos";
import { TrdosFileSystem } from "@common/diskfs/trdos";
import { fmColumnSetOf, fmErrorCodeOf, fmImageKindOf } from "@common/fileManager/fmTypes";
import { createBlankDsk } from "@emu/machines/disk/blank-dsk";
import { createBlankTrd } from "@emu/machines/disk/trd/trdImage";
import { createHardDiskImage, editHardDisk } from "@main/hard-disk-images";
import {
  defaultHostEnv,
  listHostDrives,
  listHostFolder,
  listImageFolder,
  openImageDrives,
  projectDriveOf,
  readDriveFile,
  type FmHostEnv
} from "@main/file-manager/fmDrives";

/*
 * The File Manager's drive layer (.plans/FILE_MANAGER_PLAN.md, Phase 1): host volumes, host folders,
 * the project with its exclusions, floppy images and hard-disk partitions, listed and read.
 */

const PRINT_42 = new Uint8Array([0x00, 0x0a, 0x0a, 0x00, 0xf5, 0x34, 0x32, 0x0e, 0x00, 0x00, 0x2a, 0x00, 0x00, 0x0d]);
const bytes = (n: number, seed = 0) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + seed) & 0xff);

function tempDir (): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "klive-fm-")));
}

function fakeEnv (over: Partial<FmHostEnv>): FmHostEnv {
  return {
    platform: "linux",
    homeDir: "/home/me",
    kliveBase: "/home/me",
    exists: () => false,
    readdir: () => [],
    realpath: (p) => p,
    isWritable: () => true,
    space: () => ({ free: 100, total: 1000 }),
    ...over
  };
}

describe("file names and file systems", () => {
  it("knows the images a pane enters", () => {
    expect(["a.dsk", "B.TRD", "c.scl", "d.mdr"].map(fmImageKindOf)).toEqual(["image", "image", "image", "image"]);
    expect(["a.img", "b.HDF", "c.cim"].map(fmImageKindOf)).toEqual(["hardDisk", "hardDisk", "hardDisk"]);
    expect(["a.tap", "readme.txt", "dsk"].map(fmImageKindOf)).toEqual([undefined, undefined, undefined]);
  });

  it("picks the columns by file system", () => {
    expect(["", "+3DOS", "TR-DOS", "Microdrive", "FAT16", "FAT32"].map(fmColumnSetOf)).toEqual([
      "host", "plus3dos", "trdos", "microdrive", "fat", "fat"
    ]);
  });

  it("recovers an error's code from its message, as IPC delivers it", () => {
    expect(fmErrorCodeOf(new Error("FmError: [fm:notFound] x does not exist."))).toBe("notFound");
    expect(fmErrorCodeOf(new Error("something else"))).toBe("failed");
  });
});

describe("the host's drives", () => {
  it("macOS: the boot volume by its /Volumes name, then the other volumes (not the system's own mounts), home and Klive's folders", () => {
    const env = fakeEnv({
      platform: "darwin",
      homeDir: "/Users/me",
      kliveBase: "/Users/me",
      readdir: (p) => (p === "/Volumes" ? ["Macintosh HD", "SD-CARD", ".hidden", "com.apple.TimeMachine.localsnapshots"] : []),
      realpath: (p) => (p === "/Volumes/Macintosh HD" ? "/" : p),
      exists: (p) => p === "/Users/me/KliveProjects"
    });
    const drives = listHostDrives(env);
    expect(drives.map((d) => [d.role, d.name, d.root])).toEqual([
      ["root", "Macintosh HD", "/"],
      ["volume", "SD-CARD", "/Volumes/SD-CARD"],
      ["home", "me", "/Users/me"],
      ["kliveProjects", "KliveProjects", "/Users/me/KliveProjects"]
    ]);
    expect(drives[0]).toMatchObject({ id: "host:/", kind: "host", group: "computer", freeBytes: 100, totalBytes: 1000 });
  });

  it("Windows: every drive letter that exists", () => {
    const env = fakeEnv({ platform: "win32", homeDir: "C:\\Users\\me", kliveBase: "C:\\Users\\me", exists: (p) => p === "C:\\" || p === "E:\\" });
    expect(listHostDrives(env).slice(0, 2).map((d) => [d.name, d.root])).toEqual([["C:", "C:\\"], ["E:", "E:\\"]]);
  });

  it("Linux: the root, removable media and /mnt", () => {
    const env = fakeEnv({ readdir: (p) => (p === "/media/me" ? ["USB"] : p === "/mnt" ? ["data"] : []) });
    expect(listHostDrives(env).map((d) => d.root)).toEqual(["/", "/media/me/USB", "/mnt/data", "/home/me"]);
  });

  it("marks a drive it cannot write as read-only", () => {
    const env = fakeEnv({ isWritable: (p) => p !== "/" });
    expect(listHostDrives(env)[0].readOnly).toBe(true);
  });
});

describe("host folders", () => {
  it("lists a folder with sizes, dates, hidden files and images, and its path", () => {
    const root = tempDir();
    fs.mkdirSync(path.join(root, "tapes", "old"), { recursive: true });
    fs.writeFileSync(path.join(root, "tapes", "game.tap"), bytes(300));
    fs.writeFileSync(path.join(root, "tapes", "game.dsk"), createBlankDsk("ss"));
    fs.writeFileSync(path.join(root, "tapes", ".DS_Store"), "x");
    const env = defaultHostEnv(root);
    const drive = listHostDrives({ ...env, platform: "linux", readdir: () => [] }).find((d) => d.role === "home")!;

    const listing = listHostFolder(drive, path.join(root, "tapes"), env);
    const byName = Object.fromEntries(listing.entries.map((e) => [e.name, e]));
    expect(Object.keys(byName).sort()).toEqual([".DS_Store", "game.dsk", "game.tap", "old"]);
    expect(byName["game.tap"]).toMatchObject({ isDirectory: false, size: 300, path: path.join(root, "tapes", "game.tap") });
    expect(byName["game.tap"].modified).toBeGreaterThan(0);
    expect(byName["old"]).toMatchObject({ isDirectory: true, size: 0 });
    expect(byName[".DS_Store"].hidden).toBe(true);
    expect(byName["game.dsk"].imageKind).toBe("image");
    expect(listing).toMatchObject({
      dir: path.join(root, "tapes"),
      parentDir: root,
      columns: "host",
      crumbs: [{ label: "", dir: root }, { label: "tapes", dir: path.join(root, "tapes") }]
    });
  });

  it("has no folder above the drive's top, and keeps a pane inside its drive", () => {
    const root = tempDir();
    const drive = projectDriveOf(defaultHostEnv(root), root);
    expect(listHostFolder(drive, undefined, defaultHostEnv(root)).parentDir).toBeUndefined();
    expect(listHostFolder(drive, path.dirname(root), defaultHostEnv(root)).dir).toBe(root);
  });

  it("hides what the project excludes", () => {
    const root = tempDir();
    fs.mkdirSync(path.join(root, ".git"));
    fs.writeFileSync(path.join(root, "klive.project"), "{}");
    const drive = projectDriveOf(defaultHostEnv(root), root);
    expect(drive).toMatchObject({ kind: "project", role: "project", group: "project", id: `project:${root}` });
    const listing = listHostFolder(drive, root, defaultHostEnv(root), (relative) => !relative.startsWith(".git"));
    expect(listing.entries.map((e) => e.name)).toEqual(["klive.project"]);
  });

  it("says why a folder cannot be listed", () => {
    const root = tempDir();
    const drive = projectDriveOf(defaultHostEnv(root), root);
    expect(() => listHostFolder(drive, path.join(root, "missing"), defaultHostEnv(root))).toThrow(/\[fm:notFound\]/);
    fs.writeFileSync(path.join(root, "file.txt"), "x");
    expect(() => listHostFolder(drive, path.join(root, "file.txt"), defaultHostEnv(root))).toThrow(/\[fm:notAFolder\]/);
  });

  it("reads a file, but only on its drive", async () => {
    const root = tempDir();
    fs.writeFileSync(path.join(root, "a.bin"), bytes(10));
    const drive = projectDriveOf(defaultHostEnv(root), root);
    expect(await readDriveFile(drive, path.join(root, "a.bin"))).toEqual(bytes(10));
    await expect(readDriveFile(drive, path.join(path.dirname(root), "x"))).rejects.toThrow(/\[fm:notFound\]/);
  });
});

describe("floppy and cartridge images", () => {
  it("a +3DOS disk: one drive, its files with their headers' facts", async () => {
    const root = tempDir();
    const p3 = new Plus3DosFileSystem(createBlankDsk("ss"));
    p3.write({ name: "LOADER", kind: "basic", data: PRINT_42, start: 10, variablesOffset: PRINT_42.length });
    p3.write({ name: "GAME.BIN", kind: "code", data: bytes(500), start: 24000 });
    const file = path.join(root, "game.dsk");
    fs.writeFileSync(file, p3.image());

    const [drive, ...more] = await openImageDrives(file);
    expect(more).toEqual([]);
    expect(drive).toMatchObject({ id: `image:${file}`, kind: "image", role: "image", group: "images", name: "game.dsk", fileSystem: "+3DOS", readOnly: false });
    expect(drive.freeBytes).toBeLessThan(173 * 1024);

    const listing = await listImageFolder(drive, "");
    expect(listing).toMatchObject({ dir: "", parentDir: undefined, columns: "plus3dos", crumbs: [{ label: "", dir: "" }] });
    expect(listing.entries.map((e) => [e.name, e.isDirectory, e.size, e.spectrum?.kind, e.spectrum?.start])).toEqual([
      ["LOADER", false, PRINT_42.length, "basic", 10],
      ["GAME.BIN", false, 500, "code", 24000]
    ]);
    expect(await readDriveFile(drive, "GAME.BIN")).toEqual(bytes(500));
  });

  it("a TR-DOS disk lists with its columns", async () => {
    const root = tempDir();
    const trd = new TrdosFileSystem(createBlankTrd({ cylinders: 80, sides: 2 }, "KLIVE"));
    trd.write({ name: "boot", kind: "basic", data: PRINT_42, start: 10, variablesOffset: PRINT_42.length });
    const file = path.join(root, "disk.trd");
    fs.writeFileSync(file, trd.image());
    const [drive] = await openImageDrives(file);
    expect(drive.fileSystem).toBe("TR-DOS");
    const listing = await listImageFolder(drive, undefined);
    expect(listing.columns).toBe("trdos");
    expect(listing.entries).toHaveLength(1);
  });

  it("refuses a file that is not an image", async () => {
    const root = tempDir();
    fs.writeFileSync(path.join(root, "a.txt"), "x");
    await expect(openImageDrives(path.join(root, "a.txt"))).rejects.toThrow(/\[fm:unsupported\]/);
  });
});

describe("hard-disk images", () => {
  function card (): string {
    const file = path.join(tempDir(), "card.img");
    createHardDiskImage(file, { sizeMb: 32, fatType: 16, label: "CARD" });
    editHardDisk(file, { kind: "mkdir", path: "GAMES/ARCADE" });
    editHardDisk(file, { kind: "add", files: [{ name: "GAMES/Manic Miner.tap", kind: "raw", data: bytes(4000) }] });
    editHardDisk(file, { kind: "add", files: [{ name: "GAMES/disk.dsk", kind: "raw", data: createBlankDsk("ss") }] });
    return file;
  }

  it("opens as one drive per FAT partition and lists folders by path", async () => {
    const file = card();
    const drives = await openImageDrives(file);
    expect(drives).toHaveLength(1);
    const drive = drives[0];
    expect(drive).toMatchObject({ id: `hd:${file}#0`, kind: "hardDisk", role: "image", fileSystem: "FAT16", partition: 0 });

    const top = await listImageFolder(drive, "");
    expect(top.entries.map((e) => [e.name, e.path, e.isDirectory])).toEqual([["GAMES", "GAMES", true]]);
    expect(top.columns).toBe("fat");

    const games = await listImageFolder(drive, "/GAMES/");
    expect(games).toMatchObject({ dir: "GAMES", parentDir: "", crumbs: [{ label: "", dir: "" }, { label: "GAMES", dir: "GAMES" }] });
    const byName = Object.fromEntries(games.entries.map((e) => [e.name, e]));
    expect(byName["ARCADE"]).toMatchObject({ isDirectory: true, path: "GAMES/ARCADE" });
    expect(byName["Manic Miner.tap"]).toMatchObject({ size: 4000, path: "GAMES/Manic Miner.tap" });
    expect(byName["disk.dsk"].imageKind).toBe("image");

    const arcade = await listImageFolder(drive, "GAMES/ARCADE");
    expect(arcade).toMatchObject({ parentDir: "GAMES", entries: [] });
    expect(await readDriveFile(drive, "GAMES/Manic Miner.tap")).toEqual(bytes(4000));
  });

  it("goes through the access it is given (the SD card's lock)", async () => {
    const file = card();
    const seen: string[] = [];
    const access = async <T>(p: string, op: () => T) => {
      seen.push(p);
      return op();
    };
    const [drive] = await openImageDrives(file, access);
    await listImageFolder(drive, "", access);
    await readDriveFile(drive, "GAMES/Manic Miner.tap", access);
    expect(seen).toEqual([file, file, file]);
  });

  it("says a missing folder is missing", async () => {
    const [drive] = await openImageDrives(card());
    await expect(listImageFolder(drive, "NOPE")).rejects.toThrow(/\[fm:notFound\]/);
  });

  it("an unformatted image has no drive", async () => {
    const file = path.join(tempDir(), "blank.img");
    fs.writeFileSync(file, new Uint8Array(1024 * 1024));
    await expect(openImageDrives(file)).rejects.toThrow(/\[fm:unformatted\]/);
  });
});

