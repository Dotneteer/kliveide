import { describe, expect, it } from "vitest";

import { DCK_BANK_DOCK, type DckImage } from "@common/timex/dckFile";
import { createTimexSession, type TimexTestSession } from "../harness/timex";
import { displayFileAddress } from "./_timex-helpers";

/*
 * The 2068s' memory (`.plans/TIMEX_SCORPION_PLAN.md` G9.4b, §8): eight 8K chunks, each HOME unless
 * its bit in port $F4 is set, then the DOCK ($FF bit 7 clear) or the EXROM bank (set) - TS2068
 * Technical Manual 2.1.8.1, 2.1.13.5. The display always comes from HOME (5.1.1), and the SCLD
 * contends only the display RAM. These run on the 48K ROM, which the machines boot without their
 * own; the EXROM comes from the test.
 */

/** A cartridge: chunk 4 ROM ($A4 then the chunk number), chunk 5 RAM without an image, the rest empty */
function cartridge(): DckImage {
  const rom = new Uint8Array(0x2000).fill(0xa4);
  rom[1] = 4;
  return {
    banks: [
      {
        bank: DCK_BANK_DOCK,
        chunkTypes: [0, 0, 0, 0, 0x02, 0x01, 0, 0],
        chunks: [undefined, undefined, undefined, undefined, rom, undefined, undefined, undefined]
      }
    ]
  };
}

async function ts2068(): Promise<TimexTestSession> {
  const s = await createTimexSession({ model: "ts2068" });
  s.bootToBasic();
  s.machine.iff1 = false;
  return s;
}

describe("2068 chunk map (ports $F4 and $FF bit 7)", () => {
  it("maps every chunk to HOME after a reset", async () => {
    const s = await ts2068();
    expect(s.in(0x00f4)).toBe(0);
    expect(Array.from({ length: 8 }, (_, c) => s.exports.timexGetChunkSource(c))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("maps a DOCK chunk where $F4 sets its bit; an empty DOCK chunk reads $FF and ignores writes", async () => {
    const s = await ts2068();
    s.insertCartridge(cartridge());
    s.poke(0x8000, 0x11).poke(0xa000, 0x22).poke(0xc000, 0x33);
    s.out(0x00f4, 0x70); // --- chunks 4, 5, 6 to the DOCK
    expect(s.in(0x00f4)).toBe(0x70);
    expect([s.cpuPeek(0x8000), s.cpuPeek(0x8001)]).toEqual([0xa4, 4]); // --- the cartridge ROM
    expect(s.cpuPeek(0xa000)).toBe(0x00); // --- cartridge RAM, cleared
    expect(s.cpuPeek(0xc000)).toBe(0xff); // --- no chunk 6 in the cartridge
    // --- Writes: ROM ignored, RAM kept, the empty chunk ignored
    s.timex.doWriteMemory(0x8000, 0x55);
    s.timex.doWriteMemory(0xa000, 0x66);
    s.timex.doWriteMemory(0xc000, 0x77);
    expect([s.cpuPeek(0x8000), s.cpuPeek(0xa000), s.cpuPeek(0xc000)]).toEqual([0xa4, 0x66, 0xff]);
    // --- HOME is still underneath, untouched
    s.out(0x00f4, 0x00);
    expect([s.cpuPeek(0x8000), s.cpuPeek(0xa000), s.cpuPeek(0xc000)]).toEqual([0x11, 0x22, 0x33]);
  });

  it("switches every chunk independently", async () => {
    const s = await ts2068();
    const ram = Array.from({ length: 8 }, (_, c) => new Uint8Array(0x2000).fill(0xd0 + c));
    s.insertCartridge({ banks: [{ bank: DCK_BANK_DOCK, chunkTypes: [3, 3, 3, 3, 3, 3, 3, 3], chunks: ram }] });
    for (let chunk = 0; chunk < 8; chunk++) {
      s.out(0x00f4, 1 << chunk);
      const seen = Array.from({ length: 8 }, (_, c) => s.exports.timexGetChunkSource(c));
      expect(seen, `chunk ${chunk}`).toEqual(Array.from({ length: 8 }, (_, c) => (c === chunk ? 1 : 0)));
      expect(s.cpuPeek(chunk * 0x2000 + 0x123)).toBe(0xd0 + chunk);
    }
    s.out(0x00f4, 0);
  });

  it("maps the EXROM bank instead when port $FF bit 7 is set; the 8K EXROM answers in every chunk", async () => {
    const s = await ts2068();
    for (let i = 0; i < 0x2000; i++) s.exports.timexUploadExromByte(i, i & 0xff);
    s.out(0x00f4, 0x81); // --- chunks 0 and 7
    expect(s.cpuPeek(0x0005)).not.toBe(0x05); // --- still the DOCK bank: empty, $FF
    s.out(0x00ff, 0x80);
    expect([s.cpuPeek(0x0005), s.cpuPeek(0xe005)]).toEqual([0x05, 0x05]);
    expect([s.exports.timexGetChunkSource(0), s.exports.timexGetChunkSource(7)]).toEqual([2, 2]);
    // --- A ROM: writes are ignored
    s.timex.doWriteMemory(0xe005, 0x99);
    expect(s.cpuPeek(0xe005)).toBe(0x05);
    s.out(0x00ff, 0x00).out(0x00f4, 0x00);
    expect(s.exports.timexGetChunkSource(0)).toBe(0);
  });

  it("without an EXROM (no 2068 ROM named), the EXROM bank reads $FF", async () => {
    const s = await ts2068();
    expect(s.exports.timexGetExromLoaded()).toBe(0);
    s.out(0x00ff, 0x80).out(0x00f4, 0x01);
    expect(s.cpuPeek(0x0000)).toBe(0xff);
    expect(s.exports.timexGetChunkSource(0)).toBe(3);
  });

  it("shows the HOME display file whatever the CPU maps over it", async () => {
    const s = await ts2068();
    s.insertCartridge({ banks: [{ bank: DCK_BANK_DOCK, chunkTypes: [0, 0, 1, 0, 0, 0, 0, 0], chunks: [] }] });
    s.poke(displayFileAddress(0, 0), 0xff).poke(0x5800, 0x38 | 0x02);
    s.out(0x00f4, 0x04); // --- chunk 2 ($4000-$5FFF) to cartridge RAM
    s.timex.doWriteMemory(displayFileAddress(0, 0), 0x00);
    s.timex.doWriteMemory(0x5800, 0x07);
    s.renderNow();
    // --- Still HOME's ink 2 on white, not the cartridge RAM's bytes
    expect(s.paperPixel(0, 0)).toBe(s.paperPixel(2, 0));
    expect(s.exports.sp48ReadScreenMemoryOffset(0)).toBe(0xff);
    expect(s.timex.readScreenMemory(0)).toBe(0xff);
  });

  it("contends the display RAM only while HOME is mapped there", async () => {
    const program = `
          .org $8000
      Main:
          ei
          halt
          di
          ld hl,$4000
          ld bc,3000         ; longer than a frame, so the loop crosses the paper
      Loop:
          ld a,(hl)          ; a read of the display RAM every iteration
          inc hl
          dec bc
          ld a,b
          or c
          jr nz,Loop
          ret
    `;
    const measure = async (f4: number) => {
      const s = await ts2068();
      s.insertCartridge({ banks: [{ bank: DCK_BANK_DOCK, chunkTypes: [0, 0, 1, 0, 0, 0, 0, 0], chunks: [] }] });
      await s.loadCode(program);
      s.out(0x00f4, f4);
      const before = s.machine.totalContentionDelaySinceStart;
      s.call("Main", { maxFrames: 8 });
      return s.machine.totalContentionDelaySinceStart - before;
    };
    expect(await measure(0x00)).toBeGreaterThan(0);
    expect(await measure(0x04)).toBe(0);
  });

  it("an empty cartridge slot: ejecting clears the DOCK", async () => {
    const s = await ts2068();
    s.insertCartridge(cartridge()).out(0x00f4, 0x10);
    expect(s.cpuPeek(0x8000)).toBe(0xa4);
    s.insertCartridge(undefined);
    expect(s.cpuPeek(0x8000)).toBe(0xff);
  });
});

describe("2068 port decoding", () => {
  it("answers port $FE only at the full low byte: OUT ($F4) and ($F6) leave the border alone", async () => {
    const s = await ts2068();
    s.out(0x00fe, 0x02);
    expect(s.exports.sp48GetBorderColor()).toBe(2);
    s.out(0x00f4, 0x05).out(0x00f4, 0x00).out(0x00f6, 0x05).out(0x007e, 0x05);
    expect(s.exports.sp48GetBorderColor()).toBe(2);
  });

  it("the TC2048 keeps the 48K's decoding (A0 low) and has no $F4", async () => {
    const s = await createTimexSession();
    s.bootToBasic();
    s.out(0x007e, 0x03);
    expect(s.exports.sp48GetBorderColor()).toBe(3);
    s.out(0x00f4, 0xff);
    expect(s.exports.timexGetPortF4()).toBe(0);
    expect(s.exports.timexGetChunkSource(0)).toBe(0);
  });
});
