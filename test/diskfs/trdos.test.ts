import { describe, expect, it } from "vitest";

import { TrdosFileSystem, trdCounters } from "@common/diskfs/trdos";
import { createBlankTrd, isSclImage } from "@emu/machines/disk/trd/trdImage";
import { PRINT_42 } from "./fixtures";

/*
 * TR-DOS (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B3). The real TR-DOS ROM cannot ship, so its
 * view of these disks is checked only where the user's ROM is at hand (KLIVE_TRDOS_ROM).
 */

const bytes = (n: number, seed = 0) => Uint8Array.from({ length: n }, (_, i) => (i * 5 + seed) & 0xff);
const blank = () => createBlankTrd({ cylinders: 80, sides: 2 }, "KLIVE");

describe("TR-DOS file system", () => {
  it("reads an empty disk", () => {
    const trd = new TrdosFileSystem(blank());
    expect(trd.info()).toMatchObject({ system: "TR-DOS", format: "80 x 2", label: "KLIVE", freeBytes: 159 * 16 * 256 });
    expect(trd.list()).toEqual([]);
  });

  it("writes files and reads them back", () => {
    const trd = new TrdosFileSystem(blank());
    trd.write({ name: "boot", kind: "basic", data: PRINT_42, start: 10 });
    trd.write({ name: "game", kind: "code", data: bytes(3000), start: 24576 });
    const again = new TrdosFileSystem(trd.image());
    expect(again.list().map((f) => [f.name, f.kind, f.size, f.start, f.allocated])).toEqual([
      ["boot.B", "basic", 14, 10, 256],
      ["game.C", "code", 3000, 24576, 3072]
    ]);
    expect(again.read("boot.B")).toEqual(PRINT_42);
    expect(again.read("game")).toEqual(bytes(3000));
  });

  it("deletes by marking, and compaction gives the space back", () => {
    const trd = new TrdosFileSystem(blank());
    trd.write({ name: "one", kind: "code", data: bytes(1000) });
    trd.write({ name: "two", kind: "code", data: bytes(2000, 1) });
    trd.write({ name: "three", kind: "code", data: bytes(500, 2) });
    const free = trd.info().freeBytes;
    trd.delete("two.C");
    expect(trdCounters(trd.image())).toMatchObject({ files: 3, deleted: 1 });
    expect(trd.info().freeBytes).toBe(free);
    expect(trd.list().map((f) => f.name)).toEqual(["one.C", "three.C"]);
    expect(trd.list({ deleted: true }).length).toBe(3);

    trd.compact();
    expect(trdCounters(trd.image())).toMatchObject({ files: 2, deleted: 0, firstFree: 16 + 4 + 2 });
    expect(trd.info().freeBytes).toBe(free + 8 * 256);
    expect(trd.read("three.C")).toEqual(bytes(500, 2));
    expect(trd.layout().get(1 * 256 + 4)).toEqual({ role: "file", file: "three.C" });
  });

  it("renames, labels, and refuses duplicates and bad names", () => {
    const trd = new TrdosFileSystem(blank());
    trd.write({ name: "one", kind: "code", data: bytes(10) });
    trd.write({ name: "two", kind: "code", data: bytes(10) });
    trd.rename("one.C", "first.C");
    expect(() => trd.rename("two.C", "first.C")).toThrow(expect.objectContaining({ code: "exists" }));
    expect(() => trd.write({ name: "toolongname", kind: "code", data: bytes(1) })).toThrow(expect.objectContaining({ code: "badName" }));
    expect(() => trd.setAttributes("two.C", { readOnly: true })).toThrow(expect.objectContaining({ code: "unsupported" }));
    trd.setLabel("GAMES");
    const again = new TrdosFileSystem(trd.image());
    expect(again.list().map((f) => f.name)).toEqual(["first.C", "two.C"]);
    expect(again.info().label).toBe("GAMES");
  });

  it("opens an .scl and writes one back", () => {
    const trd = new TrdosFileSystem(blank());
    trd.write({ name: "game", kind: "code", data: bytes(700), start: 32768 });
    const scl = trd.scl();
    expect(isSclImage(scl)).toBe(true);
    const fromScl = new TrdosFileSystem(scl);
    expect(fromScl.list().map((f) => [f.name, f.size])).toEqual([["game.C", 700]]);
    expect(fromScl.read("game.C")).toEqual(bytes(700));
  });

  it("refuses a full disk", () => {
    const trd = new TrdosFileSystem(createBlankTrd({ cylinders: 40, sides: 1 }));
    expect(() => trd.write({ name: "huge", kind: "code", data: bytes(160_000) })).toThrow(expect.objectContaining({ code: "diskFull" }));
  });
});
