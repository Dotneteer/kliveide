import { describe, expect, it } from "vitest";

import { createBlankDsk } from "@emu/machines/disk/blank-dsk";
import { buildDisk, sectorRun } from "@emu/machines/disk/disk-builder";
import { applySectorChangesToDiskContents, DSK_WHOLE_IMAGE_KEY } from "@emu/machines/disk/disk-changes";
import { readDiskData } from "@emu/machines/disk/disk-readers";
import { writeDiskData } from "@emu/machines/disk/disk-writer";
import type { Sp128TestSession } from "../../harness/sp128";
import { command, plus3WithDisks, programLine } from "./plus3Disk";

/*
 * Disk write-back end to end (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, A2/A3): what +3DOS
 * writes comes out of the machine as changes, the changes patch the image as the IDE patches the
 * file, and a second +3 finds the files on the patched image.
 */

/** Applies every change the machine published to a copy of the image */
function persisted (s: Sp128TestSession, image: Uint8Array): Uint8Array {
  s.runFrames(2);
  let contents = new Uint8Array(image);
  const changes = s.takeDiskChanges(0);
  if (changes) contents = new Uint8Array(applySectorChangesToDiskContents(contents, changes));
  return contents;
}

const listed = (lines: string[], name: string) => lines.some((l) => new RegExp(`^${name}\\s+\\.?\\s*\\dK$`).test(l));

describe("+3 disk write-back", () => {
  it("a file +3DOS saves is on the patched image", async () => {
    const image = createBlankDsk("ss");
    const s = await plus3WithDisks(image);
    programLine(s, "10 PRINT 42");
    expect(command(s, 'SAVE "test"')).toContain("0 OK, 0:1");
    const after = persisted(s, image);

    const second = await plus3WithDisks(after);
    expect(listed(command(second, "CAT"), "TEST")).toBe(true);
    expect(command(second, 'LOAD "test"')).toContain("0 OK, 0:1");
    expect(command(second, "RUN")).toContain("42");
  }, 180_000);

  it("a CPC data-format disk (sector IDs $C1..$C9) keeps what +3DOS saves", async () => {
    // --- The IDs at 100 and above, where the old write-back key landed on another track
    const image = writeDiskData(
      buildDisk({ cylinders: 40, sides: 1, track: () => ({ sectors: sectorRun(0xc1, 9) }) })
    );
    const s = await plus3WithDisks(image);
    expect(command(s, "CAT")).toContain("178K free");
    programLine(s, "10 PRINT 42");
    expect(command(s, 'SAVE "data"')).toContain("0 OK, 0:1");
    const after = persisted(s, image);
    expect(readDiskData(after).tracks.slice(1).every((t) => t.sectors.every((x) => x.R >= 0xc1))).toBe(true);

    const second = await plus3WithDisks(after);
    const cat = command(second, "CAT");
    expect(listed(cat, "DATA")).toBe(true);
    expect(cat).toContain("177K free");
  }, 180_000);

  it("the +3's FORMAT lays down the same disk as Create Disk", async () => {
    const unformatted = writeDiskData(buildDisk({ cylinders: 40, sides: 1, track: () => "unformatted" }));
    const s = await plus3WithDisks(unformatted);
    expect(command(s, 'FORMAT "a:"', 6000)).toContain("0 OK, 0:1");
    s.runFrames(2);
    const changes = s.takeDiskChanges(0)!;
    // --- A format changes the layout: the whole image comes back
    expect([...changes.keys()]).toEqual([DSK_WHOLE_IMAGE_KEY]);
    const formatted = readDiskData(changes.get(DSK_WHOLE_IMAGE_KEY)!);
    const created = readDiskData(createBlankDsk("sse"));
    expect(formatted.numTracks).toBe(created.numTracks);
    expect(formatted.numSides).toBe(created.numSides);
    formatted.tracks.forEach((track, t) => {
      expect(track.sectors.map((x) => [x.C, x.H, x.R, x.N])).toEqual(created.tracks[t].sectors.map((x) => [x.C, x.H, x.R, x.N]));
      track.sectors.forEach((x, i) => expect(x.sectorData).toEqual(created.tracks[t].sectors[i].sectorData));
    });

    // --- And the formatted image works on its own
    const second = await plus3WithDisks(changes.get(DSK_WHOLE_IMAGE_KEY)!);
    expect(command(second, "CAT")).toContain("173K free");
  }, 300_000);
});
