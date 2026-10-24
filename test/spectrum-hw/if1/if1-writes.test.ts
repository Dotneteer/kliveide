import { describe, expect, it } from "vitest";

import { formattedMdr, mdrChecksum, READ_BLOCK, SELECT, sp48WithInterface1, standInRom } from "./if1TestSupport";

/*
 * Writing a cartridge (`.plans/MICRODRIVE_PLAN.md` §3 M4, §4.6;
 * `_input/microdrive/interface1-rom-behaviour.md` §5.2 SEND-BLK): a record written ~2.7 ms after a
 * header was read replaces that sector's record, whatever the gap's exact length.
 */

const SLOT = 543;

/** The 543 bytes OUT-M-BUF sends: the preamble, a descriptor for "data" record 0, 512 data bytes, 3 more */
function recordBlock(fill: number): number[] {
  const descriptor = [0x06, 0x00, 0x00, 0x02, ..."data      ".split("").map((c) => c.charCodeAt(0))];
  const data = Array(512).fill(fill);
  return [
    ...Array(10).fill(0x00),
    0xff,
    0xff,
    ...descriptor,
    mdrChecksum(descriptor),
    ...data,
    mdrChecksum(data),
    0x00,
    0x00,
    0x00
  ];
}

/** Reads headers until one passes, then writes the record at $A000 into the same sector */
const SEND_BLOCK = `
        .org $8000
      Main:
        di
        ld a,1
        call Select
      FindHeader:
        ld hl,$9000
        ld b,15
        call ReadBlock
        ld a,($9000)
        and $01
        jr z,FindHeader
        ; --- Erase on, ~2.7 ms (SEND-BLK's 360 x 26 T), then write
        ld a,$e6
        out ($ef),a
        ld bc,360
      Lead:
        dec bc
        ld a,b
        or c
        jr nz,Lead
        ld a,$e2
        out ($ef),a
        ld hl,$a000
        ld bc,$00e7
        otir
        otir
        ld b,$1f
        otir
        ld a,$e6
        out ($ef),a
        ld a,$ee
        out ($ef),a
        xor a
        call Select
        ret
      ${SELECT}
      ${READ_BLOCK}
`;

describe("Interface 1 drive: writing", () => {
  it("a record written after a header lands on that header's sector", async () => {
    const s = await sp48WithInterface1(standInRom());
    s.insertCartridge(0, formattedMdr());
    await s.loadCode(SEND_BLOCK);
    s.poke(0xa000, recordBlock(0x5a));
    s.call("Main", { maxFrames: 30 });

    const sector = s.peek(0x9001);
    const mdr = s.cartridge(0)!;
    const slot = Array.from({ length: 254 }, (_, i) => i).find((i) => mdr[i * SLOT + 1] === sector)!;
    const record = mdr.subarray(slot * SLOT + 15, slot * SLOT + SLOT);
    expect(String.fromCharCode(...record.subarray(4, 14))).toBe("data      ");
    expect(record[15]).toBe(0x5a);
    expect(record[527]).toBe(mdrChecksum(Array(512).fill(0x5a)));
    // --- Only that slot changed, and it still carries both blocks
    expect(s.interface1Bridge.dirtySlots(0)).toEqual([slot]);
    expect(s.interface1Bridge.slotSignal(0, slot)).toBe(3);
    const untouched = formattedMdr();
    for (let i = 0; i < 254; i++) {
      if (i === slot) continue;
      expect(mdr.subarray(i * SLOT, (i + 1) * SLOT)).toEqual(untouched.subarray(i * SLOT, (i + 1) * SLOT));
    }
  }, 60_000);

  it("a write-protected cartridge takes no write and no erase", async () => {
    const s = await sp48WithInterface1(standInRom());
    s.insertCartridge(0, formattedMdr(), true);
    await s.loadCode(SEND_BLOCK);
    s.poke(0xa000, recordBlock(0x5a));
    s.call("Main", { maxFrames: 30 });
    expect(s.cartridge(0)!.subarray(0, 254 * SLOT)).toEqual(formattedMdr().subarray(0, 254 * SLOT));
    expect(s.interface1Bridge.dirtySlots(0)).toEqual([]);
  }, 60_000);

  it("the erase head alone turns what it passes into gap", async () => {
    const s = await sp48WithInterface1(standInRom());
    s.insertCartridge(0, formattedMdr());
    await s.loadCode(`
        .org $8000
      Start:
        di
        ld a,1
        call Select
        ld a,$e6
        out ($ef),a
        ret
      Stop:
        ld a,$ee
        out ($ef),a
        xor a
        call Select
        ret
      ${SELECT}
    `);
    s.call("Start");
    // --- About a second: some 25 of the 254 slots pass under the erase head
    s.runFrames(50);
    s.call("Stop");
    const erased = Array.from({ length: 254 }, (_, i) => s.interface1Bridge.slotSignal(0, i)).filter((v) => v === 0).length;
    expect(erased).toBeGreaterThan(20);
    expect(erased).toBeLessThan(35);
    const mdr = s.cartridge(0)!;
    const first = Array.from({ length: 254 }, (_, i) => i).find((i) => s.interface1Bridge.slotSignal(0, i) === 0)!;
    expect(mdr.subarray(first * SLOT, (first + 1) * SLOT).every((b) => b === 0xff)).toBe(true);
  }, 60_000);
});
