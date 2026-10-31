import { describe, expect, it } from "vitest";

import { createEpSession, type EpTestSession } from "../harness/enterprise";
import { EP_PHYS_EXDOS } from "@emu/machines/enterprise/epMachineInfo";
import { buildFat12Image, readFat12Files } from "../ep/fat12Image";

/*
 * The EXDOS floppy interface (`.plans/ENTERPRISE_PLAN.md` §10, `ep-exdos.c`) on the real EXOS 2.1,
 * IS-BASIC 2.1 and EXDOS 1.3: the card's ports and ROM, the WD1770's motor and spin-up on the shared
 * controller, a directory listing, a SAVE published as the whole image and LOADed back in a fresh
 * machine, write protection, a 40-track disk, and EXDOS.INI. The disks are built by the test's own
 * FAT12 writer (`test/ep/fat12Image.ts`).
 */

const text = (value: string) => new TextEncoder().encode(value);

/** The screen's non-empty rows */
function rows(s: EpTestSession): string[] {
  return s
    .screenText()
    .split("\n")
    .map((row) => row.trim())
    .filter((row) => row !== "");
}

/** Runs whole frames until `seconds` of machine time (the 8 MHz half-T clock) have passed */
function runSeconds(s: EpTestSession, seconds: number): void {
  const start = s.wasm.epGetHalfClock();
  s.runUntil(() => ((s.wasm.epGetHalfClock() - start) >>> 0) >= seconds * 8_000_000, { maxFrames: 1000 }, "the time");
}

/** A machine with the card and these disks, booted to IS-BASIC's prompt */
async function bootWithDisks(a?: Uint8Array, { writeProtected = false, b }: { writeProtected?: boolean; b?: Uint8Array } = {}) {
  const s = await createEpSession({ exdos: true });
  expect(s.insertDisk(0, a, { writeProtected })).toBeUndefined();
  if (b) s.insertDisk(1, b);
  s.bootToBasic({ maxFrames: 3000 });
  return s;
}

describe("the EXDOS card", () => {
  it("decodes ports 10h-1Fh and maps EXDOS 1.3 at segments 20h-21h only when fitted", async () => {
    const bare = await createEpSession();
    expect(bare.wasm.epReadPort(0x10)).toBe(0xff);
    expect(bare.wasm.epReadPort(0x18)).toBe(0xff);
    expect(bare.physical(0x20 * 0x4000)).toBe(0xff);

    const s = await createEpSession({ exdos: true });
    expect(s.wasm.epExdosGetPresent()).toBe(1);
    const header = Array.from({ length: 8 }, (_, i) => String.fromCharCode(s.physical(0x20 * 0x4000 + i))).join("");
    expect(header).toBe("EXOS_ROM");
    expect(s.wasm.epGetSegmentBase(0x21)).toBe(EP_PHYS_EXDOS + 0x4000);
    // --- No disk went in or out: the disk-change line (bit 6, inverted) is high; no DRQ, no INTRQ
    expect(s.wasm.epReadPort(0x18)).toBe(0x40);
    // --- 18h-1Fh are one register; 14h-17h mirror the controller
    s.wasm.epWritePort(0x1d, 0x01);
    expect(s.wasm.epExdosGetControl()).toBe(0x01);
    s.wasm.epWritePort(0x16, 0x05);
    expect(s.wasm.epReadPort(0x12)).toBe(0x05);
  });

  it("flags a disk change until the guest clears it (control bit 6)", async () => {
    const s = await createEpSession({ exdos: true });
    s.insertDisk(0, buildFat12Image());
    s.wasm.epWritePort(0x18, 0x01);
    expect(s.wasm.epReadPort(0x18) & 0x40).toBe(0);
    s.wasm.epWritePort(0x18, 0x41);
    expect(s.wasm.epReadPort(0x18) & 0x40).toBe(0x40);
  });

  it("runs the WD1770: the motor and its spin-up, a restore, the motor's time-out", async () => {
    const s = await createEpSession({ exdos: true });
    s.insertDisk(0, buildFat12Image());
    // --- Before EXOS's RAM test ends (about 300 frames) nothing else touches the card
    s.runFrames(2);
    s.wasm.epWritePort(0x18, 0x01);
    s.wasm.epWritePort(0x11, 0x05);
    // --- Restore with spin-up (h = 0): busy, the motor on (bit 7), the spin-up not done yet (bit 5)
    s.wasm.epWritePort(0x10, 0x00);
    let status = s.wasm.epReadPort(0x10);
    expect(status & 0x81).toBe(0x81);
    expect(status & 0x20).toBe(0);
    // --- Six index pulses at 300 rpm (a revolution is 200 ms), then the restore
    runSeconds(s, 1.3);
    status = s.wasm.epReadPort(0x10);
    expect(status & 0x01).toBe(0);
    expect(status & 0xa4).toBe(0xa4);
    expect(s.wasm.epReadPort(0x11)).toBe(0);
    expect(s.wasm.epReadPort(0x18) & 0x02).toBe(0);
    // --- Nine idle revolutions (1.8 s) turn the motor off
    runSeconds(s, 1.4);
    expect(s.wasm.epReadPort(0x10) & 0x80).toBe(0x80);
    runSeconds(s, 0.6);
    expect(s.wasm.epReadPort(0x10) & 0x80).toBe(0);
  });

  it("waits for index pulses an empty drive never gives, until a Force Interrupt", async () => {
    const s = await createEpSession({ exdos: true });
    s.runFrames(2);
    s.wasm.epWritePort(0x18, 0x02);
    s.wasm.epWritePort(0x10, 0x88);
    // --- Far more than the five revolutions a search takes with a disk
    runSeconds(s, 2);
    expect(s.wasm.epReadPort(0x10) & 0x01).toBe(1);
    s.wasm.epWritePort(0x10, 0xd0);
    expect(s.wasm.epReadPort(0x10) & 0x01).toBe(0);
  });

  it("boots EXDOS 1.3 and lists a disk", async () => {
    const s = await bootWithDisks(buildFat12Image([{ name: "HELLO.TXT", contents: text("Hello from Klive\r\n") }]));
    s.typeKeys(":HELP\n", { settle: 100 });
    expect(rows(s)).toContain("EXDOS version 1.3");
    s.typeKeys(":DIR\n", { settle: 300 });
    const screen = rows(s);
    expect(screen).toContain("Directory of  A:\\");
    expect(screen.some((row) => /^HELLO\s+TXT\s+18 01-01-90/.test(row))).toBe(true);
    expect(screen).toContain("18 bytes in 1 file   712K free");
  });

  it("lists a 40-track disk", async () => {
    const image = buildFat12Image([{ name: "SMALL.TXT", contents: text("40 tracks\r\n") }], { cylinders: 40, sides: 2, sectorsPerTrack: 9 });
    expect(image.length).toBe(368_640);
    const s = await bootWithDisks(image);
    s.typeKeys(":DIR\n", { settle: 300 });
    expect(rows(s).some((row) => /^SMALL\s+TXT\s+11/.test(row))).toBe(true);
    expect(rows(s)).toContain("11 bytes in 1 file   353K free");
  });

  it("SAVEs a program as the whole image and LOADs it back in a fresh machine", async () => {
    const s = await bootWithDisks(buildFat12Image());
    s.typeKeys('10 PRINT "KLIVE DISK"\n', { settle: 20 });
    s.typeKeys('SAVE "TEST"\n', { settle: 400 });
    expect(rows(s).pop()).toBe("ok");
    const published = s.takePublishedDisk(0);
    expect(published?.length).toBe(737_280);
    expect(published).toEqual(s.diskImage(0));
    const files = readFat12Files(published!);
    expect(files.map((f) => f.name)).toEqual(["TEST"]);

    const fresh = await bootWithDisks(published);
    fresh.typeKeys('LOAD "TEST"\n', { settle: 300 });
    fresh.typeKeys("RUN\n", { settle: 50 });
    expect(rows(fresh).slice(-2)).toEqual(["KLIVE DISK", "ok"]);
  });

  it("gives EXDOS's error on a write-protected disk", async () => {
    const s = await bootWithDisks(buildFat12Image(), { writeProtected: true });
    s.typeKeys('10 PRINT "X"\n', { settle: 20 });
    s.typeKeys('SAVE "TEST"\n', { settle: 400 });
    expect(rows(s)).toContain("Write protected disk -- drive A:");
    expect(s.takePublishedDisk(0)).toBeUndefined();
  });

  it("runs EXDOS.INI at a cold start, not at the reset button's warm one", async () => {
    const ini = text("MKDIR KLIVE\r\nTIME 12:34:56\r\n");
    const s = await bootWithDisks(buildFat12Image([{ name: "EXDOS.INI", contents: ini }]));
    s.typeKeys(":DIR\n", { settle: 300 });
    expect(rows(s).some((row) => /^KLIVE\s+<dir>/.test(row))).toBe(true);
    s.typeKeys(":TIME\n", { settle: 100 });
    expect(rows(s)).toContain("Current time is 12:35p");
    // --- Another time at TIME's prompt
    s.typeKeys("01:00:00\n", { settle: 50 });

    // --- The reset button: EXOS's warm start keeps the time and does not run the file (observed)
    s.machine.reset();
    s.runUntil(() => s.isAtBasicPrompt(), { maxFrames: 3000 }, "IS-BASIC's prompt");
    s.runFrames(50);
    s.typeKeys(":TIME\n", { settle: 100 });
    expect(rows(s)).toContain("Current time is 01:00a");
    s.typeKeys("\n", { settle: 50 });

    // --- Power off and on, the disk kept: the cold start runs it again
    s.machine.hardReset();
    s.bootToBasic({ maxFrames: 3000 });
    s.typeKeys(":TIME\n", { settle: 100 });
    expect(rows(s)).toContain("Current time is 12:35p");
  });
});
