import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";

/*
 * Multiface (catalogue MF-001 - MF-007; MF-002 is RST-005 in `reset/reset-register`).
 *
 * Hardware (`_input/next-fpga/src`):
 * - device/multiface.vhd (mode: $0A bits 7-6 - 00 MF+3, 11 MF48, else MF128):
 *   - `mf_enable` (memory paged in): set by the fetch at $0066 while `nmi_active`, cleared by a
 *     disable-port read or RETN, and an enable-port read sets it to `not invisible_eff`.
 *   - `nmi_active`: set by the NMI button (the NMI state machine taking a Multiface NMI), cleared by RETN,
 *     by any write to the enable or disable port, and - MF+3 only - by a disable-port read.
 *   - `invisible`: 1 after reset, 0 after the button; set again by a disable-port write (MF128/MF48) or
 *     an enable-port write (MF+3). MF48 is never invisible (`invisible_eff = invisible and not mode_48`).
 *   - `mf_port_en`: an enable-port read drives the bus only when visible and MF128 / MF+3.
 *   - `reset <= reset_i or not enable_i`: port enable bit 9 ($83 bit 1) off holds it in reset.
 * - zxnext.vhd:
 *   - ~2568-2572: enable / disable ports, low byte only: type(1) = 1 -> $9F / $1F, type = 01 -> $BF / $3F,
 *     type = 00 -> $3F / $BF.
 *   - ~4287-4299: the port data. MF+3 by A15-A12: $1xxx $1FFD, $7xxx $7FFD, $Dxxx '0' & dffd(6) & '0' &
 *     dffd(4-0), $Exxx eff7 bits 3-2, anything else the border (port $FE bits 2-0). MF128:
 *     $7FFD bit 3 & "1111111".
 *   - ~2980-2990: while paged in, $0000-$1FFF is the Multiface ROM (read-only) and $2000-$3FFF its RAM,
 *     with no DivMMC, Layer 2 or ROMCS override.
 *   - ~2060-2068: a Multiface NMI is taken only while DivMMC's conmem ($E3 bit 7) and NMI hold are off;
 *     a DivMMC NMI only while the Multiface is inactive (`mf_is_active = mf_mem_en or mf_nmi_hold`).
 *   - `z80_retn_seen` is ED 45 only (im2_control S_ED45_T4).
 */

const MF_ROM = readFileSync("src/public/roms/enNextMf.rom");

/** [enable port, disable port] per $0A type. */
const PORTS: Record<number, [number, number]> = { 0: [0x3f, 0xbf], 1: [0xbf, 0x3f], 2: [0x9f, 0x1f], 3: [0x9f, 0x1f] };
const TYPE_NAME = ["MF+3", "MF128 v87.2", "MF128 v87.12", "MF48"];

/** $0A bits 7-6 change only in config mode: enter it, write, leave it with the same machine type. */
function setType(s: NextTestSession, type: number): NextTestSession {
  const machine = s.readNextReg(0x03) & 0x07;
  s.setNextReg(0x03, 0x07).setNextReg(0x0a, (s.readNextReg(0x0a) & 0x3f) | (type << 6)).setNextReg(0x03, machine);
  return s;
}

/** A parked session with the Multiface type set; `body` runs first, then a Multiface NMI is requested. */
async function mf(core: CoreName, type: number, body = ""): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(" .org $8000\n di\nLoop: jr Loop");
  setType(s, type);
  await s.loadCode(
    `
        .org $8000
Start:  di
${body}
        nextreg $06,$08          ; M1 button NMI enable
Nmi:    nextreg $02,$08          ; Multiface NMI
Loop:   jr Loop`,
    { entry: "Start" }
  );
  return s;
}

/** Runs to $0066 and executes the first Multiface instruction: paged in, NMI active. */
const takeNmi = (s: NextTestSession) => s.runTo(0x0066, { maxFrames: 2 }).step(1);

/** The Multiface ROM is at $0000. */
const pagedIn = (s: NextTestSession) => Array.from(s.peekBytes(0x0000, 16)).join() === Array.from(MF_ROM.subarray(0, 16)).join();

// ---------------------------------------------------------------------------------------------------

describe.each(ALL_CORES)("Multiface - %s core", (core: CoreName) => {
  // --- MF-001 / MF-003: ports by type ------------------------------------------------------------------

  for (const type of [0, 1, 2, 3]) {
    const [en, dis] = PORTS[type];
    it(`MF-001 / MF-003: ${TYPE_NAME[type]} ($0A = ${type}): $${dis.toString(16).toUpperCase()} pages out, $${en.toString(16).toUpperCase()} pages in, other ports do nothing`, async () => {
      const s = await mf(core, type);
      takeNmi(s);
      expect(pagedIn(s), "after the NMI").toBe(true);
      for (const p of [0x1f, 0x3f, 0x9f, 0xbf].filter((p) => p !== en && p !== dis)) s.in(p);
      expect(pagedIn(s), "foreign ports").toBe(true);
      s.in(dis);
      expect(pagedIn(s), "disable port").toBe(false);
      s.in(en);
      expect(pagedIn(s), "enable port").toBe(true);
    });
  }

  it("MF-003: the Multiface RAM at $2000 is writable, its ROM at $0000 is not", async () => {
    const s = await mf(core, 0);
    takeNmi(s);
    s.poke(0x2000, [0x5a, 0xa5]).poke(0x0000, 0x00);
    expect([s.peek(0x2000), s.peek(0x2001), s.peek(0x0000)]).toEqual([0x5a, 0xa5, MF_ROM[0]]);
  });

  it("MF-003: RETI (ED 4D) does not page the Multiface out; RETN (ED 45) does", async () => {
    const s = await mf(core, 0);
    takeNmi(s);
    const sp = s.registers().sp;
    s.pokeWord(sp - 2, 0x8000);
    s.setRegisters({ pc: 0x8000, sp: sp - 2 }).poke(0x8000, [0xed, 0x4d]).step(1);
    expect(pagedIn(s), "RETI").toBe(true);
    s.setRegisters({ pc: 0x8000, sp: sp - 2 }).poke(0x8000, [0xed, 0x45]).step(1);
    expect(pagedIn(s), "RETN").toBe(false);
  });

  /**
   * From inside the handler, runs `in a,(disable)` / `nextreg $02,$08` / NOPs in RAM (time for the NMI
   * state machine, as a real program has) and reports whether the CPU went to $0066 again.
   */
  function secondNmi(s: NextTestSession, disable: number): boolean {
    s.poke(0x8100, [0xdb, disable, 0xed, 0x91, 0x02, 0x08, 0x00, 0x00, 0x00, 0x00, 0x18, 0xfe]);
    s.setRegisters({ pc: 0x8100 });
    for (let i = 0; i < 8; i++) {
      s.step(1);
      if (s.registers().pc === 0x0066) return true;
    }
    return false;
  }

  it("MF-003: on MF+3 a disable-port read also ends the NMI: a new Multiface NMI is taken", async () => {
    const s = await mf(core, 0);
    takeNmi(s);
    expect(secondNmi(s, 0xbf)).toBe(true);
  });

  it("MF-003: on MF128 a disable-port read does not end the NMI: no second Multiface NMI", async () => {
    const s = await mf(core, 1);
    takeNmi(s);
    expect(secondNmi(s, 0x3f)).toBe(false);
  });

  // --- MF-004: register read-back ---------------------------------------------------------------------

  it("MF-004: MF+3 enable-port reads return $1FFD, $7FFD, $DFFD, $EFF7 or the border by A15-A12", async () => {
    const s = await mf(
      core,
      0,
      `
        ld bc,$7ffd
        ld a,$13
        out (c),a
        ld bc,$1ffd
        ld a,$04
        out (c),a
        ld bc,$dffd
        ld a,$e5                 ; bits 7 and 5 are not stored
        out (c),a
        ld a,$05
        out ($fe),a`
    );
    takeNmi(s);
    expect([0x7f3f, 0x1f3f, 0xdf3f, 0xef3f, 0x003f, 0x503f].map((p) => s.in(p))).toEqual([0x13, 0x04, 0x45, 0x00, 0x05, 0x05]);
    expect(pagedIn(s), "the reads page it in").toBe(true);
  });

  for (const shadow of [false, true]) {
    it(`MF-004: an MF128 enable-port read returns $7FFD bit 3 (${shadow ? 1 : 0}) and seven 1s`, async () => {
      const s = await mf(core, 1, `        ld bc,$7ffd\n        ld a,$${shadow ? "18" : "10"}\n        out (c),a`);
      takeNmi(s);
      expect(s.in(0x00bf)).toBe(shadow ? 0xff : 0x7f);
    });
  }

  it("MF-004: an MF48 enable-port read pages in but does not drive the bus", async () => {
    const s = await mf(core, 3, `        ld bc,$7ffd\n        ld a,$10\n        out (c),a`);
    takeNmi(s);
    s.in(0x1f);
    expect(pagedIn(s)).toBe(false);
    expect(s.in(0x009f)).toBe(0xff);
    expect(pagedIn(s)).toBe(true);
  });

  // --- MF-005: invisibility ---------------------------------------------------------------------------

  for (const type of [0, 1, 2]) {
    it(`MF-005: ${TYPE_NAME[type]} is invisible after reset: the enable port neither pages in nor answers`, async () => {
      const s = await mf(core, type);
      expect(s.in(PORTS[type][0])).toBe(0xff);
      expect(pagedIn(s)).toBe(false);
    });
  }

  it("MF-005: MF48 is never invisible: its enable port pages in without an NMI", async () => {
    const s = await mf(core, 3);
    s.in(0x9f);
    expect(pagedIn(s)).toBe(true);
    s.in(0x1f);
    expect(pagedIn(s)).toBe(false);
  });

  it("MF-005: MF+3 becomes invisible by an enable-port write, MF128 by a disable-port write", async () => {
    for (const [type, write] of [
      [0, 0x3f],
      [1, 0x3f]
    ]) {
      const [en, dis] = PORTS[type];
      const s = await mf(core, type);
      takeNmi(s);
      s.out(write, 0x00).in(dis);
      expect(pagedIn(s), `${TYPE_NAME[type]}: paged out`).toBe(false);
      expect(s.in(en), `${TYPE_NAME[type]}: no answer`).toBe(0xff);
      expect(pagedIn(s), `${TYPE_NAME[type]}: no page-in`).toBe(false);
    }
  });

  // --- MF-006: port enable ------------------------------------------------------------------------------

  it("MF-006: port enable bit 9 ($83 bit 1) off holds the Multiface in reset: paged out, invisible again", async () => {
    const s = await mf(core, 0);
    takeNmi(s);
    const e83 = s.readNextReg(0x83);
    s.setNextReg(0x83, e83 & ~0x02);
    expect(pagedIn(s), "disabled").toBe(false);
    s.in(0x3f);
    expect(pagedIn(s), "ports off").toBe(false);
    s.setNextReg(0x83, e83);
    expect(pagedIn(s), "enabled again: reset state").toBe(false);
    expect(s.in(0x3f), "invisible").toBe(0xff);
    expect(pagedIn(s)).toBe(false);
  });

  // --- MF-007: with DivMMC -----------------------------------------------------------------------------

  it("MF-007: the Multiface pages in above DivMMC", async () => {
    const s = await mf(core, 3);
    const spectrum = Array.from(s.peekBytes(0x0000, 16));
    s.out(0xe3, 0x80);
    const divRom = Array.from(s.peekBytes(0x0000, 16));
    expect(divRom).not.toEqual(spectrum);
    s.in(0x9f);
    expect(pagedIn(s), "MF over conmem").toBe(true);
    s.in(0x1f);
    expect(Array.from(s.peekBytes(0x0000, 16)), "DivMMC again").toEqual(divRom);
  });

  it("MF-007: no Multiface NMI while DivMMC conmem is set", async () => {
    const s = await mf(core, 0, `        ld a,$80\n        out ($e3),a`);
    s.runTo("Loop").runFrames(1);
    expect(s.registers().pc, "no NMI").toBeGreaterThanOrEqual(0x8000);
  });

  it("MF-007: no DivMMC NMI while the Multiface is paged in", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\nLoop: jr Loop");
    setType(s, 3);
    s.setNextReg(0x06, 0x10).in(0x9f); // --- DRIVE button NMI enable; MF48 paged in
    expect(pagedIn(s)).toBe(true);
    s.setNextReg(0x02, 0x04).step(2);
    expect(s.registers().pc, "refused").toBeGreaterThanOrEqual(0x8000);
    s.in(0x1f);
    s.setNextReg(0x02, 0x00).setNextReg(0x02, 0x04);
    let taken = false;
    for (let i = 0; i < 4 && !taken; i++) taken = s.step(1).registers().pc === 0x0066;
    expect(taken, "taken once the Multiface is out").toBe(true);
  });
});
