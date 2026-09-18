import { describe, expect, it } from "vitest";

import { ALL_CORES, next8ToHex as next8, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { parkedSession } from "../ula/_ula-helpers";

/*
 * Copper control, list addressing and WAIT/MOVE semantics (catalogue COP-002, COP-003, COP-007 - COP-015).
 *
 * Hardware:
 * - device/copper.vhd (all of it): one instruction per 28 MHz tick - the list RAM is read on the falling
 *   edge (zxnext.vhd ~3952 clk_b = i_CLK_28_n), so the word at a new address is there by the next rising
 *   edge. WAIT (bit 15) advances when cvc = line(8:0) and hc >= H(5:0) * 8 + 12; a MOVE sets
 *   copper_dout for one tick (none for MOVE 0,x) and the tick after it only clears it. The address
 *   resets to 0 only when the mode *changes* to 01 or 11 (`last_state_s /= copper_en_i`), and in mode 11
 *   at cvc = 0, hc = 0.
 * - zxnext.vhd ~4689-4714: a MOVE becomes a NextReg write (register '0' & bits 14-8, so $00-$7F) through
 *   copper_req, latched on the rising edge of copper_dout and written by the NextReg process on the next
 *   tick: two ticks after the fetch. The CPU's request is held until copper_req is low (~4749): the
 *   copper wins a clash, the CPU write is delayed, never lost.
 * - ~5396-5407: $60/$63 increment the 11-bit write address; $61 sets bits 7-0, $62 the mode (7-6) and
 *   bits 10-8. ~6029-6033: $61 reads bits 7-0, $62 reads mode & "000" & bits 10-8.
 * - zxula_timing.vhd ~420-472, zxnext.vhd ~6683: the copper's hcount is hc_ula, which is 0 where cvc
 *   changes (raw hc = c_min_hactive - 12) and counts a whole line, up to c_max_hc (447; 128K/+3 455).
 *   cvc is the $64 offset at display line 0 and wraps after c_max_vc (48K 311, 128K/+3 310, Pentagon
 *   319, 60 Hz 263). So WAIT H only matches while H * 8 + 12 <= c_max_hc, and a line past c_max_vc never
 *   matches.
 */

const MOVE = (reg: number, value: number) => ((reg & 0x7f) << 8) | (value & 0xff);
const WAIT = (line: number, h = 0) => 0x8000 | ((h & 0x3f) << 9) | (line & 0x1ff);
const HALT = 0xffff;

/** Stops the copper and writes `list` from address 0 with $60. */
function upload(s: NextTestSession, list: number[]): NextTestSession {
  s.setNextReg(0x62, 0x00).setNextReg(0x61, 0x00);
  for (const w of list) s.setNextReg(0x60, w >> 8).setNextReg(0x60, w & 0xff);
  return s;
}

type Timing = { name: string; nr03: number; nr05: number; maxVc: number; maxHc: number };
const TIMINGS: Timing[] = [
  { name: "48K 50 Hz", nr03: 0x90, nr05: 0x00, maxVc: 311, maxHc: 447 },
  { name: "48K 60 Hz", nr03: 0x90, nr05: 0x04, maxVc: 263, maxHc: 447 },
  { name: "128K 50 Hz", nr03: 0xa0, nr05: 0x00, maxVc: 310, maxHc: 455 },
  { name: "128K 60 Hz", nr03: 0xa0, nr05: 0x04, maxVc: 263, maxHc: 455 },
  { name: "+3 50 Hz", nr03: 0xb0, nr05: 0x00, maxVc: 310, maxHc: 455 },
  { name: "Pentagon", nr03: 0xc0, nr05: 0x00, maxVc: 319, maxHc: 447 }
];

async function timedSession(core: CoreName, t: Timing): Promise<NextTestSession> {
  const s = await parkedSession(core);
  // --- a timing change applies from the next frame
  return s.setNextReg(0x03, t.nr03).setNextReg(0x05, t.nr05).runFrames(2);
}

describe.each(ALL_CORES)("copper control - %s core", (core: CoreName) => {
  it("COP-002: $61/$62 read the 11-bit write address and the mode; $60 writes move it on", async () => {
    const s = await parkedSession(core);
    s.setNextReg(0x61, 0x34).setNextReg(0x62, 0x05);
    expect([s.readNextReg(0x61), s.readNextReg(0x62)]).toEqual([0x34, 0x05]);
    s.setNextReg(0x62, 0x3f); // --- bits 5-3 are not stored
    expect(s.readNextReg(0x62)).toBe(0x07);
    s.setNextReg(0x62, 0x01).setNextReg(0x61, 0xff).setNextReg(0x60, 0x00);
    expect([s.readNextReg(0x61), s.readNextReg(0x62)], "carry into bits 10-8").toEqual([0x00, 0x02]);
    s.setNextReg(0x63, 0x00).setNextReg(0x63, 0x00);
    expect([s.readNextReg(0x61), s.readNextReg(0x62)], "$63 increments too").toEqual([0x02, 0x02]);
    s.setNextReg(0x62, 0x80); // --- mode 10: bits 7-6
    expect(s.readNextReg(0x62)).toBe(0x80);
    s.setNextReg(0x62, 0x00);
  });

  it("COP-003: the write address wraps from $7FF (instruction 1023) to 0", async () => {
    const s = await parkedSession(core);
    upload(s, [MOVE(0x14, 0x11), HALT]);
    s.setNextReg(0x61, 0xfe).setNextReg(0x62, 0x07);
    for (const w of [MOVE(0x4a, 0x22), MOVE(0x14, 0x5a)]) s.setNextReg(0x60, w >> 8).setNextReg(0x60, w & 0xff);
    expect([s.readNextReg(0x61), s.readNextReg(0x62)], "address after the wrap").toEqual([0x02, 0x00]);
    s.setNextReg(0x14, 0xe3).setNextReg(0x62, 0x40).runFrames(2);
    expect(s.readNextReg(0x14), "instruction 0 was rewritten through the wrap").toBe(0x5a);
  });

  for (const t of TIMINGS) {
    it(`COP-007: ${t.name}: WAIT line ${t.maxVc} matches, line ${t.maxVc + 1} and 400 never do`, async () => {
      const s = await timedSession(core, t);
      const reached = (line: number) => {
        upload(s, [WAIT(line), MOVE(0x14, 0x5a), HALT]);
        s.setNextReg(0x14, 0xe3).setNextReg(0x62, 0xc0).runFrames(3);
        return s.readNextReg(0x14) === 0x5a;
      };
      expect([reached(t.maxVc), reached(t.maxVc + 1), reached(400)]).toEqual([true, false, false]);
    });

    const lastH = Math.floor((t.maxHc - 12) / 8);
    it(`COP-008: ${t.name}: WAIT H ${lastH} (hc ${lastH * 8 + 12}) matches; H ${lastH + 1} and 63 never do`, async () => {
      const s = await timedSession(core, t);
      const reached = (h: number) => {
        upload(s, [WAIT(100, h), MOVE(0x14, 0x5a), HALT]);
        s.setNextReg(0x14, 0xe3).setNextReg(0x62, 0xc0).runFrames(3);
        return s.readNextReg(0x14) === 0x5a;
      };
      expect([reached(lastH), reached(lastH + 1), reached(63)]).toEqual([true, false, false]);
    });
  }

  it("COP-009: mode 11 runs the list again every frame; 01 and 10 run it once", async () => {
    const s = await parkedSession(core);
    const again = (mode: number) => {
      upload(s, [MOVE(0x14, 0x5a), HALT]);
      s.setNextReg(0x14, 0xe3).setNextReg(0x62, mode).runFrames(2);
      const first = s.readNextReg(0x14);
      s.setNextReg(0x14, 0x33).runFrames(2);
      return [first, s.readNextReg(0x14)];
    };
    expect(again(0xc0), "11").toEqual([0x5a, 0x5a]);
    expect(again(0x40), "01").toEqual([0x5a, 0x33]);
    // --- a change to 10 keeps the address (COP-010), so 10 needs a copper that has not run: address 0
    const f = await parkedSession(core);
    upload(f, [MOVE(0x14, 0x5a), HALT]);
    f.setNextReg(0x14, 0xe3).setNextReg(0x62, 0x80).runFrames(2);
    const first = f.readNextReg(0x14);
    f.setNextReg(0x14, 0x33).runFrames(2);
    expect([first, f.readNextReg(0x14)], "10 from address 0").toEqual([0x5a, 0x33]);
  });

  it("COP-010: only a change of mode to 01 or 11 restarts the list; rewriting the mode, 00 and 10 keep the address", async () => {
    const s = await parkedSession(core);
    upload(s, [MOVE(0x14, 0x5a), HALT]);
    s.setNextReg(0x62, 0x40).runFrames(2); // --- ran once: the address is at the HALT
    const after = (mode: number) => {
      s.setNextReg(0x14, 0x33).setNextReg(0x62, mode).runFrames(2);
      return s.readNextReg(0x14);
    };
    expect(after(0x40), "01 -> 01: no change, no restart").toBe(0x33);
    expect(after(0x80), "01 -> 10: continues at the HALT").toBe(0x33);
    expect(after(0x80), "10 -> 10").toBe(0x33);
    expect(after(0x40), "10 -> 01: restarts").toBe(0x5a);
    expect(after(0x00), "01 -> 00: stopped").toBe(0x33);
    expect(after(0x80), "00 -> 10: continues at the HALT").toBe(0x33);
    expect(after(0xc0), "10 -> 11: restarts").toBe(0x5a);
    expect(after(0x40), "11 -> 01: restarts").toBe(0x5a);
  });

  /*
   * COP-011: MOVE $62,$00 is written two ticks after its fetch; the copper fetches the next MOVE on the
   * second tick, still in mode 01, and that MOVE's write goes out even though the mode is 00 by then
   * (copper_req only follows copper_dout's rising edge). The one after it never runs; mode 10 later
   * continues there.
   */
  it("COP-011: a copper MOVE to $62 stops the copper after one more MOVE; 10 continues from there", async () => {
    const s = await parkedSession(core);
    upload(s, [MOVE(0x62, 0x00), MOVE(0x14, 0x5a), MOVE(0x4a, 0x5a), HALT]);
    s.setNextReg(0x14, 0xe3).setNextReg(0x4a, 0xe3).setNextReg(0x62, 0x40).runFrames(2);
    expect(
      { mode: s.readNextReg(0x62) >> 6, next: s.readNextReg(0x14), afterNext: s.readNextReg(0x4a) },
      "after the copper stopped itself"
    ).toEqual({ mode: 0, next: 0x5a, afterNext: 0xe3 });
    s.setNextReg(0x62, 0x80).runFrames(1);
    expect(s.readNextReg(0x4a), "mode 10 continues with the instruction after").toBe(0x5a);
  });

  /*
   * COP-012 / COP-013: eight 24-line bands on PAPER 0 (entry 16), as C02, under each timing; with $64 = 32
   * every WAIT line is 32 higher for the same band (cvc = $64 at display line 0).
   */
  for (const t of TIMINGS) {
    for (const offset of [0, 32]) {
      it(`COP-012${offset ? " / COP-013" : ""}: ${t.name}${offset ? `, $64 = ${offset}` : ""}: bands at the same display rows`, async () => {
        const s = await timedSession(core, t);
        const colours = [0x00, 0xe0, 0x1c, 0x03, 0xfc, 0x1f, 0xa2, 0xff];
        const list: number[] = [];
        colours.forEach((c, k) => {
          if (k > 0) list.push(WAIT(24 * k + offset));
          list.push(MOVE(0x40, 16), MOVE(0x41, c));
        });
        list.push(HALT);
        s.setNextReg(0x43, 0x00).setNextReg(0x40, 16 + 2).setNextReg(0x41, 0x49).setNextReg(0x14, 0xe3);
        s.poke(0x4000, new Array(0x1800).fill(0)).poke(0x5800, new Array(768).fill(0)).out(0xfe, 2);
        upload(s, list).setNextReg(0x64, offset).setNextReg(0x62, 0xc0).runFrames(3);
        // --- the paper's first row: the first row of the column that is not the border colour
        const column = Array.from({ length: 288 }, (_, y) => s.pixel(360, y));
        const top = column.findIndex((c) => c !== column[0]);
        const bad: string[] = [];
        colours.forEach((c, k) => {
          for (let r = 24 * k + 1; r <= 24 * k + 22; r += 3) {
            const got = s.pixel(360, top + r);
            if (got !== s.pixel(361, top + r) || got !== next8(c)) bad.push(`row ${r}: ${got} != ${next8(c)} (band ${k})`);
          }
        });
        expect(top, "paper top found").toBeGreaterThan(0);
        expect(bad.slice(0, 6)).toEqual([]);
      });
    }
  }

  it("COP-014: a copper MOVE reaches any register below $80: MMU slot 6 and the CPU speed", async () => {
    const s = await parkedSession(core);
    s.setNextReg(0x56, 10).poke(0xc000, 0x5a).setNextReg(0x56, 0x00).poke(0xc000, 0x11);
    upload(s, [MOVE(0x56, 10), MOVE(0x07, 0x02), HALT]).setNextReg(0x07, 0x00).setNextReg(0x62, 0x40).runFrames(2);
    expect({ c000: s.peek(0xc000), mmu6: s.readNextReg(0x56), speed: s.readNextReg(0x07) & 0x03 }).toEqual({
      c000: 0x5a,
      mmu6: 10,
      speed: 0x02
    });
  });

  it("COP-015: CPU NextReg writes are not lost while the copper writes a register every other tick", async () => {
    const s = await parkedSession(core);
    // --- WAIT line 20, then 1000 MOVEs to $4A (one write every 2 ticks for ~2000 ticks), HALT
    const list = [WAIT(20)];
    for (let i = 0; i < 1000; i++) list.push(MOVE(0x4a, i & 0xff));
    list.push(HALT);
    upload(s, list).setNextReg(0x62, 0xc0);
    await s.loadCode(`
        .org $8000
        di
        nextreg $07,3            ; 28 MHz: 64 writes take about as long as the copper burst
        nextreg $43,$00
        ld bc,$243b
        ld a,$1f
        out (c),a
        ld bc,$253b
Wait1:  in a,(c)
        cp 19
        jr nz,Wait1
Wait2:  in a,(c)
        cp 20
        jr nz,Wait2
        nextreg $40,0
        ld b,64
        ld a,$81
Loop:   nextreg $41,a
        inc a
        djnz Loop
        nextreg $7f,$a5
        jr $
    `);
    s.runUntilReady();
    const got = Array.from({ length: 64 }, (_, i) => (s.setNextReg(0x40, i), s.readNextReg(0x41)));
    expect(got).toEqual(Array.from({ length: 64 }, (_, i) => 0x81 + i));
    s.runFrames(1);
    expect(s.readNextReg(0x4a), "the copper's last MOVE").toBe(999 & 0xff);
  });
});

