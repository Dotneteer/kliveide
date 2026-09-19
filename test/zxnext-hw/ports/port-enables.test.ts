import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type AudioSample, type CoreName, type NextTestSession } from "../../harness/zxnext";

/*
 * Internal port enables, NextRegs $82-$85 (catalogue PORT-001 - PORT-003).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~1219-1223: power-on $82-$84 = $FF, $85 enables = $F, $85 bit 7 (reset type) = 1; ~6084 $85 reads
 *   reset_type & "000" & enables.
 * - ~5030-5037: a reset sets all enables again only while $85 bit 7 = 1; bit 7 itself has no reset.
 * - ~2348-2400: `internal_port_enable` = $85(3:0) & $84 & $83 & $82 (expansion bus off); bit n gates
 *   the port listed below. A disabled port neither takes writes nor answers reads, so an IN that no
 *   device answers reads $FF (~1834, expansion bus off).
 *
 * Each scenario observes one port through the hardware: its own readback, a NextReg that mirrors the
 * write, the memory map it changes, or the audio it produces. It runs once with the bit set and once
 * with only that bit cleared.
 */

const MF_ROM = readFileSync(new URL("../../../src/public/roms/enNextMf.rom", import.meta.url));
const NEXT_ROM = readFileSync(new URL("../../../src/public/roms/enNextZX.rom", import.meta.url));

type Scenario = {
  bit: number;
  port: string;
  /** Extra enable bits to clear in both runs (bit 21 is only effective with bit 18 off). */
  alsoClear?: number[];
  audio?: boolean;
  observe: (s: NextTestSession) => Promise<unknown> | unknown;
  enabled: unknown;
  disabled: unknown;
};

/** Runs Z80 code to its end; the harness stops the frame there. */
async function run(s: NextTestSession, code: string): Promise<void> {
  await s.loadCode(`
        .org $8000
${code}
        nextreg $7f,$a5
        jr $
  `);
  s.setNextReg(0x7f, 0).runUntilReady();
}

/** zxnDMA memory-to-memory copy of 4 bytes $C000 -> $C100 through `port` (zxnext docs sequence). */
const dmaCopy = (port: number) => `
        ld hl,$c000
        ld (hl),$11
        inc hl
        ld (hl),$22
        inc hl
        ld (hl),$33
        inc hl
        ld (hl),$44
        ld hl,Dma
        ld b,DmaEnd-Dma
        ld c,${port}
        otir
        nop
        nop
        jr Done
Dma:    .defb $83                ; WR6 disable
        .defb $7d                ; WR0 A->B, port A address + length follow
        .defw $c000
        .defw 4
        .defb $54,$02            ; WR1 port A memory, increment, timing 2
        .defb $50,$02            ; WR2 port B memory, increment, timing 2
        .defb $ad                ; WR4 continuous, port B address follows
        .defw $c100
        .defb $82                ; WR5
        .defb $cf                ; WR6 load
        .defb $87                ; WR6 enable
DmaEnd:
Done:`;

/**
 * Whether writes to a DAC port reach the mixer: alternating $00 / $FF, one per frame, must move the
 * mixed output; with the DACs silent at $80 and nothing else playing it stays exactly flat (as in
 * `audio/dac-enable.test.ts`).
 */
function dacSwing(port: number) {
  return async (s: NextTestSession) => {
    await s.loadCode(" .org $8000\n jr $"); // --- park the CPU: the ROM would rewrite the NextRegs
    s.setNextReg(0x08, 0x08).runFrames(2).startAudio(); // --- $08 bit 3: DACs on
    for (let i = 0; i < 4; i++) s.out(port, i % 2 ? 0xff : 0x00).runFrames(1);
    const values = s.audio().map((a: AudioSample) => a.left + a.right);
    return Math.max(...values) - Math.min(...values) > 0;
  };
}

const SCENARIOS: Scenario[] = [
  {
    bit: 0, port: "$FF (Timex)",
    observe: (s) => {
      s.setNextReg(0x08, 0x04).out(0x00ff, 0x3a); // --- $08 bit 2: $FF reads the Timex register
      return [s.in(0x00ff), s.readNextReg(0x69) & 0x3f];
    },
    enabled: [0x3a, 0x3a],
    disabled: [0xff, 0x00] // --- +3 timing: no ULA floating bus on $FF (~4493)
  },
  { bit: 1, port: "$7FFD", observe: (s) => s.out(0x7ffd, 3).readNextReg(0x56), enabled: 0x06, disabled: 0x00 },
  { bit: 2, port: "$DFFD", observe: (s) => s.out(0xdffd, 1).readNextReg(0x56), enabled: 0x10, disabled: 0x00 },
  { bit: 3, port: "$1FFD", observe: (s) => s.out(0x1ffd, 1).readNextReg(0x50), enabled: 0x00, disabled: 0xff },
  {
    bit: 4, port: "$0FFD (+3 floating bus)",
    observe: async (s) => {
      // --- In the border, $0FFD reads the last contended (bank 4-7) memory access (zxula.vhd ~573)
      await run(s, `
        ld a,$a7
        ld ($6000),a
        ld bc,$0ffd
        in a,(c)
        ld ($a000),a`);
      return s.peek(0xa000);
    },
    enabled: 0xa7,
    disabled: 0xff
  },
  {
    bit: 5, port: "$6B (zxnDMA)",
    observe: async (s) => {
      await run(s, dmaCopy(0x6b));
      return Array.from(s.peekBytes(0xc100, 4));
    },
    enabled: [0x11, 0x22, 0x33, 0x44],
    disabled: [0, 0, 0, 0]
  },
  { bit: 6, port: "$1F (Kempston 1)", observe: (s) => s.setNextReg(0x05, 0x42).in(0x001f), enabled: 0x00, disabled: 0xff },
  { bit: 7, port: "$37 (Kempston 2)", observe: (s) => s.setNextReg(0x05, 0x42).in(0x0037), enabled: 0x00, disabled: 0xff },
  { bit: 8, port: "$E3 (DivMMC)", observe: (s) => s.out(0x00e3, 0x83).in(0x00e3), enabled: 0x83, disabled: 0xff },
  {
    bit: 9, port: "$9F (Multiface 48 enable)",
    observe: (s) => {
      // --- $0A bits 7-6 = 11 (48K Multiface, never invisible) can be set only in config mode
      s.setNextReg(0x03, 0x07).setNextReg(0x0a, s.readNextReg(0x0a) | 0xc0).setNextReg(0x03, 0x03);
      s.in(0x009f); // --- pages the Multiface ROM in (multiface.vhd ~180)
      return s.peek(0x0000);
    },
    enabled: MF_ROM[0],
    disabled: NEXT_ROM[0]
  },
  {
    bit: 10, port: "$103B (I2C SCL)",
    observe: (s) => s.out(0x103b, 0x00).in(0x103b), // --- drive SCL low, read the line
    enabled: 0xfe,
    disabled: 0xff
  },
  // --- bit 11 (SPI $E7/$EB) reads $FF enabled or not without an SD card: not observable here
  { bit: 12, port: "$133B (UART status)", observe: (s) => s.in(0x133b), enabled: 0x10, disabled: 0xff },
  // --- ~2630: with the mouse off $FADF is a $DF read, which Kempston 1 answers - no joystick mode here
  { bit: 13, port: "$FADF (mouse buttons)", observe: (s) => s.setNextReg(0x05, 0x00).in(0xfadf), enabled: 0x0f, disabled: 0xff },
  { bit: 14, port: "$303B (sprite status)", observe: (s) => s.in(0x303b), enabled: 0x00, disabled: 0xff },
  {
    bit: 15, port: "$123B (Layer 2)",
    observe: (s) => s.out(0x123b, 0x02) && [s.in(0x123b), s.readNextReg(0x69) & 0x80],
    enabled: [0x02, 0x80],
    disabled: [0xff, 0x00]
  },
  {
    bit: 16, port: "$FFFD/$BFFD (AY)",
    observe: (s) => s.out(0xfffd, 0x02).out(0xbffd, 0x5a).out(0xfffd, 0x02).in(0xfffd),
    enabled: 0x5a,
    disabled: 0xff
  },
  { bit: 17, port: "$1F (Soundrive 1 A)", audio: true, observe: dacSwing(0x1f), enabled: true, disabled: false },
  { bit: 18, port: "$F1 (Soundrive 2 A)", audio: true, observe: dacSwing(0xf1), enabled: true, disabled: false },
  { bit: 19, port: "$3F (Profi Covox A)", audio: true, observe: dacSwing(0x3f), enabled: true, disabled: false },
  {
    bit: 20, port: "$0F (Covox B)", audio: true, alsoClear: [17], // --- ~2388: $0F is Soundrive 1 B too
    observe: dacSwing(0x0f), enabled: true, disabled: false
  },
  {
    bit: 21, port: "$FB (Pentagon mono)", audio: true, alsoClear: [18], // --- ~2385: only with Soundrive 2 off
    observe: dacSwing(0xfb), enabled: true, disabled: false
  },
  { bit: 22, port: "$B3 (GS Covox)", audio: true, observe: dacSwing(0xb3), enabled: true, disabled: false },
  { bit: 23, port: "$DF (Specdrum)", audio: true, observe: dacSwing(0xdf), enabled: true, disabled: false },
  {
    bit: 24, port: "$BF3B/$FF3B (ULA+)",
    observe: (s) => s.out(0xbf3b, 0x40).in(0xff3b), // --- mode group: reads the ULA+ enable bit
    enabled: 0x00,
    disabled: 0xff
  },
  {
    bit: 25, port: "$0B (Z80 DMA)",
    observe: async (s) => {
      await run(s, dmaCopy(0x0b));
      return Array.from(s.peekBytes(0xc100, 4));
    },
    enabled: [0x11, 0x22, 0x33, 0x44],
    disabled: [0, 0, 0, 0]
  },
  { bit: 26, port: "$EFF7", observe: (s) => s.out(0xeff7, 0x08).readNextReg(0x50), enabled: 0x00, disabled: 0xff },
  {
    bit: 27, port: "$183B (CTC 0)",
    observe: (s) => s.out(0x183b, 0x07).out(0x183b, 0xc8).in(0x183b) <= 0xc8, // --- control + reset, TC $C8
    enabled: true,
    disabled: false
  }
];

const enableReg = (bit: number) => 0x82 + (bit >> 3);

async function session(core: CoreName, audio?: boolean): Promise<NextTestSession> {
  return createSession(core, audio ? { audioSampleRate: 48000 } : {});
}

function clearBits(s: NextTestSession, bits: number[]): void {
  for (const bit of bits) s.setNextReg(enableReg(bit), s.readNextReg(enableReg(bit)) & ~(1 << (bit & 7)) & (bit >= 24 ? 0x8f : 0xff));
}

describe.each(ALL_CORES)("internal port enables - %s core", (core) => {
  it("PORT-001: $82-$84 read $FF and $85 reads $8F after a hard reset", async () => {
    const s = await createSession(core);
    expect([0x82, 0x83, 0x84, 0x85].map((r) => s.readNextReg(r))).toEqual([0xff, 0xff, 0xff, 0x8f]);
  });

  for (const sc of SCENARIOS) {
    it(`PORT-002: bit ${sc.bit} gates ${sc.port}`, async () => {
      const on = await session(core, sc.audio);
      clearBits(on, sc.alsoClear ?? []);
      expect(await sc.observe(on), "enabled").toEqual(sc.enabled);

      const off = await session(core, sc.audio);
      clearBits(off, [...(sc.alsoClear ?? []), sc.bit]);
      expect(await sc.observe(off), "disabled").toEqual(sc.disabled);
    });
  }

  it("PORT-003: with $85 bit 7 set a soft reset re-enables every port", async () => {
    const s = await createSession(core);
    s.setNextReg(0x82, 0x00).setNextReg(0x83, 0x12).setNextReg(0x84, 0x34).setNextReg(0x85, 0x85).reset();
    expect([0x82, 0x83, 0x84, 0x85].map((r) => s.readNextReg(r))).toEqual([0xff, 0xff, 0xff, 0x8f]);
  });

  it("PORT-003: with $85 bit 7 clear a soft reset keeps the enables, and bit 7", async () => {
    const s = await createSession(core);
    s.setNextReg(0x82, 0x00).setNextReg(0x83, 0x12).setNextReg(0x84, 0x34).setNextReg(0x85, 0x05).reset();
    expect([0x82, 0x83, 0x84, 0x85].map((r) => s.readNextReg(r))).toEqual([0x00, 0x12, 0x34, 0x05]);
  });
});
