import { describe, expect, it } from "vitest";

import { MicrodriveFileSystem } from "@common/diskfs/mdrfs";
import { diskImageKind, openDiskFileSystem } from "@common/diskfs/open";
import { DiskFsError } from "@common/diskfs/types";
import { createBlankMdr, createFormattedMdr, readMdrCatalog, readMdrSector } from "@emu/machines/microdrive/mdrImage";

/* The Microdrive file system (`.plans/MICRODRIVE_PLAN.md` Phase 3.2) */

describe("MicrodriveFileSystem", () => {
  it("opens an .mdr by its name", () => {
    expect(diskImageKind("games.mdr")).toBe("mdr");
    const fs = openDiskFileSystem(createFormattedMdr("GAMES"), "games.mdr");
    expect(fs.system).toBe("microdrive");
    expect(fs.info()).toMatchObject({ system: "Microdrive", label: "GAMES", freeBytes: 254 * 512, blockSize: 512 });
  });

  it("refuses an unformatted cartridge and a QL image", () => {
    expect(() => new MicrodriveFileSystem(createBlankMdr())).toThrow(DiskFsError);
    expect(() => new MicrodriveFileSystem(new Uint8Array(255 * 686))).toThrow(/QL/);
  });

  it("writes BASIC, CODE and arrays as SAVE * would, and reads them back", () => {
    const fs = new MicrodriveFileSystem(createFormattedMdr("T"));
    const program = Uint8Array.from([0, 10, 5, 0, 0xf5, 0x22, 0x41, 0x22, 0x0d]);
    fs.write({ name: "run", kind: "basic", data: program, start: 10, variablesOffset: program.length });
    fs.write({ name: "game", kind: "code", data: new Uint8Array(1000).fill(7), start: 32768 });
    fs.write({ name: "scores", kind: "numberArray", data: new Uint8Array(8), variableName: "s" });
    const files = fs.list();
    expect(files.map((f) => [f.name, f.kind, f.size, f.start])).toEqual([
      ["game", "code", 1000, 32768],
      ["run", "basic", 9, 10],
      ["scores", "numberArray", 8, undefined]
    ]);
    expect(files.find((f) => f.name === "scores")!.variableName).toBe("s");
    expect(fs.read("run")).toEqual(program);
    // --- The header as the ROM fills HD_00..HD_11: a program's start is PROG with the IF1's variables
    expect(readMdrCatalog(fs.image()).files.find((f) => f.name === "run")!.header).toEqual({
      type: 0,
      length: 9,
      start: 23813,
      programLength: 9,
      autorun: 10
    });
    expect(readMdrCatalog(fs.image()).files.find((f) => f.name === "game")!.header!.autorun).toBe(0xffff);
  });

  it("a raw file is a PRINT # stream, with no header", () => {
    const fs = new MicrodriveFileSystem(createFormattedMdr("T"));
    fs.write({ name: "notes", kind: "raw", data: Uint8Array.from([0x68, 0x69, 0x0d]) });
    expect(fs.list()[0]).toMatchObject({ name: "notes", kind: "raw", size: 3 });
    expect(readMdrSector(fs.image(), 0).record!.saved).toBe(false);
  });

  it("checks names and room", () => {
    const fs = new MicrodriveFileSystem(createFormattedMdr("T", 2));
    expect(() => fs.write({ name: "", kind: "raw", data: new Uint8Array(1) })).toThrow(DiskFsError);
    expect(() => fs.write({ name: "elevenchars", kind: "raw", data: new Uint8Array(1) })).toThrow(/1-10/);
    fs.write({ name: "a", kind: "raw", data: new Uint8Array(1) });
    expect(() => fs.write({ name: "a", kind: "raw", data: new Uint8Array(1) })).toThrow(/already/);
    expect(() => fs.write({ name: "big", kind: "raw", data: new Uint8Array(600) })).toThrow(/no room/);
  });

  it("deletes as ERASE does and renames every record", () => {
    const fs = new MicrodriveFileSystem(createFormattedMdr("T"));
    fs.write({ name: "a", kind: "code", data: new Uint8Array(2000), start: 40000 });
    fs.rename("a", "b");
    expect(fs.list().map((f) => f.name)).toEqual(["b"]);
    expect(fs.read("b").length).toBe(2000);
    fs.delete("b");
    expect(fs.list()).toEqual([]);
    expect(fs.info().freeBytes).toBe(254 * 512);
    expect(() => fs.read("b")).toThrow(/not on the cartridge/);
  });

  it("lays the slots out as one track, files where they are", () => {
    const fs = new MicrodriveFileSystem(createFormattedMdr("T"));
    fs.write({ name: "a", kind: "raw", data: new Uint8Array(600) });
    const layout = fs.layout();
    expect(layout.size).toBe(254);
    expect(layout.get(0)).toEqual({ role: "file", file: "a" });
    expect(layout.get(1)).toEqual({ role: "file", file: "a" });
    expect(layout.get(2)).toEqual({ role: "free" });
  });

  it("renames the cartridge", () => {
    const fs = new MicrodriveFileSystem(createFormattedMdr("OLD"));
    fs.setLabel("NEW");
    expect(fs.info().label).toBe("NEW");
  });
});
