import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DISK_A_WP } from "@emu/machines/machine-props";
import { addTrdFile, createBlankTrd, trdCodeFile, TRD_TRACK_SIZE } from "@emu/machines/disk/trd/trdImage";
import { createSp128Session, type Sp128TestSession } from "../../harness/sp128";
import { BUFFER, buildTestTrdosRom, callRom, ENTRY, RESULT } from "./test-rom";

/*
 * The Beta 128 and its WD1793 on the real core (`.plans/BETA128_TRDOS_PLAN.md` Phase 2), driven by a
 * test ROM entered through the interface's own paging trap. Each test names what it checks; the
 * sources are in §9 of the plan: [DS] the FD179X data sheet, [BK] the Beta 128 documentation.
 *
 * Timing: the Pentagon runs at 3.5 MHz, so 1 ms = 3 500 T; one byte at 250 kbit/s = 112 T; one
 * revolution (300 rpm) = 700 000 T.
 */

const MS = 3500;
const BYTE = 112;
const REV = 700_000;

/** System register values: drive A, reset released, HLT, MFM; side 0 / side 1 (plan §9's polarity) */
const SYS_SIDE0 = 0x5c;
const SYS_SIDE1 = 0x4c;

const ST = { BUSY: 0x01, DRQ_INDEX: 0x02, LOST_TRACK0: 0x04, CRC: 0x08, RNF_SEEK: 0x10, HEAD: 0x20, PROTECT: 0x40, NOT_READY: 0x80 };

const pattern = (length: number, seed: number) => Uint8Array.from({ length }, (_, i) => (i * 13 + seed) & 0xff);

/** A booted Pentagon with the test ROM, a disk in drive A (unless `null`), the controller out of reset */
async function pentagon(disk: Uint8Array | null = createBlankTrd({ cylinders: 80, sides: 2 }), writeProtected = false) {
  const s = await createSp128Session("pentagon", { trdosRom: await buildTestTrdosRom() });
  s.runFrames(150);
  if (writeProtected) s.machine.setMachineProperty(DISK_A_WP, true);
  if (disk) s.insertDisk(0, disk);
  callRom(s, ENTRY.SYS, SYS_SIDE0);
  callRom(s, ENTRY.WAITI);
  return s;
}

function seek(s: Sp128TestSession, cylinder: number, command = 0x10) {
  callRom(s, ENTRY.DATA, cylinder);
  return callRom(s, ENTRY.WAIT, command);
}

/** Runs a RAM program at $8000 (DI first), up to its final JR $ */
function runRam(s: Sp128TestSession, code: number[]) {
  const x = s.machine.wasmV2Runtime!.exports as unknown as Record<string, (...args: number[]) => number>;
  s.poke(0x8000, [0xf3, ...code, 0x18, 0xfe]);
  x.sp128SetCpuHalted(0);
  s.machine.pc = 0x8000;
  s.runTo(0x8000 + 1 + code.length, { maxFrames: 5 });
}

describe("Beta 128: the interface", () => {
  it("is present only on a Pentagon with a TR-DOS ROM", async () => {
    expect((await createSp128Session("sp128")).beta128().enabled).toBe(false);
    const bare = await createSp128Session("pentagon");
    expect(bare.beta128().enabled).toBe(false);
    expect((bare.machine as { trdosRomProblem?: string }).trdosRomProblem).toMatch(/No TR-DOS ROM/);
    expect((await pentagon()).beta128().enabled).toBe(true);
  }, 60_000);

  it("[BK] pages TR-DOS in on an M1 fetch from $3D00-$3DFF with the 48K BASIC ROM, and out from RAM", async () => {
    const s = await pentagon();
    // --- The OUT at $3D00 ran from the TR-DOS page (the system register took it); RAM paged it out
    callRom(s, ENTRY.SYS, SYS_SIDE1);
    expect(s.beta128().system).toBe(SYS_SIDE1);
    expect(s.beta128().paged).toBe(false);

    // --- A data read of $3D00 is not a fetch: the 48K ROM's byte, no paging
    runRam(s, [0x01, 0xfd, 0x7f, 0x3e, 0x10, 0xed, 0x79, 0x3a, 0x00, 0x3d, 0x32, RESULT & 0xff, RESULT >> 8]);
    const rom48 = new Uint8Array(readFileSync(join(__dirname, "../../../src/public/roms/sp128-1.rom")));
    expect(s.peek(RESULT)).toBe(rom48[0x3d00]);
    expect(s.beta128().paged).toBe(false);

    // --- With ROM 0 (the 128K editor) the fetch does not page; with ROM 1 it does
    for (const [rom, paged] of [[0x00, false], [0x10, true]] as const) {
      s.poke(0x8000, [0xf3, 0x01, 0xfd, 0x7f, 0x3e, rom, 0xed, 0x79, 0xc3, 0x00, 0x3d]);
      s.machine.pc = 0x8000;
      s.runTo(0x3d00, { maxFrames: 5 });
      s.step();
      expect(s.beta128().paged, `ROM ${rom ? 1 : 0}`).toBe(paged);
    }
  }, 60_000);

  it("[BK] answers on its ports only while TR-DOS is paged", async () => {
    const s = await pentagon();
    // --- From RAM: OUT ($FF) does not reach the system register; IN ($1F) reads the Pentagon's $FF
    runRam(s, [0x3e, SYS_SIDE1, 0xd3, 0xff, 0xdb, 0x1f, 0x32, RESULT & 0xff, RESULT >> 8]);
    expect(s.beta128().system).toBe(SYS_SIDE0);
    expect(s.peek(RESULT)).toBe(0xff);
  }, 60_000);
});

describe("WD1793: Type I commands", () => {
  it("[DS] Seek and Restore move the head and the track register; Track 0 follows the head", async () => {
    const s = await pentagon();
    const sought = seek(s, 30);
    expect(s.beta128()).toMatchObject({ track: 30, cylinders: [30, 0] });
    expect(sought.a & (ST.LOST_TRACK0 | ST.BUSY)).toBe(0);
    // --- 30 steps at the fastest rate (r1 r0 = 00): 6 ms each at 1 MHz [DS Table 1]
    expect(sought.tacts).toBeGreaterThanOrEqual(30 * 6 * MS);
    expect(sought.tacts).toBeLessThan(30 * 6 * MS + 3000);
    const restored = callRom(s, ENTRY.WAIT, 0x00);
    expect(s.beta128()).toMatchObject({ track: 0, cylinders: [0, 0] });
    expect(restored.a & ST.LOST_TRACK0).toBe(ST.LOST_TRACK0);
  }, 60_000);

  it("[DS] steps at 6, 12, 20 and 30 ms by r1 r0", async () => {
    const s = await pentagon();
    for (const [rate, ms] of [[0, 6], [1, 12], [2, 20], [3, 30]]) {
      callRom(s, ENTRY.WAIT, 0x00);
      const { tacts } = seek(s, 4, 0x10 | rate);
      expect(tacts, `r = ${rate}`).toBeGreaterThanOrEqual(4 * ms * MS);
      expect(tacts, `r = ${rate}`).toBeLessThan(4 * ms * MS + 3000);
    }
  }, 60_000);

  it("[DS] Step In / Step Out update the track register only with the u flag", async () => {
    const s = await pentagon();
    callRom(s, ENTRY.WAIT, 0x50); // --- Step In, u = 1
    callRom(s, ENTRY.WAIT, 0x50);
    expect(s.beta128()).toMatchObject({ track: 2, cylinders: [2, 0] });
    callRom(s, ENTRY.WAIT, 0x40); // --- Step In, u = 0
    expect(s.beta128()).toMatchObject({ track: 2, cylinders: [3, 0] });
    callRom(s, ENTRY.WAIT, 0x70); // --- Step Out, u = 1
    expect(s.beta128()).toMatchObject({ track: 1, cylinders: [2, 0] });
    callRom(s, ENTRY.WAIT, 0x20); // --- Step (the last direction: out), u = 0
    expect(s.beta128()).toMatchObject({ track: 1, cylinders: [1, 0] });
  }, 60_000);

  it("[DS] verify settles 30 ms and reads an ID field; a track the disk lacks is a Seek Error after 5 revolutions", async () => {
    const s = await pentagon(createBlankTrd({ cylinders: 40, sides: 2 }));
    const good = seek(s, 10, 0x14);
    expect(good.a & ST.RNF_SEEK).toBe(0);
    expect(good.tacts).toBeGreaterThan(10 * 6 * MS + 30 * MS);
    expect(good.tacts).toBeLessThan(10 * 6 * MS + 30 * MS + REV);
    const bad = seek(s, 60, 0x14);
    expect(bad.a & ST.RNF_SEEK).toBe(ST.RNF_SEEK);
    expect(bad.tacts).toBeGreaterThanOrEqual(50 * 6 * MS + 30 * MS + 5 * REV);
  }, 60_000);

  it("[DS] the Index bit pulses once a revolution", async () => {
    const s = await pentagon();
    callRom(s, ENTRY.WAIT, 0x08); // --- Restore with the head loaded
    const { a, tacts } = callRom(s, ENTRY.INDEX, 0, 0, 2000);
    // --- One rising edge per revolution (300 rpm)
    const revolutions = tacts / REV;
    expect(a).toBeGreaterThanOrEqual(Math.floor(revolutions));
    expect(a).toBeLessThanOrEqual(Math.ceil(revolutions));
  }, 60_000);
});

describe("WD1793: Type II commands", () => {
  it("[DS] writes a sector, reads it back, and hands the write to the .trd file", async () => {
    const s = await pentagon();
    seek(s, 1);
    callRom(s, ENTRY.SECTOR, 3);
    const data = pattern(256, 5);
    s.poke(BUFFER, data);
    expect(callRom(s, ENTRY.WRITE, 0xa0).a).toBe(0);
    s.poke(BUFFER, new Uint8Array(256));
    const read = callRom(s, ENTRY.READ, 0x80);
    expect(read.a).toBe(0);
    expect(read.hl - BUFFER).toBe(256);
    expect(Array.from({ length: 256 }, (_, i) => s.peek(BUFFER + i))).toEqual(Array.from(data));
    // --- Cylinder 1, side 0 is logical track 2 of a double-sided file; sector 3 is its third
    s.runFrames(1);
    const changes = s.takeDiskChanges(0)!;
    expect([...changes.keys()]).toEqual([2 * 16 + 2]);
    expect(Array.from(changes.get(2 * 16 + 2)!)).toEqual(Array.from(data));
  }, 60_000);

  it("republishes the whole in-core disk for a reverse-debugging fork (REVERSE_DEBUGGING_PLAN D13)", async () => {
    const disk = createBlankTrd({ cylinders: 80, sides: 2 });
    const s = await pentagon(disk);
    seek(s, 1);
    callRom(s, ENTRY.SECTOR, 3);
    const data = pattern(256, 9);
    s.poke(BUFFER, data);
    expect(callRom(s, ENTRY.WRITE, 0xa0).a).toBe(0);
    s.runFrames(1);
    s.takeDiskChanges(0);
    expect((s.machine as unknown as { republishDisks(): boolean }).republishDisks()).toBe(true);
    const all = s.takeDiskChanges(0)!;
    // --- Every sector of the file, the written one as the core has it
    expect(all.size).toBe(disk.length / 256);
    expect(Array.from(all.get(2 * 16 + 2)!)).toEqual(Array.from(data));
    expect(Array.from(all.get(0)!)).toEqual(Array.from(disk.subarray(0, 256)));
    expect(s.takeDiskChanges(1)).toBeUndefined();
  }, 60_000);

  it("has nothing to republish without a disk", async () => {
    const s = await pentagon(null);
    expect((s.machine as unknown as { republishDisks(): boolean }).republishDisks()).toBe(false);
  }, 60_000);

  it("[BK] the side bit selects the disk's second side", async () => {
    const s = await pentagon();
    callRom(s, ENTRY.SYS, SYS_SIDE1);
    callRom(s, ENTRY.SECTOR, 1);
    s.poke(BUFFER, pattern(256, 9));
    expect(callRom(s, ENTRY.WRITE, 0xa0).a).toBe(0);
    s.runFrames(1);
    expect([...s.takeDiskChanges(0)!.keys()]).toEqual([1 * 16]);
  }, 60_000);

  it("[DS] reads at the disk's rate: 256 bytes, one every 112 T, after the sector comes round", async () => {
    let trd = createBlankTrd({ cylinders: 80, sides: 2 });
    trd.set(pattern(256, 1), 0 * TRD_TRACK_SIZE + 4 * 256);
    const s = await pentagon(trd);
    callRom(s, ENTRY.SECTOR, 5);
    const read = callRom(s, ENTRY.READ, 0x80);
    expect(read.a).toBe(0);
    expect(Array.from({ length: 256 }, (_, i) => s.peek(BUFFER + i))).toEqual(Array.from(pattern(256, 1)));
    expect(read.tacts).toBeGreaterThanOrEqual(256 * BYTE);
    expect(read.tacts).toBeLessThan(REV + 260 * BYTE);
  }, 60_000);

  it("[DS] Record Not Found: no such sector, or a track register that does not match, after four revolutions", async () => {
    const s = await pentagon();
    callRom(s, ENTRY.SECTOR, 17);
    const missing = callRom(s, ENTRY.READ, 0x80);
    expect(missing.a & ST.RNF_SEEK).toBe(ST.RNF_SEEK);
    expect(missing.tacts).toBeGreaterThanOrEqual(4 * REV);
    callRom(s, ENTRY.SECTOR, 1);
    callRom(s, ENTRY.TRACK, 5);
    expect(callRom(s, ENTRY.READ, 0x80).a & ST.RNF_SEEK).toBe(ST.RNF_SEEK);
  }, 60_000);

  it("[DS] multi-sector read runs to the last sector and then reports Record Not Found", async () => {
    let trd = createBlankTrd({ cylinders: 80, sides: 2 });
    trd = addTrdFile(trd, trdCodeFile("x", 0, pattern(16 * 256, 3)));
    const s = await pentagon(trd);
    seek(s, 0);
    callRom(s, ENTRY.SECTOR, 1);
    const read = callRom(s, ENTRY.READ, 0x90);
    expect(read.hl - BUFFER).toBe(16 * 256);
    expect(read.a & ST.RNF_SEEK).toBe(ST.RNF_SEEK);
  }, 60_000);

  it("[DS] Write Protect refuses a write and leaves the disk alone", async () => {
    const s = await pentagon(createBlankTrd({ cylinders: 80, sides: 2 }), true);
    callRom(s, ENTRY.SECTOR, 1);
    s.poke(BUFFER, pattern(256, 2));
    expect(callRom(s, ENTRY.WRITE, 0xa0).a & ST.PROTECT).toBe(ST.PROTECT);
    s.runFrames(1);
    expect(s.takeDiskChanges(0)).toBeUndefined();
  }, 60_000);

  it("[DS] Lost Data when the CPU is slower than the disk", async () => {
    const s = await pentagon();
    callRom(s, ENTRY.SECTOR, 1);
    expect(callRom(s, ENTRY.SLOW, 0x80).a & ST.LOST_TRACK0).toBe(ST.LOST_TRACK0);
  }, 60_000);

  it("[DS] Type II commands do not execute on a drive that is not ready", async () => {
    const s = await pentagon(null);
    const read = callRom(s, ENTRY.READ, 0x80);
    expect(read.a & ST.NOT_READY).toBe(ST.NOT_READY);
    expect(read.hl).toBe(BUFFER);
    expect(read.tacts).toBeLessThan(1000);
  }, 60_000);
});

describe("WD1793: Type III commands", () => {
  const crc = (bytes: number[]) => {
    let c = 0xffff;
    for (const b of bytes) {
      c ^= b << 8;
      for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
    }
    return c;
  };

  it("[DS] Read Address returns the next ID field with its CRC and puts its track in the sector register", async () => {
    const s = await pentagon();
    seek(s, 7);
    const result = callRom(s, ENTRY.READ, 0xc0);
    const id = Array.from({ length: 6 }, (_, i) => s.peek(BUFFER + i));
    expect(result.hl - BUFFER).toBe(6);
    expect(id[0]).toBe(7);
    expect(id[1]).toBe(0);
    expect(id[2]).toBeGreaterThanOrEqual(1);
    expect(id[2]).toBeLessThanOrEqual(16);
    expect(id[3]).toBe(1);
    expect((id[4] << 8) | id[5]).toBe(crc([0xa1, 0xa1, 0xa1, 0xfe, id[0], id[1], id[2], id[3]]));
    expect(s.beta128().sector).toBe(7);
  }, 60_000);

  it("[DS] Write Track formats a track that Read Sector then reads, and extends the disk", async () => {
    const s = await pentagon(createBlankTrd({ cylinders: 40, sides: 2 }));
    seek(s, 42);
    // --- An MFM track as a formatter writes it: F5 is A1 and presets the CRC, F7 writes the CRC
    const track: number[] = new Array(40).fill(0x4e);
    for (let r = 1; r <= 16; r++) {
      track.push(...new Array(12).fill(0), 0xf5, 0xf5, 0xf5, 0xfe, 42, 0, r, 1, 0xf7, ...new Array(22).fill(0x4e));
      track.push(...new Array(12).fill(0), 0xf5, 0xf5, 0xf5, 0xfb, ...pattern(256, r), 0xf7, ...new Array(24).fill(0x4e));
    }
    while (track.length < 6400) track.push(0x4e);
    s.poke(BUFFER, track);
    expect(callRom(s, ENTRY.WRITE, 0xf0).a & ST.LOST_TRACK0).toBe(0);
    const x = s.machine.wasmV2Runtime!.exports as unknown as Record<string, (...args: number[]) => number>;
    expect(x.sp128BetaDiskGetCylinders(0)).toBe(43);
    callRom(s, ENTRY.SECTOR, 9);
    expect(callRom(s, ENTRY.READ, 0x80).a).toBe(0);
    expect(Array.from({ length: 256 }, (_, i) => s.peek(BUFFER + i))).toEqual(Array.from(pattern(256, 9)));
  }, 60_000);

  it("[DS] Read Track delivers a whole revolution with its address marks", async () => {
    const s = await pentagon();
    const result = callRom(s, ENTRY.READ, 0xe0);
    expect(result.hl - BUFFER).toBe(6250);
    const raw = Array.from({ length: 6250 }, (_, i) => s.peek(BUFFER + i));
    const id = raw.findIndex((b, i) => b === 0xfe && raw[i - 1] === 0xa1 && raw[i + 3] === 1);
    expect(id).toBeGreaterThan(0);
    expect(raw.slice(id + 1, id + 5)).toEqual([0, 0, 1, 1]);
  }, 60_000);
});

describe("WD1793: Force Interrupt and reset", () => {
  it("[DS] $D0 ends a running command with no interrupt; $D8 interrupts at once", async () => {
    const s = await pentagon();
    callRom(s, ENTRY.SECTOR, 17); // --- a read that would search for four revolutions
    callRom(s, ENTRY.CMD, 0x80);
    expect(s.beta128().busy).toBe(true);
    callRom(s, ENTRY.CMD, 0xd0);
    expect(s.beta128()).toMatchObject({ busy: false, intrq: false });
    callRom(s, ENTRY.CMD, 0xd8);
    expect(s.beta128().intrq).toBe(true);
    // --- With no command running, the status shows the Type I bits (Track 0 here)
    expect(callRom(s, ENTRY.STATUS).a & ST.LOST_TRACK0).toBe(ST.LOST_TRACK0);
  }, 60_000);

  it("[DS] holding the reset bit low resets the controller; releasing it runs a Restore", async () => {
    const s = await pentagon();
    seek(s, 20);
    callRom(s, ENTRY.SYS, SYS_SIDE0 & ~0x04);
    expect(callRom(s, ENTRY.STATUS).a & ST.NOT_READY).toBe(ST.NOT_READY);
    callRom(s, ENTRY.SYS, SYS_SIDE0);
    callRom(s, ENTRY.WAITI);
    expect(s.beta128()).toMatchObject({ track: 0, cylinders: [0, 0] });
  }, 60_000);
});

describe("Beta 128: disks in the host", () => {
  it("[Q4] an .scl keeps the guest's writes in the emulated disk, reports them unsaved, and exports as .trd", async () => {
    const { trdToScl, readTrdFileData, readTrdCatalog } = await import("@emu/machines/disk/trd/trdImage");
    let trd = createBlankTrd({ cylinders: 80, sides: 2 });
    trd = addTrdFile(trd, trdCodeFile("keep", 0x8000, pattern(512, 4)));
    const s = await pentagon(trdToScl(trd));
    // --- The SCL's file is on the disk TR-DOS sees: logical track 1 (cylinder 0, side 1), sector ID 1
    callRom(s, ENTRY.SYS, SYS_SIDE1);
    callRom(s, ENTRY.SECTOR, 1);
    expect(callRom(s, ENTRY.READ, 0x80).a).toBe(0);
    expect(Array.from({ length: 256 }, (_, i) => s.peek(BUFFER + i))).toEqual(Array.from(pattern(512, 4).subarray(0, 256)));
    // --- A write: unsaved, no file changes
    callRom(s, ENTRY.SECTOR, 5);
    s.poke(BUFFER, pattern(256, 77));
    expect(callRom(s, ENTRY.WRITE, 0xa0).a).toBe(0);
    s.runFrames(1);
    expect(s.takeDiskChanges(0)).toBeUndefined();
    expect(s.diskUnsaved(0)).toBe(true);
    const exported = (s.machine as { exportBetaDiskAsTrd(drive: number): Uint8Array }).exportBetaDiskAsTrd(0);
    expect(readTrdFileData(exported, readTrdCatalog(exported)[0]).subarray(0, 512)).toEqual(pattern(512, 4));
    expect(exported.subarray((0 * 2 + 1) * TRD_TRACK_SIZE + 4 * 256, (0 * 2 + 1) * TRD_TRACK_SIZE + 5 * 256)).toEqual(pattern(256, 77));
  }, 60_000);

  it("keeps the guest's writes when the same file is attached again; a newly read file replaces the disk", async () => {
    const trd = createBlankTrd({ cylinders: 80, sides: 2 });
    const s = await pentagon(trd);
    callRom(s, ENTRY.SECTOR, 2);
    s.poke(BUFFER, pattern(256, 31));
    expect(callRom(s, ENTRY.WRITE, 0xa0).a).toBe(0);
    s.insertDisk(0, trd); // --- the controller re-attaches the stored medium on every start
    s.poke(BUFFER, new Uint8Array(256));
    callRom(s, ENTRY.READ, 0x80);
    expect(s.peek(BUFFER)).toBe(pattern(256, 31)[0]);
    s.insertDisk(0, new Uint8Array(trd)); // --- a new read of the file
    callRom(s, ENTRY.READ, 0x80);
    expect(s.peek(BUFFER)).toBe(0);
  }, 60_000);
});

describe("Beta 128: the Disk Loader flow", () => {
  it("types RANDOMIZE USR 15616 in 48 BASIC, which enters the ROM at $3D00 through the trap", async () => {
    const { trdosDiskBootFlow } = await import("@emu/machines/zxSpectrum128/trdosFlows");
    // --- A stand-in ROM whose $3D00 leaves a mark and parks: LD A,$A5 / LD (40000),A / JR $. It does
    // --- not return: a RET into the 48K ROM (below $4000) would keep the TR-DOS page in, by design
    const marker = new Uint8Array(0x4000);
    marker.set([0x3e, 0xa5, 0x32, 0x40, 0x9c, 0x18, 0xfe], 0x3d00);
    const s = await createSp128Session("pentagon", { trdosRom: marker });
    s.insertDisk(0, createBlankTrd({ cylinders: 80, sides: 2 }));
    s.runFlow(trdosDiskBootFlow(), { checkRom: true, maxFrames: 1500 });
    s.runFrames(50);
    expect(s.peek(40000)).toBe(0xa5);
    expect(s.beta128().paged).toBe(true);
  }, 120_000);

  it("explains why a Pentagon without a TR-DOS ROM cannot boot a disk; the 128K has no such flow", async () => {
    const bare = await createSp128Session("pentagon");
    expect(() => (bare.machine as { getDiskBootFlow(): unknown }).getDiskBootFlow()).toThrow(/No TR-DOS ROM/);
    const sp128 = await createSp128Session("sp128");
    expect((sp128.machine as { getDiskBootFlow(): unknown }).getDiskBootFlow()).toBeUndefined();
  }, 60_000);
});
