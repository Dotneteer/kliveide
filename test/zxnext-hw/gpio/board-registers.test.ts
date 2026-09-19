import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * Board registers: Pi GPIO, Pi peripherals, ESP GPIO, XDEV / XADC and the core boot register
 * (catalogue GPIO-001 - GPIO-007).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`, `_input/next-fpga/nextreg.txt`):
 * - ~5512-5522, ~6110-6120: `$90` stores bits 7-2 (GPIO 1-0 cannot be outputs), `$91`/`$92` whole
 *   bytes, `$93` bits 3-0. ~5053-5056: a reset clears them; power-on 0 (~1230-1233).
 * - ~5524-5534: `$98`-`$9B` write the pins' output latches; ~5048-5051: a reset sets them to $FF, $01,
 *   $00, $0. ~6122-6132: a read returns the pins themselves (`i_GPIO`), not the latches.
 * - ~6134: `$A0` reads "00" & bits 5-3 & "00" & bit 0; ~6137: `$A2` reads bits 7-6 & '0' & bits 4-2
 *   & '1' & bit 0. ~5058-5059: a reset clears both.
 * - ~5545-5549, ~6143-6146: `$A8` stores bit 0 (GPIO0 output enable); `$A9` stores bit 0 (GPIO0's
 *   output) and reads "00000" & GPIO2 & '0' & GPIO0 - the pins. ~5062-5063: a reset sets `$A8` to 0
 *   and the GPIO0 output to 1.
 * - ~5869: `$10` reads '0' & core ID & the DRIVE / M1 buttons; the core ID powers on "00001" (~1127)
 *   and has no reset branch. Issue 4 board (~5667-5683; Klive's `$0F` is 2): a write stores the core
 *   ID only in config mode, only with bit 4 = 0 and bits 3-0 /= 1111.
 * - ~7386-7530 (Issue 4 only): `$F0` is the XDEV command register. A reset selects select mode with no
 *   device ($80); a write with bit 7 = 1 enters select mode, bits 7-6 = 11 also select DNA (01) or
 *   XADC (10) - both or neither select none; bit 7 = 0 attaches the selected device. `$F8` reads
 *   '0' & DADDR; `$F9`/`$FA` are written from the Z80 or loaded by a DRP read. `$F8`-`$FA` have no
 *   reset branch.
 *
 * Nothing is plugged into the board, so some inputs are Klive's choice (both cores alike):
 * - A Pi GPIO pin the FPGA does not drive reads 1; a pin with its output enabled reads its latch.
 *   The Pi peripherals ($A0 SPI / I2C / UART, $A2 I2S) do not take over the pins.
 * - ESP GPIO0 / GPIO2 have board pull-ups (`zxnext_pins_issue*.ucf`/`.xdc`: PULLUP): they read 1
 *   unless GPIO0 drives its latch.
 * - There is no Xilinx DNA or XADC: in device mode `$F0` reads 0 (DNA bits 0, XADC never busy, no
 *   conversion ends), and a DRP read leaves `$F9`/`$FA` unchanged.
 * - The DRIVE and M1 buttons are pressed only as pulses (`pressHotkey`), so `$10` bits 1-0 read 0.
 */

const hex = (v: number) => `$${v.toString(16).padStart(2, "0")}`;

async function parked(): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(" .org $8000\n di\n jr $");
  return s.runFrames(1);
}

const read = (s: NextTestSession, regs: number[]) => regs.map((r) => hex(s.readNextReg(r)));

const OUTPUT_ENABLES = [0x90, 0x91, 0x92, 0x93];
const PINS = [0x98, 0x99, 0x9a, 0x9b];

describe("board registers", () => {
  // -------------------------------------------------------------------------------------------------
  // GPIO-001: Pi GPIO output enables
  // -------------------------------------------------------------------------------------------------

  it("GPIO-001: $90 stores bits 7-2, $91/$92 whole bytes, $93 bits 3-0; all power on 0", async () => {
    const s = await parked();
    expect(read(s, OUTPUT_ENABLES), "power-on").toEqual(["$00", "$00", "$00", "$00"]);
    for (const r of OUTPUT_ENABLES) s.setNextReg(r, 0xff);
    expect(read(s, OUTPUT_ENABLES), "$FF").toEqual(["$fc", "$ff", "$ff", "$0f"]);
    s.setNextReg(0x90, 0x5a).setNextReg(0x91, 0xa5).setNextReg(0x92, 0x3c).setNextReg(0x93, 0xc9);
    expect(read(s, OUTPUT_ENABLES)).toEqual(["$58", "$a5", "$3c", "$09"]);
  });

  it("GPIO-001: a soft reset clears the output enables", async () => {
    const s = await parked();
    for (const r of OUTPUT_ENABLES) s.setNextReg(r, 0xff);
    s.reset();
    expect(read(s, OUTPUT_ENABLES)).toEqual(["$00", "$00", "$00", "$00"]);
  });

  // -------------------------------------------------------------------------------------------------
  // GPIO-002: Pi GPIO pins
  // -------------------------------------------------------------------------------------------------

  it("GPIO-002: with nothing attached and no output enabled every pin reads 1", async () => {
    const s = await parked();
    expect(read(s, PINS), "power-on").toEqual(["$ff", "$ff", "$ff", "$0f"]);
    // --- A latch write alone does not reach the pin
    s.setNextReg(0x98, 0x00).setNextReg(0x99, 0x00).setNextReg(0x9a, 0x00).setNextReg(0x9b, 0x00);
    expect(read(s, PINS), "latches 0, outputs off").toEqual(["$ff", "$ff", "$ff", "$0f"]);
  });

  it("GPIO-002: a pin with its output enabled reads its latch; GPIO 1-0 never drive", async () => {
    const s = await parked();
    s.setNextReg(0x98, 0x5a).setNextReg(0x99, 0x00).setNextReg(0x9a, 0x96).setNextReg(0x9b, 0x05);
    s.setNextReg(0x90, 0xff).setNextReg(0x91, 0x0f).setNextReg(0x92, 0xff).setNextReg(0x93, 0x0e);
    // --- $98: bits 7-2 driven ($5A -> 010110xx), bits 1-0 undriven (1)
    // --- $99: bits 3-0 driven 0; $9B: bits 3-1 driven (010x), bit 0 undriven
    expect(read(s, PINS)).toEqual(["$5b", "$f0", "$96", "$05"]);
    // --- A latch written after the enable reaches the pin at once
    s.setNextReg(0x9a, 0x69);
    expect(hex(s.readNextReg(0x9a)), "$9A rewritten").toBe("$69");
  });

  it("GPIO-002: a soft reset sets the latches to $FF, $01, $00, $0 and turns the outputs off", async () => {
    const s = await parked();
    s.setNextReg(0x98, 0x00).setNextReg(0x99, 0xaa).setNextReg(0x9a, 0xff).setNextReg(0x9b, 0x0f);
    s.setNextReg(0x91, 0xff).reset();
    expect(read(s, PINS), "outputs off").toEqual(["$ff", "$ff", "$ff", "$0f"]);
    for (const r of OUTPUT_ENABLES) s.setNextReg(r, 0xff);
    expect(read(s, PINS), "outputs on: the reset latches").toEqual(["$ff", "$01", "$00", "$00"]);
  });

  // -------------------------------------------------------------------------------------------------
  // GPIO-003 / GPIO-004: Pi peripheral enable and I2S
  // -------------------------------------------------------------------------------------------------

  it("GPIO-003: $A0 reads 00 & bits 5-3 & 00 & bit 0; a soft reset clears it", async () => {
    const s = await parked();
    expect(hex(s.readNextReg(0xa0)), "power-on").toBe("$00");
    expect(hex(s.setNextReg(0xa0, 0xff).readNextReg(0xa0)), "$FF").toBe("$39");
    expect(hex(s.setNextReg(0xa0, 0xc6).readNextReg(0xa0)), "$C6").toBe("$00");
    expect(hex(s.setNextReg(0xa0, 0x29).readNextReg(0xa0)), "$29").toBe("$29");
    s.reset();
    expect(hex(s.readNextReg(0xa0)), "soft reset").toBe("$00");
  });

  it("GPIO-004: $A2 reads bits 7-6 & 0 & bits 4-2 & 1 & bit 0; a soft reset leaves $02", async () => {
    const s = await parked();
    expect(hex(s.readNextReg(0xa2)), "power-on").toBe("$02");
    expect(hex(s.setNextReg(0xa2, 0xff).readNextReg(0xa2)), "$FF").toBe("$df");
    expect(hex(s.setNextReg(0xa2, 0x00).readNextReg(0xa2)), "$00").toBe("$02");
    expect(hex(s.setNextReg(0xa2, 0x95).readNextReg(0xa2)), "$95").toBe("$97");
    s.setNextReg(0xa2, 0xff).reset();
    expect(hex(s.readNextReg(0xa2)), "soft reset").toBe("$02");
  });

  // -------------------------------------------------------------------------------------------------
  // GPIO-005: ESP GPIO
  // -------------------------------------------------------------------------------------------------

  it("GPIO-005: $A8 stores bit 0; a soft reset clears it", async () => {
    const s = await parked();
    expect(hex(s.readNextReg(0xa8)), "power-on").toBe("$00");
    expect(hex(s.setNextReg(0xa8, 0xff).readNextReg(0xa8)), "$FF").toBe("$01");
    expect(hex(s.setNextReg(0xa8, 0xfe).readNextReg(0xa8)), "$FE").toBe("$00");
    s.setNextReg(0xa8, 0x01).reset();
    expect(hex(s.readNextReg(0xa8)), "soft reset").toBe("$00");
  });

  it("GPIO-005: $A9 reads the pulled-up pins; GPIO0 shows its latch only while $A8 bit 0 drives it", async () => {
    const s = await parked();
    expect(hex(s.readNextReg(0xa9)), "power-on").toBe("$05");
    expect(hex(s.setNextReg(0xa9, 0x00).readNextReg(0xa9)), "latch 0, not driven").toBe("$05");
    expect(hex(s.setNextReg(0xa8, 0x01).readNextReg(0xa9)), "driven 0").toBe("$04");
    // --- GPIO2 is an input: writing its bit changes nothing
    expect(hex(s.setNextReg(0xa9, 0xfb).readNextReg(0xa9)), "driven 1").toBe("$05");
    expect(hex(s.setNextReg(0xa9, 0xfa).readNextReg(0xa9)), "driven 0, GPIO2 written 0").toBe("$04");
  });

  it("GPIO-005: a soft reset sets the GPIO0 latch to 1", async () => {
    const s = await parked();
    s.setNextReg(0xa9, 0x00).reset();
    expect(hex(s.setNextReg(0xa8, 0x01).readNextReg(0xa9))).toBe("$05");
  });

  // -------------------------------------------------------------------------------------------------
  // GPIO-006: XDEV / XADC (Issue 4)
  // -------------------------------------------------------------------------------------------------

  it("GPIO-006: $F0 powers on in select mode with no device and selects DNA or XADC with bits 7-6 = 11", async () => {
    const s = await parked();
    expect(hex(s.readNextReg(0x0f)), "Klive is an Issue 4 board").toBe("$02");
    expect(hex(s.readNextReg(0xf0)), "power-on").toBe("$80");
    expect(hex(s.setNextReg(0xf0, 0xc1).readNextReg(0xf0)), "select DNA").toBe("$81");
    expect(hex(s.setNextReg(0xf0, 0x82).readNextReg(0xf0)), "bit 6 = 0: selection kept").toBe("$81");
    expect(hex(s.setNextReg(0xf0, 0xc2).readNextReg(0xf0)), "select XADC").toBe("$82");
    expect(hex(s.setNextReg(0xf0, 0xc3).readNextReg(0xf0)), "both: none").toBe("$80");
    expect(hex(s.setNextReg(0xf0, 0xc2).setNextReg(0xf0, 0xc0).readNextReg(0xf0)), "00: none").toBe("$80");
  });

  it("GPIO-006: in device mode $F0 reads 0 (no DNA, no XADC); bit 7 returns to select mode", async () => {
    const s = await parked();
    s.setNextReg(0xf0, 0xc1).setNextReg(0xf0, 0x00);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => hex(s.readNextReg(0xf0))), "DNA bits").toEqual(Array(9).fill("$00"));
    expect(hex(s.setNextReg(0xf0, 0x80).readNextReg(0xf0)), "select mode again").toBe("$81");
    s.setNextReg(0xf0, 0xc2).setNextReg(0xf0, 0x01); // --- XADC, start a conversion
    s.runFrames(1);
    expect(hex(s.readNextReg(0xf0)), "XADC: not busy, nothing completed").toBe("$00");
    expect(hex(s.setNextReg(0xf0, 0x80).readNextReg(0xf0)), "select mode again").toBe("$82");
  });

  it("GPIO-006: a soft reset returns $F0 to select mode with no device", async () => {
    const s = await parked();
    s.setNextReg(0xf0, 0xc2).setNextReg(0xf0, 0x00).reset();
    expect(hex(s.readNextReg(0xf0))).toBe("$80");
  });

  it("GPIO-006: $F8 reads 0 & DADDR, $F9/$FA whole bytes; a DRP read changes nothing; soft reset keeps them", async () => {
    const s = await parked();
    expect(read(s, [0xf8, 0xf9, 0xfa]), "power-on").toEqual(["$00", "$00", "$00"]);
    s.setNextReg(0xf9, 0x5a).setNextReg(0xfa, 0xa5).setNextReg(0xf8, 0xff);
    expect(read(s, [0xf8, 0xf9, 0xfa]), "written").toEqual(["$7f", "$5a", "$a5"]);
    s.setNextReg(0xf8, 0x03).runFrames(1); // --- a DRP read of register 3: no XADC answers
    expect(read(s, [0xf8, 0xf9, 0xfa]), "DRP read").toEqual(["$03", "$5a", "$a5"]);
    s.reset();
    expect(read(s, [0xf8, 0xf9, 0xfa]), "soft reset").toEqual(["$03", "$5a", "$a5"]);
    s.hardReset();
    expect(read(s, [0xf8, 0xf9, 0xfa]), "hard reset").toEqual(["$00", "$00", "$00"]);
  });

  // -------------------------------------------------------------------------------------------------
  // GPIO-007: core boot
  // -------------------------------------------------------------------------------------------------

  it("GPIO-007: $10 reads core ID 1 and idle buttons ($04); bit 7 reads 0", async () => {
    const s = await parked();
    expect(hex(s.readNextReg(0x10))).toBe("$04");
  });

  it("GPIO-007: the core ID changes only in config mode, and only to 0-14", async () => {
    const s = await parked();
    s.setNextReg(0x10, 0x03);
    expect(hex(s.readNextReg(0x10)), "outside config mode").toBe("$04");
    s.setNextReg(0x03, 0x07); // --- config mode
    expect(hex(s.setNextReg(0x10, 0x03).readNextReg(0x10)), "core 3").toBe("$0c");
    expect(hex(s.setNextReg(0x10, 0x1e).readNextReg(0x10)), "bit 4 set: ignored").toBe("$0c");
    expect(hex(s.setNextReg(0x10, 0x0f).readNextReg(0x10)), "15: ignored").toBe("$0c");
    expect(hex(s.setNextReg(0x10, 0x6e).readNextReg(0x10)), "bits 6-5 ignored: core 14").toBe("$38");
    s.setNextReg(0x03, 0x03);
    s.reset();
    expect(hex(s.readNextReg(0x10)), "soft reset keeps it").toBe("$38");
    s.hardReset();
    expect(hex(s.readNextReg(0x10)), "hard reset").toBe("$04");
  });
});
