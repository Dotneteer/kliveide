import { describe, expect, it } from "vitest";

import { NEXT_PROFILE_IDS, NEXT_PROFILES, type NextProfileId } from "@emu/machines/zxNext/nextProfiles";
import { createSession, type NextTestSession } from "../../harness/zxnext";
import { forEachProfile } from "../../harness/zxnext/script/profiles";

/*
 * The zxnDDMA of core 3.03.00 (`dev/plans/ZXNEXT_3_03_PLAN.md`, phase 4): the DMA's extra commands on
 * port $6B. Its VHDL (new_dma.vhd) is not published; the reference is the distribution's guide,
 * docs/zxnDDMA/zxnddma.gde@26.11 (gitlab.com/thesmog358/tbblue at 3a892b03), cited by section:
 *
 * - 2.5 "Full addresses": $D7/$DB set address bits 23:16 of Port A/B; the physical address is
 *   {extended bits 5:0, start address 15:0}; issue 5 has 4 MB, issue 4 2 MB ("bit 21 is dropped:
 *   higher addresses wrap"); a 16K bank is at $40000 + bank x $4000; banks 5 and 7 are block RAM, so a
 *   physical transfer to their SRAM addresses does not reach the ULA screen.
 * - 2.5 "Mode flags": $DF bit 0 physical, bit 1 2D, bit 2 transparent, bit 3 fill, bit 4 Layer 2 X,Y
 *   (3 bytes follow), bit 5 hidden screen; each $DF sets every flag.
 * - 2.5 "Layer 2 X,Y": the Port B address from the bank in NextReg $12 ($13 with bit 5) and the mode in
 *   NextReg $70 bits 5:4 (00: base + Y x 256 + X; 01, 10, 11: base + X x 256 + Y); Port B's stride
 *   becomes 256.
 * - 2.5 "Rectangles": $E3 row length, $E7 rows, $EB/$EF strides, a stride added to the row's start.
 * - 2.5 "Transparent colour" ($F3), "Fill value" ($F7). 2.6: $C3 clears all of it.
 * - 2.9 note 7: in physical mode an address carries into the extended byte at $FFFF.
 * - 2.5 (intro): on a core without the zxnDDMA the command byte is dropped and the bytes after it are
 *   ordinary register writes.
 *
 * KS2 and KS3 differ only in address bit 21 (zxnext.vhd@3.02.04 ~1763-1777).
 */

const ZXN = 0x6b;
const DDMA_PROFILES = NEXT_PROFILE_IDS.filter((id) => NEXT_PROFILES[id].coreVersion[1] >= 3);
const hasDdma = (profile: NextProfileId) => DDMA_PROFILES.includes(profile);

const PHYSICAL = 0x01;
const TWO_D = 0x02;
const TRANSPARENT = 0x04;
const FILL = 0x08;
const XY = 0x10;
const HIDDEN = 0x20;

const lo = (v: number) => v & 0xff;
const hi = (v: number) => (v >> 8) & 0xff;
/** The physical address of 8K RAM page n */
const pagePhys = (page: number) => 0x40000 + page * 0x2000;

async function parked(profile: NextProfileId): Promise<NextTestSession> {
  const s = await createSession({ profile });
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  // --- Slots 6 and 7 show RAM pages 40 and 41 (physical $090000 and $092000)
  return s.setNextReg(0x56, 40).setNextReg(0x57, 41);
}

const write = (s: NextTestSession, bytes: number[]) => {
  for (const b of bytes) s.out(ZXN, b);
  return s;
};

/**
 * A memory-to-memory transfer A -> B: $C3, the zxnDDMA bytes, WR0 (Port A address, length), WR1/WR2
 * (memory, up), WR4 (continuous, Port B address unless `noB`), $82, then any bytes that must come after
 * WR4, $CF and $87.
 */
function transfer(o: { a: number; b: number; len: number; ddma?: number[]; afterWr4?: number[]; aFixed?: boolean; noB?: boolean }) {
  const wr4 = o.noB ? [0xa1] : [0xad, lo(o.b), hi(o.b)];
  return [0xc3, ...(o.ddma ?? []), 0x7d, lo(o.a), hi(o.a), lo(o.len), hi(o.len), o.aFixed ? 0x24 : 0x14, 0x10, ...wr4, 0x82, ...(o.afterWr4 ?? []), 0xcf, 0x87];
}

const numbers = (n: number, from = 1) => Array.from({ length: n }, (_, i) => (from + i) & 0xff);

describe("zxnDDMA", () => {
  // --- Physical addresses ($D7, $DB, $DF bit 0) on every model: ignored before 3.03 --------------------
  forEachProfile(NEXT_PROFILE_IDS, (profile) => {
    it("DDMA-001: a physical copy from page 40 to page 41 works on 3.03; earlier cores drop the commands", async () => {
      const s = await parked(profile);
      s.poke(0xc000, numbers(16));
      // --- Port A = $090000 (page 40), Port B = $092000 (page 41). On an earlier core $D7, $DB and $DF
      // --- are dropped and their follow bytes decode as WR0s; the WR0 after them sets A = $0000 (ROM)
      // --- and WR4 B = $2000 (ROM): the copy writes nothing.
      write(s, transfer({ a: 0x0000, b: 0x2000, len: 16, ddma: [0xd7, 0x09, 0xdb, 0x09, 0xdf, PHYSICAL] })).runFrames(1);
      expect(Array.from(s.peekBytes(0xe000, 16))).toEqual(hasDdma(profile) ? numbers(16) : Array(16).fill(0));
    });
  });

  forEachProfile(DDMA_PROFILES, (profile) => {
    it("DDMA-002: in physical mode an address carries into the extended byte at $FFFF (note 7)", async () => {
      const s = await parked(profile);
      // --- 16 bytes before and after the 64K boundary at $090000: page 39's end and page 40's start
      s.setNextReg(0x55, 39).poke(0xbff0, numbers(16, 0x10)).poke(0xc000, numbers(16, 0x20));
      write(s, transfer({ a: 0xfff0, b: 0x2000, len: 32, ddma: [0xd7, 0x08, 0xdb, 0x09, 0xdf, PHYSICAL] })).runFrames(1);
      expect(Array.from(s.peekBytes(0xe000, 32))).toEqual([...numbers(16, 0x10), ...numbers(16, 0x20)]);
    });

    it(`DDMA-003: physical $290000 is ${NEXT_PROFILES[profile].board === "ks3" ? "the KS3's upper SRAM" : "page 40 again (bit 21 dropped)"}`, async () => {
      const s = await parked(profile);
      s.poke(0xc000, Array(4).fill(0x11));
      // --- A fill of 4 bytes at physical $290000 ($F7 value, $DF fill + physical)
      write(s, transfer({ a: 0x0000, b: 0x0000, len: 4, ddma: [0xdb, 0x29, 0xf7, 0x5a, 0xdf, PHYSICAL | FILL] })).runFrames(1);
      if (NEXT_PROFILES[profile].board === "ks3") {
        expect(Array.from(s.peekBytes(0xc000, 4)), "page 40 untouched").toEqual(Array(4).fill(0x11));
        expect(s.sramBytes(0x290000, 4), "the upper SRAM").toEqual(Array(4).fill(0x5a));
        // --- and back again: a physical copy from $290000 to page 41
        write(s, transfer({ a: 0x0000, b: 0x2000, len: 4, ddma: [0xd7, 0x29, 0xdb, 0x09, 0xdf, PHYSICAL] })).runFrames(1);
        expect(Array.from(s.peekBytes(0xe000, 4)), "copied back").toEqual(Array(4).fill(0x5a));
      } else {
        expect(Array.from(s.peekBytes(0xc000, 4)), "wrapped onto page 40").toEqual(Array(4).fill(0x5a));
      }
    });

    it("DDMA-004: physical mode reaches the SRAM behind banks 5 and 7, not the screen (2.5)", async () => {
      const s = await parked(profile);
      const screen = Array.from(s.peekBytes(0x4000, 8));
      // --- A fill of bank 5's SRAM ($054000)
      write(s, transfer({ a: 0x0000, b: 0x4000, len: 8, ddma: [0xdb, 0x05, 0xf7, 0xc3, 0xdf, PHYSICAL | FILL] })).runFrames(1);
      expect(Array.from(s.peekBytes(0x4000, 8)), "the ULA screen (block RAM) unchanged").toEqual(screen);
      // --- Copied back to page 41: the SRAM holds the fill
      write(s, transfer({ a: 0x4000, b: 0x2000, len: 8, ddma: [0xd7, 0x05, 0xdb, 0x09, 0xdf, PHYSICAL] })).runFrames(1);
      expect(Array.from(s.peekBytes(0xe000, 8))).toEqual(Array(8).fill(0xc3));
    });

    // --- Rectangles, transparency and fill --------------------------------------------------------------

    it("DDMA-005: 2D copies row length x rows, each row at the row start plus the stride", async () => {
      const s = await parked(profile);
      s.poke(0xc000, numbers(64));
      // --- 4 bytes x 3 rows; source rows 16 apart, destination rows 8 apart (MMU addresses: no $DF bit 0)
      const rect = [0xe3, 4, 0, 0xe7, 3, 0, 0xeb, 16, 0, 0xef, 8, 0, 0xdf, TWO_D];
      write(s, transfer({ a: 0xc000, b: 0xe000, len: 1, ddma: rect })).runFrames(1);
      const expected = Array(24).fill(0);
      for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) expected[row * 8 + i] = row * 16 + i + 1;
      expect(Array.from(s.peekBytes(0xe000, 24))).toEqual(expected);
    });

    it("DDMA-006: a byte equal to the transparent colour is not written; both addresses move on", async () => {
      const s = await parked(profile);
      s.poke(0xc000, [1, 0xe3, 3, 0xe3, 5]).poke(0xe000, Array(5).fill(0x99));
      write(s, transfer({ a: 0xc000, b: 0xe000, len: 5, ddma: [0xf3, 0xe3, 0xdf, TRANSPARENT] })).runFrames(1);
      expect(Array.from(s.peekBytes(0xe000, 5))).toEqual([1, 0x99, 3, 0x99, 5]);
    });

    it("DDMA-007: fill writes the $F7 value without reading; $C3 clears every zxnDDMA setting (2.6)", async () => {
      const s = await parked(profile);
      s.poke(0xc000, numbers(8));
      write(s, transfer({ a: 0xc000, b: 0xe000, len: 8, ddma: [0xf7, 0x42, 0xdf, FILL] })).runFrames(1);
      expect(Array.from(s.peekBytes(0xe000, 8)), "filled").toEqual(Array(8).fill(0x42));
      // --- transfer() starts with $C3: the same copy without $DF is a plain copy again
      write(s, transfer({ a: 0xc000, b: 0xe000, len: 8 })).runFrames(1);
      expect(Array.from(s.peekBytes(0xe000, 8)), "copied").toEqual(numbers(8));
    });

    // --- Layer 2 X,Y --------------------------------------------------------------------------------------

    it("DDMA-008: X,Y in 256x192 is bank ($12) + Y x 256 + X; with bit 5 the bank of $13", async () => {
      const s = await parked(profile);
      // --- The source byte in page 40, physical $090000 (both ports are physical)
      s.poke(0xc000, [0xab]);
      const shown = s.readNextReg(0x12) & 0x7f;
      s.setNextReg(0x70, 0x00).setNextReg(0x13, 12);
      for (const [flags, bank] of [
        [PHYSICAL | XY, shown],
        [PHYSICAL | XY | HIDDEN, 12]
      ]) {
        write(s, transfer({ a: 0x0000, b: 0, len: 1, noB: true, ddma: [0xd7, 0x09], afterWr4: [0xdf, flags, 10, 0, 20] })).runFrames(1);
        const at = 0x40000 + bank * 0x4000 + 20 * 256 + 10;
        expect(s.sramBytes(at)[0], `bank ${bank}`).toBe(0xab);
      }
    });

    it("DDMA-009: X,Y in 320x256 runs down a column: base + X x 256 + Y, X 9 bits", async () => {
      const s = await parked(profile);
      s.poke(0xc000, [0xcd, 0xce]);
      s.setNextReg(0x70, 0x10);
      const bank = s.readNextReg(0x12) & 0x7f;
      // --- X = 300 (X_hi bit 0 set), Y = 5; two bytes: the second is one line down (the next byte)
      write(s, transfer({ a: 0x0000, b: 0, len: 2, noB: true, ddma: [0xd7, 0x09], afterWr4: [0xdf, PHYSICAL | XY, 300 & 0xff, 1, 5] })).runFrames(1);
      expect(s.sramBytes(0x40000 + bank * 0x4000 + 300 * 256 + 5, 2)).toEqual([0xcd, 0xce]);
    });
  });

  // --- Config-mode NextReg $04: 8 bits on the KS3 (zxnext.vhd@3.02.04 ~6218-6246) -------------------------
  forEachProfile(NEXT_PROFILE_IDS, (profile) => {
    it("NR04-001: config mode with $04 = $80 maps physical $200000 on a KS3; elsewhere bank 0 ($000000)", async () => {
      const s = await createSession({ profile });
      await s.loadCode(" .org $8000\n di\nPark: jr Park");
      const type = s.readNextReg(0x03) & 0x07;
      s.setNextReg(0x03, 0x07).setNextReg(0x04, 0x80).poke(0x0000, [0xa5, 0x5a]).setNextReg(0x03, type);
      const at = NEXT_PROFILES[profile].board === "ks3" ? 0x200000 : 0x000000;
      expect(s.sramBytes(at, 2)).toEqual([0xa5, 0x5a]);
    });
  });
});
