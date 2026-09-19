import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";

/*
 * Multiface NMI state, page-in rules and memory priority (catalogue MF-008 - MF-012). Ported from the
 * hardware-visible cases of the device-level `test/zxnext/MultifaceDevice.test.ts` (writeEnablePort /
 * writeDisablePort clear nmiActive, readEnablePort without nmiActive, onFetch0066 without nmiActive,
 * "D5: enable gating") and `test/zxnext/MultifaceMemory.test.ts` (write priority over DivMMC); the rest
 * of those files is covered by `multiface.test.ts`.
 *
 * Hardware (`_input/next-fpga/src`):
 * - device/multiface.vhd
 *   - `nmi_active` (= `nmi_disable_o`, zxnext.vhd's `mf_nmi_hold`): set by the button, cleared by RETN
 *     and by *any* write to the enable or disable port, in every mode (MF+3 also by a disable-port
 *     read). While it is set the NMI state machine stays in S_NMI_HOLD (zxnext.vhd ~2074, ~2095-2100),
 *     where `nmi_accept_cause` is 0 (~2120) and no new NMI starts.
 *   - `fetch_66 <= cpu_a_0066 and not m1_n and nmi_active`: the fetch at $0066 pages in only during a
 *     Multiface NMI.
 *   - `mf_enable`: an enable-port read sets it to `not invisible_eff` whatever `nmi_active` is; the
 *     button clears `invisible`, and RETN does not set it again. `mf_port_en` (the port answering)
 *     needs `invisible_eff = 0` and MF128/MF+3 only.
 *   - `reset <= reset_i or not enable_i`: with port enable bit 9 ($83 bit 1, zxnext.vhd ~2371) off the
 *     Multiface is held in reset and ignores the button.
 * - zxnext.vhd ~2046: `nmi_assert_mf` is the M1 button / $02 bit 3 and $06 bit 3 - it does not look at
 *   the Multiface's port enable: the CPU still takes the NMI, to the normal ROM.
 * - zxnext.vhd ~2980-2990: while the Multiface is paged in, $2000-$3FFF is its RAM for reads *and*
 *   writes, above DivMMC's conmem mapping.
 * - zxnext.vhd ~4287-4299: MF+3 enable-port reads by A15-A12, $7xxx = $7FFD, $Exxx $EFF7 bits 3-2.
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

/** Executes `code` at $8100 followed by `nextreg $02,$08` and NOPs; reports whether the CPU reached $0066 again. */
function secondNmi(s: NextTestSession, code: number[]): boolean {
  s.poke(0x8100, [...code, 0xed, 0x91, 0x02, 0x08, 0x00, 0x00, 0x00, 0x00, 0x18, 0xfe]);
  s.setRegisters({ pc: 0x8100 });
  for (let i = 0; i < 8; i++) {
    s.step(1);
    if (s.registers().pc === 0x0066) return true;
  }
  return false;
}

/** RETN from the handler to `Loop` (the return address is put on the stack by hand). */
function retn(s: NextTestSession): NextTestSession {
  const sp = s.registers().sp - 2;
  s.pokeWord(sp, s.symbol("Loop")).poke(0x8100, [0xed, 0x45]);
  return s.setRegisters({ pc: 0x8100, sp }).step(1);
}

// ---------------------------------------------------------------------------------------------------

describe.each(ALL_CORES)("Multiface NMI state - %s core", (core: CoreName) => {
  // --- MF-008: port writes end the NMI --------------------------------------------------------------

  for (const type of [0, 1, 3]) {
    const [en, dis] = PORTS[type];
    it(`MF-008: ${TYPE_NAME[type]}: while the NMI is held no new NMI starts; a write to either port ends it`, async () => {
      for (const [what, code, expected] of [
        ["no port access", [0x00, 0x00], false],
        [`out ($${en.toString(16)}),a`, [0xd3, en], true],
        [`out ($${dis.toString(16)}),a`, [0xd3, dis], true]
      ] as const) {
        const s = await mf(core, type);
        takeNmi(s);
        expect(secondNmi(s, [...code]), what).toBe(expected);
      }
    });
  }

  // --- MF-009: after RETN ----------------------------------------------------------------------------

  it("MF-009: after RETN a new Multiface NMI is accepted", async () => {
    const s = await mf(core, 0);
    takeNmi(s);
    retn(s);
    expect([pagedIn(s), s.registers().pc], "paged out, back in the program").toEqual([false, s.symbol("Loop")]);
    // --- let the state machine leave HOLD / END on CPU clocks (~2076-2116), as a program would
    s.step(2).setNextReg(0x02, 0x00).setNextReg(0x02, 0x08);
    let taken = false;
    for (let i = 0; i < 4 && !taken; i++) taken = s.step(1).registers().pc === 0x0066;
    expect(taken).toBe(true);
  });

  it("MF-009: MF+3 after RETN: still visible - the enable port pages in and answers ($7FFD by A15-A12)", async () => {
    const s = await mf(core, 0, `        ld bc,$7ffd\n        ld a,$10\n        out (c),a`);
    takeNmi(s);
    retn(s);
    expect(pagedIn(s), "RETN paged out").toBe(false);
    expect(s.in(0x7f3f), "mf_port_en: visible").toBe(0x10);
    expect(pagedIn(s), "mf_enable <= not invisible_eff").toBe(true);
    s.in(0xbf);
    expect(pagedIn(s), "disable port").toBe(false);
  });

  it("MF-009: MF128 after RETN: still visible - the enable port pages in and answers", async () => {
    const s = await mf(core, 1, `        ld bc,$7ffd\n        ld a,$18\n        out (c),a`);
    takeNmi(s);
    retn(s);
    expect(pagedIn(s), "RETN paged out").toBe(false);
    expect(s.in(0x00bf), "$7FFD bit 3 & 1111111").toBe(0xff);
    expect(pagedIn(s)).toBe(true);
  });

  it("MF-009: an MF+3 enable-port read at $Exxx returns $EFF7 bits 3-2 in place", async () => {
    // --- ~4295: "0000" & port_eff7_reg_3 & port_eff7_reg_2 & "00"
    const s = await mf(core, 0, `        ld bc,$eff7\n        ld a,$0c\n        out (c),a`);
    takeNmi(s);
    expect(s.in(0xef3f)).toBe(0x0c);
  });

  // --- MF-010: $0066 without an NMI ------------------------------------------------------------------

  it("MF-010: executing $0066 without a Multiface NMI does not page it in", async () => {
    const s = await mf(core, 0);
    s.poke(0x8100, [0xc3, 0x66, 0x00]).setRegisters({ pc: 0x8100 }).step(1);
    expect(s.registers().pc).toBe(0x0066);
    s.step(1);
    expect(pagedIn(s), "fetch_66 needs nmi_active").toBe(false);
  });

  // --- MF-011: write priority over DivMMC ------------------------------------------------------------

  it("MF-011: paged in above DivMMC conmem, writes to $2000-$3FFF go to the Multiface RAM, not DivMMC's", async () => {
    const s = await mf(core, 3);
    s.out(0xe3, 0x80); // --- conmem: DivMMC ROM at $0000, DivMMC RAM bank 0 at $2000
    s.poke(0x2000, 0x11);
    expect(s.peek(0x2000), "DivMMC RAM").toBe(0x11);
    s.in(0x9f); // --- MF48: pages in without an NMI
    expect(pagedIn(s)).toBe(true);
    s.poke(0x2000, 0x22);
    expect(s.peek(0x2000), "Multiface RAM").toBe(0x22);
    s.in(0x1f);
    expect(s.peek(0x2000), "DivMMC RAM untouched").toBe(0x11);
    s.in(0x9f);
    expect(s.peek(0x2000), "Multiface RAM kept it").toBe(0x22);
  });

  // --- MF-012: port enable off -----------------------------------------------------------------------

  it("MF-012: with $83 bit 1 off the Multiface NMI still reaches $0066, but the Multiface stays out", async () => {
    const s = await mf(core, 0);
    s.setNextReg(0x83, s.readNextReg(0x83) & ~0x02);
    const rom = Array.from(s.peekBytes(0x0000, 16));
    s.runTo(0x0066, { maxFrames: 2 });
    expect(s.registers().pc, "nmi_assert_mf ignores the Multiface enable").toBe(0x0066);
    s.step(1);
    expect(Array.from(s.peekBytes(0x0000, 16)), "held in reset: the normal ROM stays").toEqual(rom);
  });
});
