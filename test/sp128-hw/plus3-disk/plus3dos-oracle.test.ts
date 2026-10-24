import { describe, expect, it } from "vitest";

import { Plus3DosFileSystem } from "@common/diskfs/plus3dos";
import { applySectorChangesToDiskContents } from "@emu/machines/disk/disk-changes";
import { createBlankDsk } from "@emu/machines/disk/blank-dsk";
import type { Sp128TestSession } from "../../harness/sp128";
import { PRINT_42 } from "../../diskfs/fixtures";
import { command, memory, plus3WithDisks, programLine } from "./plus3Disk";

/*
 * +3DOS judged by the +3 (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, D9, B1/B2): what Klive
 * writes, the +3 lists and loads; what the +3 writes, Klive lists and reads.
 */

const bytes = (n: number, seed = 0) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + seed) & 0xff);

/** The image after the machine's writes */
function persisted (s: Sp128TestSession, image: Uint8Array): Uint8Array {
  s.runFrames(2);
  const changes = s.takeDiskChanges(0);
  return changes ? new Uint8Array(applySectorChangesToDiskContents(new Uint8Array(image), changes)) : image;
}

describe("+3DOS: Klive writes, the +3 reads", () => {
  it.each(["ss", "dse80"] as const)("%s: the +3 lists Klive's files and loads them", async (type) => {
    const fs3 = new Plus3DosFileSystem(createBlankDsk(type));
    fs3.write({ name: "game", kind: "basic", data: PRINT_42, start: 10 });
    fs3.write({ name: "bin", kind: "code", data: bytes(3000, 9), start: 40000 });
    fs3.write({ name: "big", kind: "code", data: bytes(20_000, 1), start: 32768 });
    const s = await plus3WithDisks(fs3.image());

    const cat = command(s, "CAT");
    const block = type === "dse80" ? 2 : 1;
    const k = (n: number) => `${Math.ceil(n / block) * block}K`;
    expect(cat.some((l) => new RegExp(`^GAME\\s+\\.?\\s*${k(1)}$`).test(l))).toBe(true);
    expect(cat.some((l) => new RegExp(`^BIN\\s+\\.?\\s*${k(4)}$`).test(l))).toBe(true);
    expect(cat.some((l) => new RegExp(`^BIG\\s+\\.?\\s*${k(20)}$`).test(l))).toBe(true);
    expect(cat).toContain(`${fs3.info().freeBytes / 1024}K free`);

    // --- The BASIC program starts itself at line 10
    expect(command(s, 'LOAD "game"')).toEqual(expect.arrayContaining(["42", "0 OK, 10:1"]));
    expect(command(s, 'LOAD "bin" CODE')).toContain("0 OK, 0:1");
    expect(memory(s, 40000, 3000)).toEqual(Array.from(bytes(3000, 9)));
    expect(command(s, 'LOAD "big" CODE')).toContain("0 OK, 0:1");
    expect(memory(s, 32768, 20_000)).toEqual(Array.from(bytes(20_000, 1)));
  }, 240_000);

  it("the +3 no longer finds a file Klive deleted, and finds a renamed one", async () => {
    const fs3 = new Plus3DosFileSystem(createBlankDsk("ss"));
    fs3.write({ name: "game", kind: "basic", data: PRINT_42, start: 10 });
    fs3.write({ name: "bin", kind: "code", data: bytes(100), start: 40000 });
    fs3.delete("bin");
    fs3.rename("game", "start");
    const s = await plus3WithDisks(fs3.image());
    const cat = command(s, "CAT");
    expect(cat.some((l) => l.startsWith("BIN"))).toBe(false);
    expect(cat.some((l) => /^START\s+\.?\s*1K$/.test(l))).toBe(true);
    expect(cat).toContain("172K free");
  }, 180_000);
});

describe("+3DOS: the +3 writes, Klive reads", () => {
  it("lists a program, a code block and an array the +3 saved", async () => {
    const image = createBlankDsk("ss");
    const s = await plus3WithDisks(image);
    programLine(s, "10 PRINT 42");
    expect(command(s, 'SAVE "game" LINE 10')).toContain("0 OK, 0:1");
    // --- 120 bytes, not 100: typing loses a doubled key
    for (let i = 0; i < 120; i++) s.poke(32768 + i, [(i * 3) & 0xff]);
    expect(command(s, 'SAVE "bin" CODE 32768,120')).toContain("0 OK, 0:1");
    expect(command(s, "DIM a(3): LET a(2)=5")).toContain("0 OK, 0:2");
    // --- Not "arr": a key typed twice in a row is read once
    expect(command(s, 'SAVE "vals" DATA a()')).toContain("0 OK, 0:1");

    const fs3 = new Plus3DosFileSystem(persisted(s, image));
    const files = fs3.list();
    expect(files.map((f) => [f.name, f.kind])).toEqual([
      ["GAME", "basic"],
      ["BIN", "code"],
      ["VALS", "numberArray"]
    ]);
    expect(files[0]).toMatchObject({ start: 10, size: PRINT_42.length, variablesOffset: PRINT_42.length });
    expect(fs3.read("game")).toEqual(PRINT_42);
    expect([files[1].start, files[1].size]).toEqual([32768, 120]);
    expect(Array.from(fs3.read("bin"))).toEqual(Array.from({ length: 120 }, (_, i) => (i * 3) & 0xff));
    expect(files[2]).toMatchObject({ variableName: "a", size: 18 });
    expect(fs3.info().freeBytes).toBe(170 * 1024);
  }, 240_000);
});
