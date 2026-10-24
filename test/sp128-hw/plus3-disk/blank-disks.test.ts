import { describe, expect, it } from "vitest";

import { BLANK_DSK_TYPES, createBlankDsk } from "@emu/machines/disk/blank-dsk";
import { readDiskData } from "@emu/machines/disk/disk-readers";
import { command, plus3WithDisks, programLine } from "./plus3Disk";

/*
 * The blank disks Create Disk writes (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, A2), judged by
 * +3DOS itself: the +3 must log each one in from its disk specification, report the free space
 * its geometry gives, and save and load a file on it.
 *
 * Free space: (data tracks x 4.5K) in whole blocks, less the directory blocks.
 *   40 x 1: 39 tracks  -> 175 1K blocks - 2 = 173K
 *   40 x 2: 79 tracks  -> 355 1K blocks - 2 = 353K
 *   80 x 2: 159 tracks -> 357 2K blocks - 4 = 706K
 */
const FREE: Record<string, string> = { ss: "173K free", sse: "173K free", ds: "353K free", dse: "353K free", dse80: "706K free" };

describe("blank +3 disks", () => {
  it.each(BLANK_DSK_TYPES)("%s has its geometry", (type) => {
    const disk = readDiskData(createBlankDsk(type));
    const tracks = type === "dse80" ? 80 : 40;
    expect(disk.numTracks).toBe(tracks);
    expect(disk.numSides).toBe(type === "ss" || type === "sse" ? 1 : 2);
    expect(disk.tracks.length).toBe(tracks * disk.numSides);
    expect(disk.tracks.every((t) => t.sectors.map((s) => s.R).join() === "1,2,3,4,5,6,7,8,9")).toBe(true);
  });

  it.each(BLANK_DSK_TYPES)("%s: +3DOS reports the free space of an empty disk", async (type) => {
    const s = await plus3WithDisks(createBlankDsk(type));
    const lines = command(s, "CAT");
    expect(lines).toContain(FREE[type]);
    expect(lines.some((l) => l.startsWith("0 OK"))).toBe(true);
  }, 120_000);

  it.each(["ss", "dse80"])("%s: a program saved on it is listed and loads back", async (type) => {
    const s = await plus3WithDisks(createBlankDsk(type));
    programLine(s, "10 PRINT 42");
    expect(command(s, 'SAVE "test"')).toContain("0 OK, 0:1");
    // --- One block: 1K on the 173K format, 2K on the 720K one
    const size = type === "dse80" ? "2K" : "1K";
    expect(command(s, "CAT").some((l) => new RegExp(`^TEST\\s+\\.?\\s*${size}$`).test(l))).toBe(true);
    // --- Another program in memory, then the saved one back
    programLine(s, "10 PRINT 7");
    expect(command(s, 'LOAD "test"')).toContain("0 OK, 0:1");
    expect(command(s, "RUN")).toContain("42");
  }, 180_000);
});
