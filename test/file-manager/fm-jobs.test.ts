import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

import { Plus3DosFileSystem } from "@common/diskfs/plus3dos";
import { MgtFileSystem } from "@common/diskfs/mgtfs";
import { MemoryBlockDevice } from "@common/diskfs/blockDevice";
import { formatIdedos } from "@common/diskfs/idedos";
import { TrdosFileSystem } from "@common/diskfs/trdos";
import { tapFiles } from "@common/diskfs/importFiles";
import { openDiskFileSystem } from "@common/diskfs/open";
import { FatFileSystem } from "@common/diskfs/fat";
import type { FmDriveRef } from "@common/fileManager/fmTypes";
import type { FmTransferRequest } from "@common/fileManager/fmJobTypes";
import { createBlankDsk } from "@emu/machines/disk/blank-dsk";
import { createBlankTrd } from "@emu/machines/disk/trd/trdImage";
import { createHardDiskImage, editHardDisk, withHardDisk } from "@main/hard-disk-images";
import { defaultHostEnv, listImageFolder, openImageDrives, projectDriveOf } from "@main/file-manager/fmDrives";
import {
  cancelJob,
  deleteEntries,
  directJobDeps,
  jobStatus,
  makeFolder,
  moveOnTape,
  planTransfer,
  renameEntry,
  runTransfer,
  type FmJobDeps
} from "@main/file-manager/fmJobs";

/*
 * The File Manager's jobs (.plans/FILE_MANAGER_PLAN.md, Phase 4): copies between every kind of
 * drive on real images, moves, conflicts, cancelling, a full disk, delete, new folder and rename.
 */

const PRINT_42 = new Uint8Array([0x00, 0x0a, 0x0a, 0x00, 0xf5, 0x34, 0x32, 0x0e, 0x00, 0x00, 0x2a, 0x00, 0x00, 0x0d]);
const bytes = (n: number, seed = 0) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + seed) & 0xff);

function tempDir (): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "klive-fmjob-")));
}

type World = { root: string; host: FmDriveRef; dsk: FmDriveRef; trd: FmDriveRef; card: FmDriveRef; deps: FmJobDeps; trashed: string[]; commits: string[] };

async function world (): Promise<World> {
  const root = tempDir();
  fs.mkdirSync(path.join(root, "src", "gfx"), { recursive: true });
  fs.mkdirSync(path.join(root, "out"));
  fs.writeFileSync(path.join(root, "src", "loader.bas"), '10 PRINT 42\n');
  fs.writeFileSync(path.join(root, "src", "title.scr"), bytes(6912));
  fs.writeFileSync(path.join(root, "src", "gfx", "font.bin"), bytes(768));

  const p3 = new Plus3DosFileSystem(createBlankDsk("ss"));
  p3.write({ name: "DISK", kind: "basic", data: PRINT_42, start: 10, variablesOffset: PRINT_42.length });
  p3.write({ name: "GAME.BIN", kind: "code", data: bytes(500), start: 24000 });
  p3.write({ name: "TITLE", kind: "code", data: bytes(6912, 3), start: 16384 });
  fs.writeFileSync(path.join(root, "game.dsk"), p3.image());
  fs.writeFileSync(path.join(root, "blank.trd"), createBlankTrd({ cylinders: 80, sides: 2 }, "KLIVE"));
  const card = path.join(root, "card.img");
  createHardDiskImage(card, { sizeMb: 32, fatType: 16, label: "CARD" });
  editHardDisk(card, { kind: "mkdir", path: "GAMES" });
  editHardDisk(card, { kind: "add", files: [{ name: "GAMES/Manic Miner.tap", kind: "raw", data: bytes(4000) }] });

  const trashed: string[] = [];
  const commits: string[] = [];
  const deps = directJobDeps({
    trash: async (p) => {
      trashed.push(p);
      fs.rmSync(p, { recursive: true });
    },
    commitImageEdit: async (p, contents) => {
      commits.push(p);
      fs.writeFileSync(p, contents);
    },
    space: (p) => defaultHostEnv(root).space(p)
  });
  return {
    root,
    host: projectDriveOf(defaultHostEnv(root), root),
    dsk: (await openImageDrives(path.join(root, "game.dsk")))[0],
    trd: (await openImageDrives(path.join(root, "blank.trd")))[0],
    card: (await openImageDrives(card))[0],
    deps,
    trashed,
    commits
  };
}

function request (w: World, source: FmDriveRef, paths: string[], target: FmDriveRef, targetDir: string, over: Partial<FmTransferRequest> = {}): FmTransferRequest {
  return { sourceDriveId: source.id, paths, targetDriveId: target.id, targetDir, move: false, options: { mode: "auto" }, ...over };
}

async function copy (w: World, source: FmDriveRef, paths: string[], target: FmDriveRef, targetDir: string, over: Partial<FmTransferRequest> = {}) {
  const plan = await planTransfer(request(w, source, paths, target, targetDir, over), source, target, w.deps);
  const result = await runTransfer(plan.id, {}, w.deps);
  return { plan, result };
}

const cardFiles = (w: World, dir: string) =>
  withHardDisk(w.card.root, (d) => FatFileSystem.open(d).list({ dir }).map((e) => [e.name, e.size, !!e.isDirectory]));
const cardRead = (w: World, p: string) => withHardDisk(w.card.root, (d) => FatFileSystem.open(d).read(p));
const diskOf = (file: string) => openDiskFileSystem(new Uint8Array(fs.readFileSync(file)), file);

describe("copying between drives", () => {
  it("host to host: a folder with what is inside it", async () => {
    const w = await world();
    const { plan, result } = await copy(w, w.host, [path.join(w.root, "src")], w.host, path.join(w.root, "out"));
    expect(plan.items.map((i) => [i.relDir, i.targetName, i.isDirectory])).toEqual([
      ["", "src", true],
      ["src", "gfx", true],
      ["src/gfx", "font.bin", false],
      ["src", "loader.bas", false],
      ["src", "title.scr", false]
    ]);
    expect(result).toMatchObject({ written: 3, skipped: 0, failed: [], cancelled: false });
    expect(fs.readFileSync(path.join(w.root, "out", "src", "gfx", "font.bin"))).toEqual(Buffer.from(bytes(768)));
  });

  it("host to +3DOS: converted, written in one commit", async () => {
    const w = await world();
    const { plan, result } = await copy(w, w.host, [path.join(w.root, "src", "loader.bas"), path.join(w.root, "src", "title.scr")], w.dsk, "", {
      options: { mode: "auto", autoRun: 10 }
    });
    expect(plan.items.map((i) => [i.targetName, i.becomes.as])).toEqual([["LOADER", "basic"], ["TITLE.SCR", "screen"]]);
    expect(result.written).toBe(2);
    expect(w.commits).toEqual([w.dsk.root]);
    const disk = diskOf(w.dsk.root);
    expect(disk.list().map((e) => [e.name, e.kind, e.start])).toEqual(expect.arrayContaining([
      ["LOADER", "basic", 10],
      ["TITLE.SCR", "code", 16384]
    ]));
  });

  it("+3DOS to host: auto mode, a .tap for BASIC, .scr and bytes for code", async () => {
    const w = await world();
    const { result } = await copy(w, w.dsk, ["DISK", "GAME.BIN", "TITLE"], w.host, path.join(w.root, "out"));
    expect(result.written).toBe(3);
    expect(fs.readdirSync(path.join(w.root, "out")).sort()).toEqual(["DISK.tap", "GAME.BIN", "TITLE.scr"]);
    const [program] = tapFiles(new Uint8Array(fs.readFileSync(path.join(w.root, "out", "DISK.tap"))), "x");
    expect(program).toMatchObject({ kind: "basic", start: 10, data: PRINT_42 });
  });

  it("+3DOS to TR-DOS: the headers go with the files", async () => {
    const w = await world();
    await copy(w, w.dsk, ["DISK", "GAME.BIN"], w.trd, "");
    const trd = diskOf(w.trd.root) as TrdosFileSystem;
    expect(trd.list().map((e) => [e.name, e.kind, e.start])).toEqual([["DISK.B", "basic", 10], ["GAME.C", "code", 24000]]);
  });

  it("host to FAT: folders and files as they are, into a folder of the card", async () => {
    const w = await world();
    const { result } = await copy(w, w.host, [path.join(w.root, "src", "gfx")], w.card, "GAMES");
    expect(result.written).toBe(1);
    expect(cardFiles(w, "GAMES/gfx")).toEqual([["GAMES/gfx/font.bin", 768, false]]);
    expect(cardRead(w, "GAMES/gfx/font.bin")).toEqual(bytes(768));
  });

  it("FAT to host and FAT to +3DOS", async () => {
    const w = await world();
    await copy(w, w.card, ["GAMES/Manic Miner.tap"], w.host, path.join(w.root, "out"));
    expect(fs.readFileSync(path.join(w.root, "out", "Manic Miner.tap"))).toEqual(Buffer.from(bytes(4000)));
    const { plan } = await copy(w, w.card, ["GAMES/Manic Miner.tap"], w.dsk, "", { options: { mode: "raw" } });
    expect(plan.items[0]).toMatchObject({ targetName: "MANICMIN.TAP", becomes: { as: "code", start: 32768 }, shortened: true });
    expect(diskOf(w.dsk.root).read("MANICMIN.TAP")).toEqual(bytes(4000));
  });

  it("FAT to FAT: within the card, from one folder to another", async () => {
    const w = await world();
    editHardDisk(w.card.root, { kind: "mkdir", path: "BACKUP" });
    await copy(w, w.card, ["GAMES"], w.card, "BACKUP");
    expect(cardFiles(w, "BACKUP/GAMES").map((f) => f[0])).toEqual(["BACKUP/GAMES/Manic Miner.tap"]);
  });
});

describe("tapes (Phase 6)", () => {
  async function withTape (w: World) {
    const file = path.join(w.root, "game.tap");
    fs.writeFileSync(file, new Uint8Array(0));
    return (await openImageDrives(file))[0];
  }

  it("a tape is a drive with no free space to run out of", async () => {
    const w = await world();
    const tape = await withTape(w);
    expect(tape).toMatchObject({ kind: "image", fileSystem: "TAP", readOnly: false, freeBytes: undefined });
  });

  it("host to tape: a .bas is tokenised, a .scr is a SCREEN$, appended in order", async () => {
    const w = await world();
    const tape = await withTape(w);
    await copy(w, w.host, [path.join(w.root, "src", "loader.bas"), path.join(w.root, "src", "title.scr")], tape, "", {
      options: { mode: "auto", autoRun: 10 }
    });
    const back = tapFiles(new Uint8Array(fs.readFileSync(tape.root)), "t");
    expect(back.map((f) => [f.name, f.kind, f.start])).toEqual([["loader", "basic", 10], ["title", "code", 16384]]);
  });

  it("+3DOS to tape and tape to host keep the headers", async () => {
    const w = await world();
    const tape = await withTape(w);
    await copy(w, w.dsk, ["DISK", "GAME.BIN"], tape, "");
    const files = tapFiles(new Uint8Array(fs.readFileSync(tape.root)), "t");
    expect(files.map((f) => [f.name, f.kind, f.start])).toEqual([["DISK", "basic", 10], ["GAME.BIN", "code", 24000]]);

    const reopened = (await openImageDrives(tape.root))[0];
    await copy(w, reopened, ["DISK", "GAME.BIN"], w.host, path.join(w.root, "out"), { options: { mode: "headers" } });
    expect(fs.readdirSync(path.join(w.root, "out")).sort()).toEqual(["DISK.tap", "GAME.BIN.tap"]);
  });
});

describe("MGT disks (Phase 9)", () => {
  it("+3DOS to MGT and back to the host keep the headers", async () => {
    const w = await world();
    const file = path.join(w.root, "plusd.mgt");
    fs.writeFileSync(file, MgtFileSystem.blank().image());
    const [mgt] = await openImageDrives(file);
    expect(mgt).toMatchObject({ fileSystem: "MGT", kind: "image" });
    const { plan } = await copy(w, w.dsk, ["DISK", "GAME.BIN", "TITLE"], mgt, "");
    expect(plan.items.map((i) => i.targetName)).toEqual(["DISK", "GAME.BIN", "TITLE"]);
    const disk = diskOf(file);
    expect(disk.list().map((e) => [e.name, e.kind, e.start])).toEqual([["DISK", "basic", 10], ["GAME.BIN", "code", 24000], ["TITLE", "code", 16384]]);
    const [again] = await openImageDrives(file);
    await copy(w, again, ["DISK"], w.host, path.join(w.root, "out"));
    const [program] = tapFiles(new Uint8Array(fs.readFileSync(path.join(w.root, "out", "DISK.tap"))), "x");
    expect(program).toMatchObject({ kind: "basic", start: 10, data: PRINT_42 });
  });
});

describe("IDEDOS +3DOS partitions (Phase 9)", () => {
  function plus3eDisk (w: World): string {
    const image = new Uint8Array(4 * 1024 * 1024);
    formatIdedos(new MemoryBlockDevice(image), { partitions: [{ name: "games", sizeKb: 1024 }, { name: "work", sizeKb: 512 }] });
    const file = path.join(w.root, "plus3e.img");
    fs.writeFileSync(file, image);
    return file;
  }

  it("each +3DOS partition is a drive, named by the partition", async () => {
    const w = await world();
    const file = plus3eDisk(w);
    const drives = await openImageDrives(file);
    expect(drives.map((d) => [d.id, d.name, d.role, d.fileSystem, d.partition])).toEqual([
      [`hd:${file}#1001`, "plus3e.img (games)", "image", "+3DOS", 1001],
      [`hd:${file}#1002`, "plus3e.img (work)", "image", "+3DOS", 1002]
    ]);
    const listing = await listImageFolder(drives[0], "");
    expect(listing).toMatchObject({ columns: "plus3dos", entries: [] });
  });

  it("a +3 disk's files go onto a partition with their headers, in place, and come back", async () => {
    const w = await world();
    const file = plus3eDisk(w);
    const [games, work] = await openImageDrives(file);
    await copy(w, w.dsk, ["DISK", "GAME.BIN"], games, "");
    const listing = await listImageFolder(games, "");
    expect(listing.entries.map((e) => [e.name, e.spectrum?.kind, e.spectrum?.start])).toEqual([["DISK", "basic", 10], ["GAME.BIN", "code", 24000]]);
    expect((await listImageFolder(work, "")).entries).toEqual([]);

    await copy(w, games, ["DISK"], w.host, path.join(w.root, "out"));
    const [program] = tapFiles(new Uint8Array(fs.readFileSync(path.join(w.root, "out", "DISK.tap"))), "x");
    expect(program).toMatchObject({ kind: "basic", start: 10, data: PRINT_42 });

    await renameEntry(games, "GAME.BIN", "MAIN.BIN", w.deps);
    await deleteEntries(games, ["DISK"], w.deps);
    expect((await listImageFolder(games, "")).entries.map((e) => e.name)).toEqual(["MAIN.BIN"]);
    await expect(makeFolder(games, "", "X", w.deps)).rejects.toThrow(/\[fm:unsupported\]/);
  });
});

describe("what a copy refuses", () => {
  it("the folder it comes from, a folder into itself, a read-only target", async () => {
    const w = await world();
    const plan = (src: FmDriveRef, paths: string[], tgt: FmDriveRef, dir: string) =>
      planTransfer(request(w, src, paths, tgt, dir), src, tgt, w.deps);
    await expect(plan(w.host, [path.join(w.root, "src", "title.scr")], w.host, path.join(w.root, "src"))).rejects.toThrow(/\[fm:sameFolder\]/);
    await expect(plan(w.dsk, ["DISK"], w.dsk, "")).rejects.toThrow(/\[fm:sameFolder\]/);
    await expect(plan(w.host, [path.join(w.root, "src")], w.host, path.join(w.root, "src", "gfx"))).rejects.toThrow(/\[fm:intoItself\]/);
    await expect(plan(w.card, ["GAMES"], w.card, "GAMES/SUB")).rejects.toThrow(/\[fm:intoItself\]/);
    await expect(plan(w.host, [path.join(w.root, "src", "title.scr")], { ...w.dsk, readOnly: true }, "")).rejects.toThrow(/\[fm:readOnly\]/);
  });

  it("says when the files do not fit", async () => {
    const w = await world();
    fs.writeFileSync(path.join(w.root, "big.bin"), bytes(200 * 1024));
    const plan = await planTransfer(request(w, w.host, [path.join(w.root, "big.bin")], w.dsk, ""), w.host, w.dsk, w.deps);
    expect(plan.fits).toBe(false);
    expect(plan.needBytes).toBeGreaterThan(plan.freeBytes!);
  });
});

describe("conflicts", () => {
  async function conflicted () {
    const w = await world();
    fs.writeFileSync(path.join(w.root, "out", "title.scr"), "old");
    const plan = await planTransfer(request(w, w.host, [path.join(w.root, "src", "title.scr"), path.join(w.root, "src", "loader.bas")], w.host, path.join(w.root, "out")), w.host, w.host, w.deps);
    return { w, plan };
  }

  it("are found when planning", async () => {
    const { plan } = await conflicted();
    expect(plan.items.map((i) => [i.targetName, i.conflict])).toEqual([["title.scr", true], ["loader.bas", false]]);
  });

  it("are skipped unless answered", async () => {
    const { w, plan } = await conflicted();
    const result = await runTransfer(plan.id, {}, w.deps);
    expect(result).toMatchObject({ written: 1, skipped: 1 });
    expect(fs.readFileSync(path.join(w.root, "out", "title.scr"), "utf8")).toBe("old");
  });

  it("replace overwrites, rename writes beside", async () => {
    const replaced = await conflicted();
    await runTransfer(replaced.plan.id, { 0: { kind: "replace" } }, replaced.w.deps);
    expect(fs.statSync(path.join(replaced.w.root, "out", "title.scr")).size).toBe(6912);

    const renamed = await conflicted();
    await runTransfer(renamed.plan.id, { 0: { kind: "rename", name: "title (2).scr" } }, renamed.w.deps);
    expect(fs.readdirSync(path.join(renamed.w.root, "out")).sort()).toEqual(["loader.bas", "title (2).scr", "title.scr"]);
  });

  it("replace on a disk image removes the old file first", async () => {
    const w = await world();
    fs.writeFileSync(path.join(w.root, "GAME.BIN"), bytes(10));
    const plan = await planTransfer(request(w, w.host, [path.join(w.root, "GAME.BIN")], w.dsk, ""), w.host, w.dsk, w.deps);
    expect(plan.items[0].conflict).toBe(true);
    await runTransfer(plan.id, { 0: { kind: "replace" } }, w.deps);
    expect(diskOf(w.dsk.root).read("GAME.BIN")).toEqual(bytes(10));
  });
});

describe("moving, cancelling, a full disk", () => {
  it("a move removes each source once it was copied, for good", async () => {
    const w = await world();
    const { result } = await copy(w, w.host, [path.join(w.root, "src", "gfx")], w.host, path.join(w.root, "out"), { move: true });
    expect(result).toMatchObject({ written: 1, removeFailed: 0 });
    expect(fs.existsSync(path.join(w.root, "src", "gfx"))).toBe(false);
    expect(fs.existsSync(path.join(w.root, "out", "gfx", "font.bin"))).toBe(true);
    expect(w.trashed).toEqual([]);
  });

  it("a move on one volume is a rename: nothing is copied or trashed", async () => {
    const w = await world();
    const inode = fs.statSync(path.join(w.root, "src", "title.scr")).ino;
    const { result } = await copy(w, w.host, [path.join(w.root, "src", "title.scr"), path.join(w.root, "src", "gfx")], w.host, path.join(w.root, "out"), { move: true });
    expect(result).toMatchObject({ written: 2, removeFailed: 0 });
    expect(fs.statSync(path.join(w.root, "out", "title.scr")).ino).toBe(inode);
    expect(fs.existsSync(path.join(w.root, "out", "gfx", "font.bin"))).toBe(true);
    expect(fs.existsSync(path.join(w.root, "src", "gfx"))).toBe(false);
    expect(w.trashed).toEqual([]);
  });

  it("a move off a disk image deletes the files from it", async () => {
    const w = await world();
    await copy(w, w.dsk, ["GAME.BIN"], w.card, "", { move: true });
    expect(diskOf(w.dsk.root).list().map((e) => e.name)).toEqual(["DISK", "TITLE"]);
    expect(cardRead(w, "GAME.BIN")).toEqual(bytes(500));
  });

  it("a move keeps a source whose copy was skipped", async () => {
    const w = await world();
    fs.writeFileSync(path.join(w.root, "out", "title.scr"), "old");
    await copy(w, w.host, [path.join(w.root, "src", "title.scr")], w.host, path.join(w.root, "out"), { move: true });
    expect(fs.existsSync(path.join(w.root, "src", "title.scr"))).toBe(true);
  });

  it("a cancelled copy to a disk image writes nothing", async () => {
    const w = await world();
    const before = fs.readFileSync(w.trd.root);
    const plan = await planTransfer(request(w, w.dsk, ["DISK", "GAME.BIN", "TITLE"], w.trd, ""), w.dsk, w.trd, w.deps);
    cancelJob(plan.id);
    const result = await runTransfer(plan.id, {}, w.deps);
    expect(result).toMatchObject({ cancelled: true, written: 0 });
    expect(fs.readFileSync(w.trd.root)).toEqual(before);
    expect(jobStatus(plan.id)?.state).toBe("done");
  });

  it("a disk that fills stops the job and keeps none of it", async () => {
    const w = await world();
    const files = Array.from({ length: 4 }, (_, i) => {
      const p = path.join(w.root, `chunk${i}.bin`);
      fs.writeFileSync(p, bytes(60 * 1024, i));
      return p;
    });
    const before = fs.readFileSync(w.dsk.root);
    const plan = await planTransfer(request(w, w.host, files, w.dsk, ""), w.host, w.dsk, w.deps);
    const result = await runTransfer(plan.id, {}, w.deps);
    expect(result.aborted).toBe("diskFull");
    expect(result.written).toBe(0);
    expect(fs.readFileSync(w.dsk.root)).toEqual(before);
  });

  it("stops when a machine whose storage it uses starts, keeping nothing on a disk image", async () => {
    const w = await world();
    const before = fs.readFileSync(w.trd.root);
    const machineTrd = { ...w.trd, group: "machine" as const };
    const plan = await planTransfer(request(w, w.dsk, ["DISK", "GAME.BIN"], machineTrd, ""), w.dsk, machineTrd, w.deps);
    const result = await runTransfer(plan.id, {}, { ...w.deps, allowed: (d) => d.group !== "machine" });
    expect(result).toMatchObject({ aborted: "machineRunning", written: 0 });
    expect(fs.readFileSync(w.trd.root)).toEqual(before);
  });

  it("reports progress as it goes, and cannot run twice", async () => {
    const w = await world();
    const plan = await planTransfer(request(w, w.dsk, ["DISK", "GAME.BIN"], w.host, path.join(w.root, "out")), w.dsk, w.host, w.deps);
    expect(jobStatus(plan.id)).toMatchObject({ state: "planned", done: 0, total: 2 });
    await runTransfer(plan.id, {}, w.deps);
    expect(jobStatus(plan.id)).toMatchObject({ state: "done", done: 2, total: 2 });
    await expect(runTransfer(plan.id, {}, w.deps)).rejects.toThrow(/\[fm:failed\]/);
  });
});

describe("tape order (Phase 7)", () => {
  it("moves a file along a tape in one edit", async () => {
    const w = await world();
    const file = path.join(w.root, "order.tap");
    fs.writeFileSync(file, new Uint8Array(0));
    const tape = (await openImageDrives(file))[0];
    await copy(w, w.dsk, ["DISK", "GAME.BIN", "TITLE"], tape, "");
    await moveOnTape(tape, "TITLE", -1, w.deps);
    expect(tapFiles(new Uint8Array(fs.readFileSync(file)), "t").map((f) => f.name)).toEqual(["DISK", "TITLE", "GAME.BIN"]);
    await expect(moveOnTape(w.dsk, "DISK", 1, w.deps)).rejects.toThrow(/\[fm:unsupported\]/);
  });
});

describe("delete, new folder, rename", () => {
  it("delete: to the Trash on the host, for good on images, folders on a card with what is in them", async () => {
    const w = await world();
    const host = await deleteEntries(w.host, [path.join(w.root, "src", "gfx")], w.deps);
    expect(host).toEqual({ deleted: 1, failed: [] });
    expect(w.trashed).toEqual([path.join(w.root, "src", "gfx")]);

    await deleteEntries(w.dsk, ["GAME.BIN", "NOPE"], w.deps).then((r) => expect(r).toEqual({ deleted: 1, failed: [{ name: "NOPE", code: "notFound" }] }));
    expect(diskOf(w.dsk.root).list().map((e) => e.name)).toEqual(["DISK", "TITLE"]);

    await deleteEntries(w.card, ["GAMES"], w.deps);
    expect(cardFiles(w, "")).toEqual([]);
  });

  it("new folder: on the host and a card; a floppy has none", async () => {
    const w = await world();
    expect(await makeFolder(w.host, w.root, "new", w.deps)).toBe(path.join(w.root, "new"));
    expect(fs.statSync(path.join(w.root, "new")).isDirectory()).toBe(true);
    await expect(makeFolder(w.host, w.root, "new", w.deps)).rejects.toThrow(/\[fm:exists\]/);
    await expect(makeFolder(w.host, w.root, "a/b", w.deps)).rejects.toThrow(/\[fm:badName\]/);
    expect(await makeFolder(w.card, "GAMES", "ARCADE", w.deps)).toBe("GAMES/ARCADE");
    expect(cardFiles(w, "GAMES").map((f) => f[0])).toContain("GAMES/ARCADE");
    await expect(makeFolder(w.card, "", "games", w.deps)).rejects.toThrow(/\[fm:exists\]/);
    await expect(makeFolder(w.dsk, "", "X", w.deps)).rejects.toThrow(/\[fm:unsupported\]/);
  });

  it("rename: on the host, a disk image and a card", async () => {
    const w = await world();
    await renameEntry(w.host, path.join(w.root, "src", "title.scr"), "intro.scr", w.deps);
    expect(fs.existsSync(path.join(w.root, "src", "intro.scr"))).toBe(true);
    await expect(renameEntry(w.host, path.join(w.root, "src", "intro.scr"), "loader.bas", w.deps)).rejects.toThrow(/\[fm:exists\]/);
    await renameEntry(w.dsk, "GAME.BIN", "MAIN.BIN", w.deps);
    expect(diskOf(w.dsk.root).list().map((e) => e.name)).toContain("MAIN.BIN");
    expect(await renameEntry(w.card, "GAMES/Manic Miner.tap", "manic.tap", w.deps)).toBe("GAMES/manic.tap");
    expect(cardRead(w, "GAMES/manic.tap")).toEqual(bytes(4000));
  });
});
