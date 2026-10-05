import { describe, expect, it } from "vitest";

import {
  addTrdFile,
  createBlankTrd,
  readTrdCatalog,
  readTrdFileData,
  trdBasicFile,
  trdCodeFile
} from "@emu/machines/disk/trd/trdImage";
import { trdosDiskBootFlow } from "@emu/machines/zxSpectrum128/trdosFlows";
import { createSp128Session, trdosRomFromEnvironment } from "../../harness/sp128";

/*
 * TR-DOS itself on the Pentagon's Beta 128 (`.plans/BETA128_TRDOS_PLAN.md` Phase 4). Klive cannot
 * ship the TR-DOS ROM (Q1), so these run only when `KLIVE_TRDOS_ROM` names a developer's own copy:
 *
 *   KLIVE_TRDOS_ROM=/path/to/trdos.rom npm test -- test/sp128-hw/beta128/trdos.test.ts
 *
 * The disk is made by Klive (B7): a `data` file, the first on the disk, sits on logical track 1 -
 * cylinder 0, side 1 - so reading it decides the side bit's polarity (plan §9). The `boot` program
 * does the rest through TR-DOS's documented BASIC entry, `RANDOMIZE USR 15619: REM : <command>`
 * (the Beta 128 user manual).
 */

const rom = trdosRomFromEnvironment();

// ------------------------------------------------------------------------------------------------
// A small BASIC encoder for the fixture (token codes from `char-codes.ts`)

const T = { CODE: 0xaf, USR: 0xc0, REM: 0xea, LOAD: 0xef, POKE: 0xf4, SAVE: 0xf8, RANDOMIZE: 0xf9 };

/** A number as BASIC stores it: its digits, then $0E and the 5-byte small-integer form */
const num = (value: number) => [...Array.from(String(value), (c) => c.charCodeAt(0)), 0x0e, 0, 0, value & 0xff, value >> 8, 0];
const str = (text: string) => [0x22, ...Array.from(text, (c) => c.charCodeAt(0)), 0x22];
const line = (number: number, body: number[]) => {
  const content = [...body, 0x0d];
  return [number >> 8, number & 0xff, content.length & 0xff, content.length >> 8, ...content];
};
const trdos = (command: number[]) => [T.RANDOMIZE, T.USR, ...num(15619), 0x3a, T.REM, 0x3a, ...command];

const DATA = Uint8Array.from({ length: 300 }, (_, i) => (i * 11 + 3) & 0xff);

const BOOT = new Uint8Array([
  ...line(10, [T.POKE, ...num(40000), 0x2c, ...num(42)]),
  ...line(20, trdos([T.LOAD, ...str("data"), T.CODE, ...num(50000)])),
  ...line(30, trdos([T.SAVE, ...str("out"), T.CODE, ...num(40000), 0x2c, ...num(16)])),
  ...line(40, [T.POKE, ...num(40001), 0x2c, ...num(7)])
]);

function fixtureDisk(): Uint8Array {
  let trd = createBlankTrd({ cylinders: 80, sides: 2 }, "KLIVE");
  trd = addTrdFile(trd, trdCodeFile("data", 50000, DATA));
  trd = addTrdFile(trd, trdBasicFile("boot", BOOT, 10));
  return trd;
}

describe.skipIf(!rom)("TR-DOS on the Pentagon (KLIVE_TRDOS_ROM)", () => {
  it("the Disk Loader boots `boot`, which loads from side 1 and saves a file back to the .trd", async () => {
    const s = await createSp128Session("pentagon", { trdosRom: rom });
    const disk = fixtureDisk();
    expect(readTrdCatalog(disk)[0]).toMatchObject({ name: "data", firstTrack: 1 }); // --- cylinder 0, side 1
    s.insertDisk(0, disk);
    s.runFlow(trdosDiskBootFlow(), { checkRom: true, maxFrames: 1500 });
    for (let frame = 0; frame < 3000 && s.peek(40001) !== 7; frame += 10) s.runFrames(10);

    // --- Line 10 ran: `boot` was loaded and run
    expect(s.peek(40000)).toBe(42);
    // --- Line 20: the file on side 1 came back intact
    expect(Array.from({ length: DATA.length }, (_, i) => s.peek(50000 + i))).toEqual(Array.from(DATA));
    // --- Line 30: TR-DOS wrote "out" - the catalogue and the data - and Klive handed it to the file
    expect(s.peek(40001)).toBe(7);
    const changes = s.takeDiskChanges(0);
    expect(changes?.size).toBeGreaterThan(0);
    const after = new Uint8Array(disk);
    changes!.forEach((data, sector) => after.set(data, sector * 256));
    const out = readTrdCatalog(after).find((f) => f.name === "out" && !f.deleted);
    expect(out).toMatchObject({ type: "C", param1: 40000, param2: 16 });
    expect(readTrdFileData(after, out!)[0]).toBe(42);
  }, 600_000);

  it("pages TR-DOS in as partition R2 while it runs", async () => {
    const s = await createSp128Session("pentagon", { trdosRom: rom });
    s.insertDisk(0, fixtureDisk());
    s.runFlow(trdosDiskBootFlow().slice(0, -2), { checkRom: true, maxFrames: 1500 });
    // --- At the TR-DOS prompt the CPU idles in the TR-DOS ROM (or the 48K ROM it calls)
    let seenPaged = false;
    for (let i = 0; i < 200 && !seenPaged; i++) {
      s.step(50);
      seenPaged = s.beta128().paged;
    }
    expect(seenPaged).toBe(true);
    expect(s.machine.getCurrentPartitions()[0]).toBe(-3);
    expect(s.machine.getMemoryPartition(-3)).toEqual(rom);
  }, 600_000);
});
