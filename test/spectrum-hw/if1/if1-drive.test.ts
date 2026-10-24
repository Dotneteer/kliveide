import { describe, expect, it } from "vitest";

import { formattedMdr, mdrChecksum, READ_BLOCK, SELECT, sp48WithInterface1, standInRom } from "./if1TestSupport";

/*
 * Reading a cartridge (`.plans/MICRODRIVE_PLAN.md` §3 M4, M5, §4.4-4.5;
 * `_input/microdrive/interface1-hardware.md` §4, §7): the GAP/SYNC sequence, the bytes after the
 * preamble, their pace, the sector order, and WAIT's hang.
 */

/** Real speed: a byte every 48 us at 3.5 MHz (plan §9) */
const BYTE_TACTS = 168;

async function withCartridge(mdr?: Uint8Array) {
  const s = await sp48WithInterface1(standInRom());
  if (mdr) s.insertCartridge(0, mdr);
  return s;
}

/** Reads `count` blocks of `length` bytes each into $9000, $9100, ... */
function readBlocks(count: number, length: number): string {
  return `
        .org $8000
      Main:
        di
        ld a,1
        call Select
        ld hl,$9000
        ld d,${count}
      Next:
        push hl
        ld b,${length}
        call ReadBlock
        pop hl
        inc h
        dec d
        jr nz,Next
        xor a
        call Select
        ret
      ${SELECT}
      ${READ_BLOCK}
  `;
}

describe("Interface 1 drive: reading", () => {
  it("a block's first byte is its flag: the preamble never reaches the CPU", async () => {
    const s = await withCartridge(formattedMdr());
    await s.loadCode(readBlocks(1, 15));
    s.call("Main", { maxFrames: 20 });
    const block = Array.from({ length: 15 }, (_, i) => s.peek(0x9000 + i));
    // --- A header (bit 0 set) or a record descriptor (clear), each with its checksum
    expect(block[14]).toBe(mdrChecksum(block.slice(0, 14)));
    expect(String.fromCharCode(...block.slice(4, 8))).toMatch(/^(TEST| {4})$/);
  }, 60_000);

  it("headers and records alternate, and the sectors pass in descending order", async () => {
    const s = await withCartridge(formattedMdr());
    await s.loadCode(readBlocks(8, 15));
    s.call("Main", { maxFrames: 50 });
    const blocks = Array.from({ length: 8 }, (_, b) => Array.from({ length: 15 }, (_, i) => s.peek(0x9000 + b * 0x100 + i)));
    const headers = blocks.filter((b) => (b[0] & 0x01) !== 0);
    expect(headers.length).toBe(4);
    blocks.forEach((b, i) => expect((b[0] & 0x01) !== 0).toBe((blocks[0][0] & 0x01) !== 0 ? i % 2 === 0 : i % 2 === 1));
    const numbers = headers.map((h) => h[1]);
    for (let i = 1; i < numbers.length; i++) expect(numbers[i]).toBe(numbers[i - 1] - 1);
  }, 60_000);

  it("WAIT paces the transfer at one byte per 48 us", async () => {
    const s = await withCartridge(formattedMdr());
    const program = await s.loadCode(readBlocks(1, 15));
    s.machine.pc = program.entry;
    s.runTo("BeforeInir", { maxFrames: 20 });
    const start = s.tacts();
    s.runTo("AfterInir", { maxFrames: 5 });
    const elapsed = s.tacts() - start;
    // --- 15 bytes, the first one byte time after the sync mark the CPU has just seen
    expect(elapsed).toBeGreaterThan(14 * BYTE_TACTS);
    expect(elapsed).toBeLessThan(16 * BYTE_TACTS);
  }, 60_000);

  it("a formatted cartridge shows signal within the ROM's presence window; a blank one never does", async () => {
    const presence = `
        .org $8000
      Main:
        di
        ld a,1
        call Select
        ld hl,5000
      Try:
        ld b,6
      Poll:
        in a,($ef)
        and $04
        jr nz,Miss
        djnz Poll
        ld a,1
        jr Done
      Miss:
        dec hl
        ld a,h
        or l
        jr nz,Try
      Done:
        ld ($9000),a
        xor a
        call Select
        ret
      ${SELECT}
    `;
    const formatted = await withCartridge(formattedMdr());
    await formatted.loadCode(presence);
    formatted.call("Main", { maxFrames: 20 });
    expect(formatted.peek(0x9000)).toBe(1);

    const blank = await withCartridge(new Uint8Array(254 * 543 + 1).fill(0xff));
    await blank.loadCode(presence);
    blank.call("Main", { maxFrames: 40 });
    expect(blank.peek(0x9000)).toBe(0);
  }, 60_000);

  it("a wait past the frame's end freezes the CPU until the byte arrives", async () => {
    // --- Only slot 5 has signal: the first byte is that header's flag, about five slots (~9 frames) away
    const mdr = new Uint8Array(254 * 543 + 1).fill(0xff);
    mdr.set(formattedMdr().subarray(5 * 543, 6 * 543), 5 * 543);
    const s = await withCartridge(mdr);
    await s.loadCode(`
        .org $8000
      Main:
        di
        ld a,1
        call Select
        ld a,$ee
        out ($ef),a
      Wait:
        in a,($e7)
        ld ($9000),a
        in a,($e7)
        ld ($9001),a
      Got:
        xor a
        call Select
        ret
      ${SELECT}
    `);
    s.machine.pc = s.address("Main");
    s.runTo("Wait", { maxFrames: 5 });
    s.step(1);
    expect(s.interface1().frozen).toBe(1);
    const frames = s.frames;
    s.runTo("Got", { maxFrames: 20 });
    expect(s.frames - frames).toBeGreaterThan(5);
    expect(s.interface1().frozen).toBe(0);
    expect(s.peek(0x9000)).toBe(0x01);
    expect(s.peek(0x9001)).toBe(254 - 5);
  }, 60_000);

  it("reading $E7 with no drive running hangs for good (the IN 0 crash); a reset ends it", async () => {
    const s = await withCartridge();
    await s.loadCode(`
        .org $8000
      Main:
        di
        ld a,$ee
        out ($ef),a
        in a,($00)
      After:
        ret
    `);
    s.machine.pc = s.address("Main");
    s.step(5);
    expect(s.interface1().frozen).toBe(2);
    const pc = s.machine.pc;
    s.runFrames(50);
    expect(s.machine.pc).toBe(pc);
    expect(s.interface1().frozen).toBe(2);
    s.reset();
    expect(s.interface1().frozen).toBe(0);
    s.runFrames(5);
    expect(s.machine.pc).not.toBe(pc);
  }, 60_000);
});
