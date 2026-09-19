import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";

/*
 * The expansion bus registers with nothing plugged into the bus (catalogue BUS-001 - BUS-005).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`, `_input/next-fpga/nextreg.txt`):
 * - ~2138-2151: `$80` (`nr_80_expbus`, power-on X"00", ~352) is written whole; a reset copies bits 3-0
 *   into 7-4 and keeps 3-0. ~6069 reads it back whole.
 * - ~5468-5472, ~6072: `$81` stores bits 6-4 (ULA override, NMI debounce off, clock propagate); bits
 *   1-0 (max speed with the bus on) are hard-wired "00"; bit 7 reads `i_BUS_ROMCS_n`, which is 1 only
 *   while a peripheral asserts ROMCS (~207: "1 disables internal rom"). No reset branch: a soft reset
 *   keeps it; only power-on clears it (~1215-1218).
 * - ~5487-5498, ~6084-6093: `$86`-`$88` are whole bytes; `$89` stores bits 3-0 and the reset type in
 *   bit 7 and reads `reset_type & "000" & enables`. ~5039-5045: a reset sets all four to 1s when `$89`
 *   bit 7 is 0 (nextreg.txt: "soft reset if bit 31 = 0") - the opposite sense to `$85`. The reset type
 *   powers on 1 (~1228) and has no reset branch.
 * - ~5500, ~6096: `$8A` stores bits 5-0; no reset branch, power-on 0 (~1229).
 * - ~2348-2349: with `$80` bit 7 set every port enable is (`$86`-`$89` AND `$82`-`$85`); with it clear
 *   `$82`-`$85` alone. ~1826-1834: a read no internal device answers reads the bus with the bus on
 *   (`i_BUS_DI`: $FF with nothing plugged in) and $FF with it off.
 * - ~3450-3460, ~2541: port `$FE` with the bus on and `$8A` bit 0 set: an even port whose A7-4 = 0000
 *   reads $FF instead of the keyboard while `$81` bit 6 is set (the Rotronics Wafadrive override), and
 *   the bus data (all 1s here) is ANDed into every keyboard read.
 * - ~2175-2177: `$8A` sends a port's cycles to the bus as well; the internal device still answers it.
 */

const hex = (v: number) => `$${v.toString(16).padStart(2, "0")}`;

async function parked(core: CoreName): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(" .org $8000\n di\n jr $");
  return s.runFrames(1);
}

/*
 * A port group behind one internal enable bit, and how to see whether it answers. `observe` returns a
 * value that differs between the device answering and not.
 */
type Gate = { bit: number; what: string; observe: (s: NextTestSession) => number };
const GATES: Gate[] = [
  {
    bit: 1,
    what: "$7FFD paging ($86 bit 1)",
    // --- A $7FFD write pages its bank into MMU6/7 (~4590); `$56` reads MMU6
    observe: (s) => s.out(0x7ffd, 0x03).readNextReg(0x56)
  },
  {
    bit: 13,
    what: "Kempston mouse ($87 bit 5)",
    observe: (s) => s.mouse({ dx: 5 }).in(0xfbdf)
  },
  {
    bit: 16,
    what: "AY ($88 bit 0)",
    observe: (s) => s.out(0xfffd, 0x00).out(0xbffd, 0x5a).in(0xfffd)
  },
  {
    bit: 24,
    what: "ULA+ ($89 bit 0)",
    // --- Mode group 01: $FF3B holds the ULA+ enable (ula/ulaplus-ports)
    observe: (s) => s.out(0xbf3b, 0x40).out(0xff3b, 0x01).in(0xff3b)
  },
  {
    bit: 27,
    what: "CTC ($89 bit 3)",
    // --- Channel 0: a timer control word with a time constant ($10) that follows; the counter reads
    // --- at most $10
    observe: (s) => s.out(0x183b, 0x05).out(0x183b, 0x10).in(0x183b)
  }
];

type GateSetup = { busOn: boolean; internal: boolean; bus: boolean };

/** Clears `bit` of the 32-bit enable starting at `base` ($82 or $86), keeping the other bits. */
function clearEnable(s: NextTestSession, base: number, bit: number) {
  const reg = base + (bit >> 3);
  s.setNextReg(reg, s.readNextReg(reg) & ~(1 << (bit & 7)));
}

async function observeGate(core: CoreName, gate: Gate, setup: GateSetup) {
  const s = await parked(core);
  // --- $83 bit 5 (mouse) also switches the $DF Kempston alias; turn the Specdrum port off so a
  // --- disabled mouse port has no other reader
  s.setNextReg(0x84, s.readNextReg(0x84) & 0x7f);
  if (!setup.internal) clearEnable(s, 0x82, gate.bit);
  if (!setup.bus) clearEnable(s, 0x86, gate.bit);
  s.setNextReg(0x80, setup.busOn ? 0x80 : 0x00);
  return gate.observe(s);
}

describe.each(ALL_CORES)("expansion bus - %s core", (core) => {
  // -------------------------------------------------------------------------------------------------
  // BUS-001: $80
  // -------------------------------------------------------------------------------------------------

  it("BUS-001: $80 powers on $00 and reads back every bit written", async () => {
    const s = await parked(core);
    expect(hex(s.readNextReg(0x80)), "power-on").toBe("$00");
    for (const v of [0xa5, 0x5a, 0xff, 0x0f, 0x00]) {
      expect(hex(s.setNextReg(0x80, v).readNextReg(0x80)), hex(v)).toBe(hex(v));
    }
  });

  it("BUS-001: a soft reset copies bits 3-0 into 7-4; a hard reset clears $80", async () => {
    for (const [write, after] of [
      [0x05, 0x55],
      [0xf0, 0x00],
      [0x0a, 0xaa],
      [0xa7, 0x77],
      [0x08, 0x88]
    ]) {
      const s = await parked(core);
      s.setNextReg(0x80, write).reset();
      expect(hex(s.readNextReg(0x80)), `${hex(write)} then a soft reset`).toBe(hex(after));
      s.hardReset();
      expect(hex(s.readNextReg(0x80)), `${hex(write)} then a hard reset`).toBe("$00");
    }
  });

  it("BUS-001: the bus on with nothing plugged in: the internal ROM, keyboard and ports answer; others read $FF", async () => {
    const s = await parked(core);
    const rom = s.peekBytes(0x0000, 64);
    s.setNextReg(0x80, 0x80);
    // --- ROMCS is not asserted: the ROM is still the internal one (~3139, ~3034)
    expect(s.peekBytes(0x0000, 64), "ROM").toEqual(rom);
    // --- IORQULA is not asserted: port $FE is still the ULA (~2180)
    s.keyDown("SPACE");
    expect(hex(s.in(0x7ffe) & 0x1f), "SPACE").toBe("$1e");
    // --- Unanswered ports read the bus: $FF (PORT-011's list)
    for (const port of [0x8001, 0xab31, 0x4001, 0x00e7, 0x8f7b]) {
      expect(hex(s.in(port)), `$${port.toString(16)}`).toBe("$ff");
    }
  });

  // -------------------------------------------------------------------------------------------------
  // BUS-002: $81
  // -------------------------------------------------------------------------------------------------

  it("BUS-002: $81 stores bits 6-4; bits 3-0 read 0 and bit 7 (ROMCS) reads 0 with nothing plugged in", async () => {
    const s = await parked(core);
    expect(hex(s.readNextReg(0x81)), "power-on").toBe("$00");
    for (const [write, back] of [
      [0xff, 0x70],
      [0x4f, 0x40],
      [0x23, 0x20],
      [0x10, 0x10],
      [0x00, 0x00]
    ]) {
      expect(hex(s.setNextReg(0x81, write).readNextReg(0x81)), hex(write)).toBe(hex(back));
    }
    // --- The bus on changes nothing: no peripheral drives ROMCS
    s.setNextReg(0x80, 0x80).setNextReg(0x81, 0x70);
    expect(hex(s.readNextReg(0x81)), "bus on").toBe("$70");
  });

  it("BUS-002: a soft reset keeps $81; a hard reset clears it", async () => {
    const s = await parked(core);
    s.setNextReg(0x81, 0x70).reset();
    expect(hex(s.readNextReg(0x81)), "soft reset").toBe("$70");
    s.hardReset();
    expect(hex(s.readNextReg(0x81)), "hard reset").toBe("$00");
  });

  it("BUS-002: $81 bit 6 (ULA override) makes even ports with A7-4 = 0000 read $FF when $FE propagates", async () => {
    const read = async (regs: { r80: number; r81: number; r8a: number }, port: number) => {
      const s = await parked(core);
      s.setNextReg(0x80, regs.r80).setNextReg(0x81, regs.r81).setNextReg(0x8a, regs.r8a);
      s.keyDown("SPACE");
      return s.in(port);
    };
    const on = { r80: 0x80, r81: 0x40, r8a: 0x01 };
    expect(hex(await read(on, 0x7f0e)), "override: $7F0E").toBe("$ff");
    expect(hex(await read(on, 0x7f00)), "override: $7F00").toBe("$ff");
    // --- A7-4 = 1111: not overridden
    expect(hex((await read(on, 0x7ffe)) & 0x1f), "$7FFE").toBe("$1e");
    // --- Each condition of ~3455 alone keeps the keyboard
    expect(hex((await read({ ...on, r81: 0x00 }, 0x7f0e)) & 0x1f), "$81 bit 6 clear").toBe("$1e");
    expect(hex((await read({ ...on, r8a: 0x00 }, 0x7f0e)) & 0x1f), "$8A bit 0 clear").toBe("$1e");
    expect(hex((await read({ ...on, r80: 0x00 }, 0x7f0e)) & 0x1f), "bus off").toBe("$1e");
  });

  // -------------------------------------------------------------------------------------------------
  // BUS-003: $86-$89
  // -------------------------------------------------------------------------------------------------

  it("BUS-003: $86-$88 read back whole; $89 reads reset type & 000 & bits 3-0; all power on 1s", async () => {
    const s = await parked(core);
    expect([0x86, 0x87, 0x88, 0x89].map((r) => hex(s.readNextReg(r))), "power-on").toEqual(["$ff", "$ff", "$ff", "$8f"]);
    s.setNextReg(0x86, 0x5a).setNextReg(0x87, 0xa5).setNextReg(0x88, 0x3c).setNextReg(0x89, 0xf3);
    expect([0x86, 0x87, 0x88, 0x89].map((r) => hex(s.readNextReg(r)))).toEqual(["$5a", "$a5", "$3c", "$83"]);
    expect(hex(s.setNextReg(0x89, 0x7a).readNextReg(0x89)), "$7A").toBe("$0a");
  });

  it("BUS-003: a soft reset sets $86-$89 to 1s when $89 bit 7 is 0, and keeps them when it is 1", async () => {
    const s = await parked(core);
    s.setNextReg(0x86, 0x5a).setNextReg(0x87, 0xa5).setNextReg(0x88, 0x3c).setNextReg(0x89, 0x0a).reset();
    expect([0x86, 0x87, 0x88, 0x89].map((r) => hex(s.readNextReg(r))), "bit 7 = 0").toEqual(["$ff", "$ff", "$ff", "$0f"]);
    s.setNextReg(0x86, 0x5a).setNextReg(0x87, 0xa5).setNextReg(0x88, 0x3c).setNextReg(0x89, 0x8a).reset();
    expect([0x86, 0x87, 0x88, 0x89].map((r) => hex(s.readNextReg(r))), "bit 7 = 1").toEqual(["$5a", "$a5", "$3c", "$8a"]);
    s.hardReset();
    expect([0x86, 0x87, 0x88, 0x89].map((r) => hex(s.readNextReg(r))), "hard reset").toEqual(["$ff", "$ff", "$ff", "$8f"]);
  });

  describe.each(GATES)("BUS-003: $what", (gate) => {
    it("with the bus on, clearing the $86-$89 bit disables the device like clearing the $82-$85 bit", async () => {
      const enabled = await observeGate(core, gate, { busOn: true, internal: true, bus: true });
      const internalOff = await observeGate(core, gate, { busOn: false, internal: false, bus: true });
      expect(hex(internalOff), "the scenario tells enabled from disabled").not.toBe(hex(enabled));
      expect(hex(await observeGate(core, gate, { busOn: true, internal: true, bus: false })), "bus bit clear").toBe(
        hex(internalOff)
      );
      // --- AND, not OR: a set bus bit does not re-enable a disabled internal port
      expect(hex(await observeGate(core, gate, { busOn: true, internal: false, bus: true })), "internal bit clear").toBe(
        hex(internalOff)
      );
    });

    // -----------------------------------------------------------------------------------------------
    // BUS-005: the bus off
    // -----------------------------------------------------------------------------------------------

    it("BUS-005: with the bus off, a cleared $86-$89 bit has no effect", async () => {
      const enabled = await observeGate(core, gate, { busOn: false, internal: true, bus: true });
      expect(hex(await observeGate(core, gate, { busOn: false, internal: true, bus: false }))).toBe(hex(enabled));
    });
  });

  it("BUS-005: $80 bits 6-4 without bit 7 change nothing: ports and the ROM still answer", async () => {
    const s = await parked(core);
    const rom = s.peekBytes(0x0000, 64);
    s.setNextReg(0x80, 0x70);
    expect(s.peekBytes(0x0000, 64), "ROM").toEqual(rom);
    expect(hex(s.out(0x7ffd, 0x03).readNextReg(0x56)), "$7FFD").toBe("$06");
    s.keyDown("SPACE");
    expect(hex(s.in(0x7ffe) & 0x1f), "SPACE").toBe("$1e");
  });

  // -------------------------------------------------------------------------------------------------
  // BUS-004: $8A
  // -------------------------------------------------------------------------------------------------

  it("BUS-004: $8A stores bits 5-0; a soft reset keeps it, a hard reset clears it", async () => {
    const s = await parked(core);
    expect(hex(s.readNextReg(0x8a)), "power-on").toBe("$00");
    expect(hex(s.setNextReg(0x8a, 0xff).readNextReg(0x8a)), "$FF").toBe("$3f");
    expect(hex(s.setNextReg(0x8a, 0x95).readNextReg(0x8a)), "$95").toBe("$15");
    s.reset();
    expect(hex(s.readNextReg(0x8a)), "soft reset").toBe("$15");
    s.hardReset();
    expect(hex(s.readNextReg(0x8a)), "hard reset").toBe("$00");
  });

  it("BUS-004: propagated ports still answer internally", async () => {
    const s = await parked(core);
    s.setNextReg(0x80, 0x80).setNextReg(0x8a, 0x3f);
    expect(hex(s.out(0x7ffd, 0x03).readNextReg(0x56)), "$7FFD").toBe("$06");
    // --- $FE ANDs in the bus data - $FF with nothing plugged in
    s.keyDown("SPACE");
    expect(hex(s.in(0x7ffe) & 0x1f), "SPACE").toBe("$1e");
  });
});
