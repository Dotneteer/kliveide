import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName } from "../../harness/zxnext";

/*
 * NextReg values across a reset (catalogue NR-012 / NR-013).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`): the FPGA's `reset` is asserted by both a soft and a
 * hard reset. Registers fall into two groups:
 *
 * - RESET: assigned in an `if reset = '1'` branch - the big NextReg process (~4907-5083), the MMU
 *   (~4590), `$07` (~5733), `port_ff_reg` (~3611, `$69` bits 5-0, `$22` bit 2), `port_7ffd_reg` /
 *   `port_dffd_reg` / `port_1ffd_reg` (~3645-3710, read through `$8E`), `port_123b_layer2_en` (~3888,
 *   `$69` bit 7), `port_ff3b_ulap_en` (~4527, `$68` bit 3), `$C2/$C3` (~2014), `$D9` (~3871), `$DA`
 *   (~3846). `$80` and `$8C` copy their low nibble into the high nibble (~2142, ~2211).
 * - KEPT: registers with no reset branch at all - only their declaration initial values (FPGA
 *   configuration) and the firmware set them: `$05`, `$06` bits 6/4/3/1-0, `$08` bits 5-0, `$09`
 *   bits 7-5, `$0A` bits 4/3/1-0, `$7F`, `$8F`. A soft reset must not touch them.
 *
 * Klive starts after the firmware, so power-on values of the KEPT group are not asserted here.
 * Values are read back through $243B/$253B, the formulas are the read mux (~5500-5720).
 */

type Row = {
  reg: number;
  what: string;
  /** Written before the reset, to move the register away from its reset value. */
  write: number;
  /** Expected readback after the reset, compared under `mask`. */
  expected: number;
  mask?: number;
  /** NextReg writes the row depends on, made before `write`. */
  before?: Array<[reg: number, value: number]>;
};

const RESET: Row[] = [
  { reg: 0x06, what: "hotkey enables (bits 7, 5) set", write: 0x00, expected: 0xa0, mask: 0xa0 },
  { reg: 0x07, what: "CPU speed request 3.5 MHz", write: 0x03, expected: 0x00, mask: 0x03 },
  { reg: 0x08, what: "$7FFD unlocked (7), contention on (6)", write: 0x40, expected: 0x80, mask: 0xc0 },
  { reg: 0x09, what: "sprite tie off", write: 0x10, expected: 0x00, mask: 0x10 },
  { reg: 0x0b, what: "joystick I/O mode", write: 0xb0, expected: 0x01 },
  { reg: 0x12, what: "Layer 2 active bank", write: 0x1d, expected: 0x08 },
  { reg: 0x13, what: "Layer 2 shadow bank", write: 0x1e, expected: 0x0b },
  { reg: 0x14, what: "global transparency", write: 0x5a, expected: 0xe3 },
  { reg: 0x15, what: "sprite/layer control", write: 0x15, expected: 0x00 },
  { reg: 0x16, what: "Layer 2 scroll X", write: 0x15, expected: 0x00 },
  { reg: 0x17, what: "Layer 2 scroll Y", write: 0x15, expected: 0x00 },
  { reg: 0x22, what: "line int enable, MSB, port $FF int disable", write: 0x07, expected: 0x00, mask: 0x07 },
  { reg: 0x23, what: "line interrupt line", write: 0x55, expected: 0x00 },
  { reg: 0x26, what: "ULA scroll X", write: 0x55, expected: 0x00 },
  { reg: 0x27, what: "ULA scroll Y", write: 0x55, expected: 0x00 },
  { reg: 0x2f, what: "tilemap scroll X MSB", write: 0x03, expected: 0x00 },
  { reg: 0x30, what: "tilemap scroll X", write: 0x55, expected: 0x00 },
  { reg: 0x31, what: "tilemap scroll Y", write: 0x55, expected: 0x00 },
  { reg: 0x32, what: "LoRes scroll X", write: 0x55, expected: 0x00 },
  { reg: 0x33, what: "LoRes scroll Y", write: 0x55, expected: 0x00 },
  { reg: 0x40, what: "palette index", write: 0x55, expected: 0x00 },
  { reg: 0x42, what: "ULANext format", write: 0x1f, expected: 0x07 },
  { reg: 0x43, what: "palette control", write: 0x7e, expected: 0x00 },
  { reg: 0x4a, what: "fallback colour", write: 0x5a, expected: 0xe3 },
  { reg: 0x4b, what: "sprite transparency index", write: 0x5a, expected: 0xe3 },
  { reg: 0x4c, what: "tilemap transparency index", write: 0x05, expected: 0x0f },
  { reg: 0x50, what: "MMU0", write: 0x20, expected: 0xff },
  { reg: 0x51, what: "MMU1", write: 0x21, expected: 0xff },
  { reg: 0x52, what: "MMU2", write: 0x22, expected: 0x0a },
  { reg: 0x53, what: "MMU3", write: 0x23, expected: 0x0b },
  { reg: 0x54, what: "MMU4", write: 0x24, expected: 0x04 },
  { reg: 0x55, what: "MMU5", write: 0x25, expected: 0x05 },
  { reg: 0x56, what: "MMU6", write: 0x26, expected: 0x00 },
  { reg: 0x57, what: "MMU7", write: 0x27, expected: 0x01 },
  { reg: 0x61, what: "copper address LSB", write: 0x55, expected: 0x00 },
  { reg: 0x62, what: "copper mode + address MSB", write: 0x01, expected: 0x00 },
  { reg: 0x64, what: "copper line offset", write: 0x55, expected: 0x00 },
  { reg: 0x68, what: "ULA control (ULA enabled, ULA+ off)", write: 0x95, expected: 0x00 },
  { reg: 0x69, what: "Layer 2 enable, $7FFD shadow, port $FF", write: 0xc2, expected: 0x00 },
  { reg: 0x6a, what: "LoRes control", write: 0x35, expected: 0x00 },
  { reg: 0x6b, what: "tilemap control", write: 0x55, expected: 0x00 },
  { reg: 0x6c, what: "default tilemap attribute", write: 0x55, expected: 0x00 },
  { reg: 0x6e, what: "tilemap base", write: 0x81, expected: 0x2c },
  { reg: 0x6f, what: "tile definitions base", write: 0x81, expected: 0x0c },
  { reg: 0x70, what: "Layer 2 control", write: 0x15, expected: 0x00 },
  { reg: 0x71, what: "Layer 2 scroll X MSB", write: 0x01, expected: 0x00 },
  // --- $82-$85 reset only with $85 bit 7 = 1 (nextreg.txt: "soft reset if bit 31 = 1"). Klive's
  // --- hard reset leaves it 0 (firmware choice), so the rows set it first.
  { reg: 0x82, what: "internal port enable 1", before: [[0x85, 0x8f]], write: 0x00, expected: 0xff },
  { reg: 0x83, what: "internal port enable 2", before: [[0x85, 0x8f]], write: 0x00, expected: 0xff },
  { reg: 0x84, what: "internal port enable 3", before: [[0x85, 0x8f]], write: 0x00, expected: 0xff },
  { reg: 0x85, what: "internal port enable 4 + reset type", write: 0x80, expected: 0x8f },
  { reg: 0x8e, what: "128K paging readback", write: 0x8f, expected: 0x08 },
  { reg: 0x90, what: "Pi GPIO output enable 1", write: 0xfc, expected: 0x00 },
  { reg: 0xa0, what: "Pi peripheral enable", write: 0x39, expected: 0x00 },
  { reg: 0xa2, what: "Pi I2S control", write: 0xdd, expected: 0x02 },
  { reg: 0xa8, what: "ESP GPIO0 enable", write: 0x01, expected: 0x00 },
  { reg: 0xb8, what: "DivMMC entry points 0", write: 0x00, expected: 0x83 },
  { reg: 0xb9, what: "DivMMC entry point valid 0", write: 0x00, expected: 0x01 },
  { reg: 0xba, what: "DivMMC entry point timing 0", write: 0xff, expected: 0x00 },
  { reg: 0xbb, what: "DivMMC entry points 1", write: 0x00, expected: 0xcd },
  // --- Bits 2-1 are the CPU's current IM: 0 straight after a reset, before any code runs.
  { reg: 0xc0, what: "interrupt control", write: 0xe9, expected: 0x00 },
  { reg: 0xc2, what: "NMI return address LSB", write: 0x55, expected: 0x00 },
  { reg: 0xc3, what: "NMI return address MSB", write: 0x55, expected: 0x00 },
  // --- Bit 0 is `not port_ff_interrupt_disable`, bit 1 the line interrupt enable.
  { reg: 0xc4, what: "interrupt enable 0", write: 0x02, expected: 0x81 },
  { reg: 0xc6, what: "interrupt enable 2", write: 0x77, expected: 0x00 },
  { reg: 0xcc, what: "DMA interrupt enable 0", write: 0x83, expected: 0x00 },
  { reg: 0xcd, what: "DMA interrupt enable 1", write: 0xff, expected: 0x00 },
  { reg: 0xce, what: "DMA interrupt enable 2", write: 0x77, expected: 0x00 },
  { reg: 0xd8, what: "FDC I/O trap enable", write: 0x01, expected: 0x00 },
  { reg: 0xd9, what: "I/O trap write value", write: 0x55, expected: 0x00 }
];

const COPY_LOW_NIBBLE: Row[] = [
  { reg: 0x80, what: "expansion bus: bits 3-0 copied to 7-4", write: 0x05, expected: 0x55 },
  { reg: 0x8c, what: "alt ROM: bits 3-0 copied to 7-4", write: 0x05, expected: 0x55 }
];

const KEPT: Row[] = [
  // --- Bit 2 (50/60 Hz) and bit 0 (scandoubler) left alone: they change the video timing.
  { reg: 0x05, what: "joystick modes", write: 0x48, expected: 0x48, mask: 0xfa },
  { reg: 0x06, what: "beep, NMI buttons, PSG mode", write: 0x5b, expected: 0x5b, mask: 0x5b },
  { reg: 0x08, what: "stereo, speaker, DAC, $FF read, TurboSound, issue 2", write: 0x2e, expected: 0x2e, mask: 0x3f },
  { reg: 0x09, what: "PSG mono", write: 0xa0, expected: 0xa0, mask: 0xe0 },
  { reg: 0x0a, what: "DivMMC automap, mouse buttons/DPI", write: 0x1a, expected: 0x1a, mask: 0x1b },
  { reg: 0x7f, what: "user register", write: 0x5a, expected: 0x5a },
  { reg: 0x85, what: "internal port enable reset type", write: 0x80, expected: 0x80, mask: 0x80 },
  { reg: 0x8f, what: "memory mapping mode", write: 0x01, expected: 0x01 }
];

const hex = (v: number) => `$${v.toString(16).padStart(2, "0")}`;

type ResetKind = "soft" | "hard";

/*
 * Klive's hard reset models power-on *plus the firmware* ("fast boot" in both cores' hardReset), so
 * after a hard reset the bits the firmware configures are not the VHDL reset values. Only the bits a
 * reset branch alone decides are compared there.
 */
const HARD_RESET_MASK: Record<number, number> = {
  0x06: 0x00, // --- system configuration, set by the firmware
  0x08: 0x00, // --- system configuration, set by the firmware
  0x85: 0x0f // --- bit 7 (reset type) has no reset branch; the firmware owns it
};

async function readAfterReset(core: CoreName, row: Row, kind: ResetKind, mask: number) {
  const s = await createSession(core);
  for (const [reg, value] of row.before ?? []) s.setNextReg(reg, value);
  s.setNextReg(row.reg, row.write);
  kind === "soft" ? s.reset() : s.hardReset();
  return s.readNextReg(row.reg) & mask;
}

describe.each(ALL_CORES)("NextRegs across a reset - %s core", (core) => {
  const title = (row: Row) => `${hex(row.reg)} ${row.what}`;

  describe.each(["soft", "hard"] as const)("%s reset returns a reset-branch register to its reset value", (kind) => {
    for (const row of RESET) {
      const mask = (row.mask ?? 0xff) & (kind === "hard" ? (HARD_RESET_MASK[row.reg] ?? 0xff) : 0xff);
      if (mask === 0) continue;
      it(`${title(row)} -> ${hex(row.expected & mask)}`, async () => {
        expect(hex(await readAfterReset(core, row, kind, mask))).toBe(hex(row.expected & mask));
      });
    }
  });

  describe("soft reset copies the low nibble into the high nibble", () => {
    for (const row of COPY_LOW_NIBBLE) {
      it(`${title(row)}`, async () => {
        expect(hex(await readAfterReset(core, row, "soft", 0xff))).toBe(hex(row.expected));
      });
    }
  });

  describe("soft reset keeps a register the hardware has no reset branch for", () => {
    for (const row of KEPT) {
      it(`${title(row)}`, async () => {
        const mask = row.mask ?? 0xff;
        expect(hex(await readAfterReset(core, row, "soft", mask))).toBe(hex(row.expected & mask));
      });
    }
  });

  it("soft reset keeps the internal port enables when $85 bit 7 is 0", async () => {
    const s = await createSession(core);
    s.setNextReg(0x85, 0x0a).setNextReg(0x82, 0x5a).setNextReg(0x83, 0xa5).setNextReg(0x84, 0x3c);
    s.reset();
    expect([0x82, 0x83, 0x84, 0x85].map((r) => hex(s.readNextReg(r)))).toEqual(["$5a", "$a5", "$3c", "$0a"]);
  });

  it("soft reset clears the clip window indices ($1C)", async () => {
    const s = await createSession(core);
    // --- One write to each clip register moves each 2-bit index to 1.
    for (const reg of [0x18, 0x19, 0x1a, 0x1b]) s.setNextReg(reg, 0x10);
    expect(s.readNextReg(0x1c)).toBe(0x55);
    s.reset();
    expect(s.readNextReg(0x1c)).toBe(0x00);
  });
});
