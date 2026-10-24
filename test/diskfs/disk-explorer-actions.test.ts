import { describe, expect, it } from "vitest";

import { Plus3DosFileSystem } from "@common/diskfs/plus3dos";
import { TrdosFileSystem } from "@common/diskfs/trdos";
import { createBlankDsk } from "@emu/machines/disk/blank-dsk";
import { createBlankTrd } from "@emu/machines/disk/trd/trdImage";
import {
  addHostFiles,
  compactDisk,
  deleteFiles,
  extractFile,
  renameFile,
  type DiskExplorerPorts
} from "@renderer/appIde/DocumentPanels/DiskExplorer/diskExplorerActions";
import { analyzeDiskImage } from "@renderer/appIde/DocumentPanels/DiskExplorer/diskExplorerModel";

/*
 * The Disk Explorer's flows (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B4) through fake ports: a
 * disk "file" in memory, a machine that may be paused, and the user's answers.
 */

function harness (fileName: string, image: Uint8Array, answers: Partial<DiskExplorerPorts> = {}) {
  const state = {
    file: image,
    paused: 0,
    resumed: 0,
    reloads: 0,
    failures: [] as { code: string }[],
    host: new Map<string, Uint8Array>(),
    reinserted: 0
  };
  const ports: DiskExplorerPorts = {
    beginEdit: async () => {
      state.paused++;
      return { contents: state.file, drive: 0, resume: true };
    },
    commitEdit: async (_p, contents, start) => {
      state.file = contents;
      if (start.drive !== undefined) state.reinserted++;
      if (start.resume) state.resumed++;
    },
    cancelEdit: async (start) => {
      if (start.resume) state.resumed++;
    },
    reload: async () => {
      state.reloads++;
    },
    pickHostFile: async () => undefined,
    readHostFile: async (p) => state.host.get(p)!,
    pickSavePath: async (name) => `/out/${name}`,
    writeHostFile: async (p, c) => {
      state.host.set(p, c);
    },
    confirm: async () => true,
    askName: async () => undefined,
    askCodeStart: async () => 32768,
    reportFailure: (f) => state.failures.push(f),
    ...answers
  };
  return { state, ports, fileName };
}

describe("Disk Explorer actions", () => {
  it("adds host files to a mounted, running disk: paused, written, re-inserted, resumed", async () => {
    const h = harness("/p/game.dsk", createBlankDsk("ss"));
    h.state.host.set("/h/loader.bas", new TextEncoder().encode("10 PRINT 42"));
    h.state.host.set("/h/title.scr", new Uint8Array(6912));
    h.state.host.set("/h/code.bin", new Uint8Array(500));
    expect(await addHostFiles(h.ports, h.fileName, "+3dos", [], ["/h/loader.bas", "/h/title.scr", "/h/code.bin"])).toBe(true);
    expect(h.state).toMatchObject({ paused: 1, resumed: 1, reinserted: 1, reloads: 1 });
    const files = new Plus3DosFileSystem(h.state.file).list();
    expect(files.map((f) => [f.name, f.kind, f.start])).toEqual([
      ["LOADER", "basic", undefined],
      ["TITLE.SCR", "code", 16384],
      ["CODE.BIN", "code", 32768]
    ]);
  });

  it("replaces a file of the same name only when the user agrees", async () => {
    const image = new Plus3DosFileSystem(createBlankDsk("ss"));
    image.write({ name: "CODE.BIN", kind: "code", data: new Uint8Array(10), start: 1 });
    const no = harness("/p/a.dsk", image.image(), { confirm: async () => false });
    no.state.host.set("/h/code.bin", new Uint8Array(20));
    expect(await addHostFiles(no.ports, no.fileName, "+3dos", analyzeDiskImage(no.state.file, no.fileName).files, ["/h/code.bin"])).toBe(false);
    expect(no.state.paused).toBe(0);

    const yes = harness("/p/a.dsk", image.image());
    yes.state.host.set("/h/code.bin", new Uint8Array(20));
    expect(await addHostFiles(yes.ports, yes.fileName, "+3dos", analyzeDiskImage(yes.state.file, yes.fileName).files, ["/h/code.bin"])).toBe(true);
    expect(new Plus3DosFileSystem(yes.state.file).list().map((f) => [f.name, f.size, f.start])).toEqual([["CODE.BIN", 20, 32768]]);
  });

  it("abandons a refused edit and still resumes the machine", async () => {
    const h = harness("/p/full.trd", createBlankTrd({ cylinders: 40, sides: 1 }));
    h.state.host.set("/h/huge.bin", new Uint8Array(200_000));
    expect(await addHostFiles(h.ports, h.fileName, "trdos", [], ["/h/huge.bin"])).toBe(false);
    expect(h.state.failures).toEqual([{ code: "diskFull", args: expect.anything() }]);
    expect(h.state).toMatchObject({ paused: 1, resumed: 1, reloads: 0 });
  });

  it("deletes, renames, compacts and extracts on a TR-DOS disk", async () => {
    const trd = new TrdosFileSystem(createBlankTrd({ cylinders: 80, sides: 2 }));
    trd.write({ name: "one", kind: "code", data: new Uint8Array(600).fill(1), start: 30000 });
    trd.write({ name: "two", kind: "code", data: new Uint8Array(300).fill(2), start: 40000 });
    const h = harness("/p/d.trd", trd.image(), { askName: async () => "second.C" });
    expect(await deleteFiles(h.ports, h.fileName, ["one.C"])).toBe(true);
    expect(await renameFile(h.ports, h.fileName, "two.C")).toBe(true);
    expect(await compactDisk(h.ports, h.fileName)).toBe(true);
    const model = analyzeDiskImage(h.state.file, h.fileName);
    expect(model.files.map((f) => f.name)).toEqual(["second.C"]);
    expect(model.files[0].sectors[0]).toEqual({ trackIndex: 1, sectorIndex: 0 });
    expect(await extractFile(h.ports, h.fileName, h.state.file, model.files[0])).toBe(true);
    expect(h.state.host.get("/out/second.C")).toEqual(new Uint8Array(300).fill(2));
  });

  it("keeps an .scl an .scl", async () => {
    const trd = new TrdosFileSystem(createBlankTrd({ cylinders: 80, sides: 2 }));
    trd.write({ name: "one", kind: "code", data: new Uint8Array(10), start: 30000 });
    const h = harness("/p/d.scl", trd.scl());
    h.state.host.set("/h/two.bin", new Uint8Array(10));
    expect(await addHostFiles(h.ports, h.fileName, "trdos", [], ["/h/two.bin"])).toBe(true);
    expect(String.fromCharCode(...h.state.file.subarray(0, 8))).toBe("SINCLAIR");
    expect(analyzeDiskImage(h.state.file, h.fileName).files.map((f) => f.name)).toEqual(["one.C", "two.C"]);
  });
});

describe("Disk Explorer model", () => {
  it("maps a +3 disk's sectors to their files", () => {
    const fs3 = new Plus3DosFileSystem(createBlankDsk("ss"));
    fs3.write({ name: "game", kind: "code", data: new Uint8Array(3000), start: 32768 });
    const model = analyzeDiskImage(fs3.image(), "a.dsk");
    expect(model).toMatchObject({ kind: "dsk", system: "+3dos", cylinders: 40, sides: 1 });
    const fileSectors = model.tracks.flatMap((t) => t.sectors).filter((s) => s.role.role === "file");
    expect(fileSectors.length).toBe(8);
    expect(model.tracks[0].sectors[0].role).toEqual({ role: "system" });
  });

  it("shows an unformatted disk's layout with the reason it has no files", async () => {
    const { buildDisk } = await import("@emu/machines/disk/disk-builder");
    const { writeDiskData } = await import("@emu/machines/disk/disk-writer");
    const model = analyzeDiskImage(writeDiskData(buildDisk({ cylinders: 2, sides: 1, track: () => "unformatted" })), "u.dsk");
    expect(model.fsError?.code).toBe("unformatted");
    expect(model.tracks.every((t) => t.unformatted)).toBe(true);
  });
});
