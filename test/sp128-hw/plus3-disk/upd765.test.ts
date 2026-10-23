import { describe, expect, it } from "vitest";

import { writeDiskData } from "@emu/machines/disk/disk-writer";
import type { ZxSpectrumP3eWasmV2Machine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine";
import { corpusDisk, pattern } from "../../disk/dskCorpus";
import { createSp128Session } from "../../harness/sp128";
import { ORACLE_MODEL } from "./plus3Disk";

/*
 * The +3's uPD765 over the per-sector disk model (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, A3),
 * driven through its ports on the corpus disks. The expected results come from the controller's
 * data sheet (`_input/765.pdf`): sectors found by their whole ID, runs to EOT ending with End of
 * Cylinder (the +3 has no TC), the dump's status bytes reproduced.
 */

const MSR = 0x2ffd;
const DATA = 0x3ffd;

type FdcResult = { data: number[]; st0: number; st1: number; st2: number; chrn: number[] };

/** A +3 with the disk in drive A and its motor up to speed */
async function plus3Fdc (disk: Uint8Array, writeProtected = false) {
  const s = await createSp128Session(ORACLE_MODEL);
  const machine = s.machine as ZxSpectrumP3eWasmV2Machine;
  if (writeProtected) machine.setMachineProperty("DiskAWp", true);
  s.insertDisk(0, disk);
  const exports = machine.wasmV2Runtime!.exports;
  exports.spp3eWritePort(0x1ffd, 0x08);
  for (let i = 0; i < 200 && !exports.spp3eDiskGetReady(0); i++) exports.spp3eExecuteFrame();
  const out = (value: number) => exports.spp3eWritePort(DATA, value);
  const inp = () => exports.spp3eReadPort(DATA);
  const phase = () => exports.spp3eFdcGetOperationPhase();

  /** Sends a command and, while it executes, reads its data (or writes `write`'s bytes) */
  const run = (bytes: number[], write?: number[]): FdcResult => {
    bytes.forEach(out);
    const data: number[] = [];
    let written = 0;
    for (let guard = 0; phase() === 1 && guard < 200_000; guard++) {
      if ((exports.spp3eReadPort(MSR) & 0x40) !== 0) data.push(inp());
      else out(write?.[written++] ?? 0);
    }
    const result: number[] = [];
    while (phase() === 2) result.push(inp());
    return { data, st0: result[0], st1: result[1], st2: result[2], chrn: result.slice(3, 7) };
  };
  return { s, machine, exports, run };
}

const readData = (c: number, h: number, r: number, n: number, eot: number, command = 0x46) =>
  [command, h << 2, c, h, r, n, eot, 0x2a, 0xff];
const seek = (cylinder: number) => [0x0f, 0x00, cylinder];

describe("uPD765 READ DATA", () => {
  it("reads one sector and ends past EOT with End of Cylinder (no TC on the +3)", async () => {
    const fdc = await plus3Fdc(writeDiskData(corpusDisk("plus3-format0")));
    fdc.run(seek(2));
    const result = fdc.run(readData(2, 0, 5, 2, 5));
    expect(result.data).toEqual(Array.from(pattern(2, 0, 5, 512)));
    expect(result).toMatchObject({ st0: 0x40, st1: 0x80, st2: 0x00, chrn: [3, 0, 1, 2] });
  }, 60_000);

  it("runs from R to EOT, sector after sector", async () => {
    const fdc = await plus3Fdc(writeDiskData(corpusDisk("interleaved")));
    const result = fdc.run(readData(0, 0, 3, 2, 6));
    expect(result.data.length).toBe(4 * 512);
    for (let r = 3; r <= 6; r++) {
      expect(result.data.slice((r - 3) * 512, (r - 2) * 512)).toEqual(Array.from(pattern(0, 0, r, 512)));
    }
    expect(result.st1).toBe(0x80);
  }, 60_000);

  it("finds CPC data sectors (R = $C1..$C9) on their own track", async () => {
    const fdc = await plus3Fdc(writeDiskData(corpusDisk("cpc-data")));
    fdc.run(seek(4));
    const result = fdc.run(readData(4, 0, 0xc9, 2, 0xc9));
    expect(result.data).toEqual(Array.from(pattern(4, 0, 0xc9, 512)));
  }, 60_000);

  it("reads sectors of mixed sizes at their own sizes", async () => {
    const fdc = await plus3Fdc(writeDiskData(corpusDisk("mixed-sizes")));
    fdc.run(seek(1));
    expect(fdc.run(readData(1, 0, 3, 3, 3)).data).toEqual(Array.from(pattern(1, 0, 3, 1024)));
    expect(fdc.run(readData(1, 0, 4, 0, 4)).data).toEqual(Array.from(pattern(1, 0, 4, 128)));
  }, 60_000);

  it("reports No Data for a missing sector, and Wrong Cylinder for a foreign ID", async () => {
    const fdc = await plus3Fdc(writeDiskData(corpusDisk("foreign-ids")));
    expect(fdc.run(readData(0, 0, 12, 2, 12))).toMatchObject({ st0: 0x40, st1: 0x04, st2: 0x00, data: [] });
    fdc.run(seek(7));
    // --- Track 7's IDs say cylinder 9, head 1: asking for C = 7 finds R, but not the cylinder
    expect(fdc.run(readData(7, 0, 3, 2, 3))).toMatchObject({ st0: 0x40, st1: 0x04, st2: 0x10 });
    const found = fdc.run([0x46, 0x00, 9, 1, 3, 2, 3, 0x2a, 0xff]);
    expect(found.data).toEqual(Array.from(pattern(7, 0, 3, 512)));
  }, 60_000);

  it("reproduces a data CRC error the dump recorded", async () => {
    const fdc = await plus3Fdc(writeDiskData(corpusDisk("status-bytes")));
    fdc.run(seek(6));
    const result = fdc.run(readData(6, 0, 7, 2, 9));
    expect(result.data).toEqual(Array.from(pattern(6, 0, 7, 512)));
    expect(result).toMatchObject({ st0: 0x40, st1: 0x20, st2: 0x20, chrn: [6, 0, 7, 2] });
  }, 60_000);

  it("reads a deleted sector with Control Mark, or skips it with SK", async () => {
    const fdc = await plus3Fdc(writeDiskData(corpusDisk("status-bytes")));
    fdc.run(seek(6));
    // --- SK = 0: sector 4 is read, CM is set and the run stops after it
    const read = fdc.run(readData(6, 0, 3, 2, 6));
    expect(read.data.length).toBe(2 * 512);
    expect(read.st2 & 0x40).toBe(0x40);
    // --- SK = 1: sector 4 is skipped, the run goes on to EOT
    const skipped = fdc.run(readData(6, 0, 3, 2, 6, 0x66));
    expect(skipped.data.length).toBe(3 * 512);
    expect(skipped.data.slice(512, 1024)).toEqual(Array.from(pattern(6, 0, 5, 512)));
    // --- READ DELETED DATA reads the deleted one
    const deleted = fdc.run(readData(6, 0, 4, 2, 4, 0x4c));
    expect(deleted.data).toEqual(Array.from(pattern(6, 0, 4, 512)));
    expect(deleted.st2 & 0x40).toBe(0);
  }, 60_000);

  it("gives a weak sector's copies in turn", async () => {
    const fdc = await plus3Fdc(writeDiskData(corpusDisk("weak-sectors")));
    fdc.run(seek(4));
    const reads = [0, 1, 2, 3].map(() => fdc.run(readData(4, 0, 3, 2, 3)).data);
    expect(reads[0]).toEqual(Array.from(pattern(4, 0, 3, 512, 0)));
    expect(reads[1]).toEqual(Array.from(pattern(4, 0, 3, 512, 1)));
    expect(reads[2]).toEqual(Array.from(pattern(4, 0, 3, 512, 2)));
    expect(reads[3]).toEqual(reads[0]);
  }, 60_000);

  it("reads side 1 with MT after side 0's EOT", async () => {
    const fdc = await plus3Fdc(writeDiskData(corpusDisk("ds80")));
    fdc.run(seek(10));
    const result = fdc.run(readData(10, 0, 9, 2, 9, 0xc6));
    expect(result.data.slice(0, 512)).toEqual(Array.from(pattern(10, 0, 9, 512)));
    expect(result.data.slice(512, 1024)).toEqual(Array.from(pattern(10, 1, 1, 512)));
    expect(result.data.length).toBe(10 * 512);
    expect(result.chrn).toEqual([11, 0, 1, 2]);
  }, 60_000);
});

describe("uPD765 READ ID, READ TRACK, SCAN", () => {
  it("READ ID gives the track's IDs in physical order", async () => {
    const fdc = await plus3Fdc(writeDiskData(corpusDisk("interleaved")));
    const ids = Array.from({ length: 10 }, () => fdc.run([0x4a, 0x00]).chrn[2]);
    expect(ids).toEqual([1, 6, 2, 7, 3, 8, 4, 9, 5, 1]);
  }, 60_000);

  it("READ ID reports a missing address mark on an unformatted track", async () => {
    const fdc = await plus3Fdc(writeDiskData(corpusDisk("unformatted-tracks")));
    fdc.run(seek(39));
    expect(fdc.run([0x4a, 0x00])).toMatchObject({ st0: 0x40, st1: 0x01 });
  }, 60_000);

  it("READ TRACK reads the sectors in physical order", async () => {
    const fdc = await plus3Fdc(writeDiskData(corpusDisk("interleaved")));
    const result = fdc.run([0x42, 0x00, 0, 0, 1, 2, 3, 0x2a, 0xff]);
    expect(result.data.length).toBe(3 * 512);
    expect(result.data.slice(512, 1024)).toEqual(Array.from(pattern(0, 0, 6, 512)));
  }, 60_000);

  it("SCAN EQUAL finds the sector holding the host's bytes", async () => {
    const fdc = await plus3Fdc(writeDiskData(corpusDisk("plus3-format0")));
    const hit = fdc.run([0x51, 0x00, 0, 0, 1, 2, 9, 0x2a, 0x01], Array.from(pattern(0, 0, 1, 512)));
    expect(hit.st2 & 0x08).toBe(0x08);
    const miss = fdc.run([0x51, 0x00, 0, 0, 1, 2, 1, 0x2a, 0x01], new Array(512).fill(0x11));
    expect(miss.st2 & 0x04).toBe(0x04);
  }, 60_000);
});

describe("uPD765 WRITE DATA and FORMAT", () => {
  it("writes a sector and publishes it by its physical position", async () => {
    const fdc = await plus3Fdc(writeDiskData(corpusDisk("duplicate-ids")));
    fdc.run(seek(5));
    const result = fdc.run([0x45, 0x00, 5, 0, 4, 2, 4, 0x2a, 0xff], new Array(512).fill(0x5a));
    expect(result.st1).toBe(0x80);
    fdc.s.runFrames(1);
    const changes = fdc.s.takeDiskChanges(0)!;
    // --- R = 4 is the track's fifth sector (index 4: the IDs are 1, 2, 3, 3, 4)
    expect([...changes.keys()]).toEqual([5 * 256 + 4]);
    expect(changes.get(5 * 256 + 4)).toEqual(new Uint8Array(512).fill(0x5a));
  }, 60_000);

  it("refuses to write a write-protected disk", async () => {
    const fdc = await plus3Fdc(writeDiskData(corpusDisk("plus3-format0")), true);
    expect(fdc.run([0x45, 0x00, 0, 0, 1, 2, 1, 0x2a, 0xff])).toMatchObject({ st0: 0x40, st1: 0x02 });
  }, 60_000);

  it("formats a track and publishes the whole new image", async () => {
    const fdc = await plus3Fdc(writeDiskData(corpusDisk("plus3-format0")));
    fdc.run(seek(3));
    // --- Five 1K sectors, IDs 11..15, filled with $AA
    const ids = [11, 12, 13, 14, 15].flatMap((r) => [3, 0, r, 3]);
    const result = fdc.run([0x4d, 0x00, 3, 5, 0x40, 0xaa], ids);
    expect(result.st0 & 0xc0).toBe(0);
    fdc.s.runFrames(1);
    const changes = fdc.s.takeDiskChanges(0)!;
    expect([...changes.keys()]).toEqual([-1]);
    const { readDiskData } = await import("@emu/machines/disk/disk-readers");
    const disk = readDiskData(changes.get(-1)!);
    expect(disk.tracks[3].sectors.map((s) => [s.R, s.N, s.actualLength])).toEqual(
      [11, 12, 13, 14, 15].map((r) => [r, 3, 1024])
    );
    expect(disk.tracks[3].sectors[2].sectorData).toEqual(new Uint8Array(1024).fill(0xaa));
    expect(disk.tracks[3].gap3).toBe(0x40);
    // --- The other tracks are untouched, and the new track reads back
    expect(disk.tracks[4].sectors[0].sectorData).toEqual(pattern(4, 0, 1, 512));
    expect(fdc.run(readData(3, 0, 13, 3, 13)).data).toEqual(new Array(1024).fill(0xaa));
  }, 60_000);
});
