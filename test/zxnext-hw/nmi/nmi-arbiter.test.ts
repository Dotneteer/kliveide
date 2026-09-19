import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";

/*
 * NMI arbitration and the $02 cause flags (catalogue NMI-008 - NMI-009). Ported from the
 * hardware-visible cases of the device-level `test/zxnext/NmiStateMachine.test.ts` ("MF wins over
 * DivMMC when both pending") and `test/zxnext/NmiSoftware.test.ts` ("writing bit 4 = 1 does NOT clear
 * mfNmiByIoTrap"); the rest of those files is covered by `nmi.test.ts`, `multiface/*.test.ts` and
 * `reset/reset-register.test.ts`.
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~2045-2047: a $02 write with bits 3 and 2 asserts both causes in the same clock (`nmi_gen_nr_mf`,
 *   `nmi_gen_nr_divmmc`, ~3812-3814), each gated by its $06 enable.
 * - ~2051-2071: while no NMI is active the arbiter latches *one* source, the Multiface first
 *   (`if nmi_assert_mf ... elsif nmi_assert_divmmc ...`). The causes are one-clock pulses: the loser is
 *   not remembered.
 * - ~3820-3842: the $02 flags are set whenever the cause arrives while `nmi_accept_cause` (~2120, IDLE /
 *   FETCH) - both flags, whoever wins - and cleared only by writing that bit as 0.
 * - ~3846-3865: the I/O trap cause ($02 bit 4, $DA) is cleared by a $02 write with bit 4 = 0 only.
 * - device/multiface.vhd: the Multiface NMI pages the Multiface in at the $0066 fetch; RETN pages it
 *   out and ends the hold.
 */

const MF_ROM = readFileSync("src/public/roms/enNextMf.rom");
const pagedIn = (s: NextTestSession) => Array.from(s.peekBytes(0x0000, 16)).join() === Array.from(MF_ROM.subarray(0, 16)).join();

async function program(core: CoreName, body: string): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(`
        .org $8000
        di
${body}
Loop:   jr Loop`);
  return s;
}

describe.each(ALL_CORES)("NMI arbitration - %s core", (core: CoreName) => {
  it("NMI-008: a Multiface and a DivMMC request in one $02 write: the Multiface wins, the DivMMC request is lost", async () => {
    // --- DivMMC automap off, so a DivMMC NMI would not page DivMMC in either: only the Multiface can
    const s = await program(core, "        nextreg $06,$18\n        nextreg $02,$0c");
    s.setNextReg(0x0a, s.readNextReg(0x0a) & ~0x10);
    s.runTo(0x0066, { maxFrames: 2 });
    expect(s.readNextReg(0x02) & 0x0c, "~3820-3842: both causes were accepted into $02").toBe(0x0c);
    s.step(1);
    expect(pagedIn(s), "~2063: the Multiface NMI was taken").toBe(true);
    // --- RETN back to Loop (the return address put on the stack by hand)
    const sp = s.registers().sp - 2;
    s.pokeWord(sp, s.symbol("Loop")).poke(0x8100, [0xed, 0x45]).setRegisters({ pc: 0x8100, sp }).step(1);
    expect(pagedIn(s), "RETN paged it out").toBe(false);
    s.runFrames(2);
    expect(s.registers().pc, "no DivMMC NMI follows").toBe(s.symbol("Loop"));
  });

  it("NMI-009: a $02 write with bit 4 = 1 keeps the I/O trap cause; bit 4 = 0 clears it", async () => {
    const s = await program(core, "        nextreg $06,$08\n        nextreg $d8,$01\n        ld bc,$2ffd\n        in a,(c)");
    s.runTo(0x0066, { maxFrames: 2 });
    expect([s.readNextReg(0x02) & 0x10, s.readNextReg(0xda)], "trapped").toEqual([0x10, 0x01]);
    s.setNextReg(0x02, 0x10);
    expect([s.readNextReg(0x02) & 0x10, s.readNextReg(0xda)], "~3859: bit 4 = 1 does not clear").toEqual([0x10, 0x01]);
    s.setNextReg(0x02, 0x00);
    expect([s.readNextReg(0x02) & 0x10, s.readNextReg(0xda)], "bit 4 = 0 clears").toEqual([0x00, 0x00]);
  });
});
