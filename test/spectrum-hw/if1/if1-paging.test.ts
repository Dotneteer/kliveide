import { describe, expect, it } from "vitest";

import { createSp128Session } from "../../harness/sp128";
import {
  sp48WithInterface1,
  standInRom,
  STAND_IN_MARK_0008,
  STAND_IN_MARK_1708,
  STAND_IN_READ_0700,
  STAND_IN_READ_2700
} from "./if1TestSupport";

/*
 * The Interface 1's ROM paging (`.plans/MICRODRIVE_PLAN.md` §3 M2, §4.1;
 * `_input/microdrive/interface1-hardware.md` §3): in on an M1 fetch from $0008 or $1708 - whatever
 * reached it - out after the M1 fetch from $0700. A stand-in ROM shows which ROM ran.
 */

describe("Interface 1 paging (48K)", () => {
  it("RST 8 pages the ROM in; its RET at $0700 pages it out after the fetch", async () => {
    const s = await sp48WithInterface1(standInRom());
    await s.loadCode(`
        .org $8000
      Main:
        rst $08
        ret
    `);
    s.call("Main");
    expect(s.peek(STAND_IN_MARK_0008)).toBe(0xa5);
    // --- While paged, $0700 and its mirror $2700 read the IF1 ROM's RET, not the 48K ROM's LD (HL),C
    expect(s.peek(STAND_IN_READ_0700)).toBe(0xc9);
    expect(s.peek(STAND_IN_READ_2700)).toBe(0xc9);
    expect(s.interface1().paged).toBe(false);
    expect(s.peek(0x0700)).toBe(0x71);
  }, 60_000);

  it("a fetch from $0008 reached by RET pages it in (the ROM's CALBAS round trip needs it)", async () => {
    const s = await sp48WithInterface1(standInRom());
    await s.loadCode(`
        .org $8000
      Main:
        ld hl,$0008
        push hl
        ret
    `);
    s.call("Main");
    expect(s.peek(STAND_IN_MARK_0008)).toBe(0xa5);
  }, 60_000);

  it("a fetch from $1708 pages it in", async () => {
    const s = await sp48WithInterface1(standInRom());
    await s.loadCode(`
        .org $8000
      Main:
        call $1708
        ret
    `);
    s.call("Main");
    expect(s.peek(STAND_IN_MARK_1708)).toBe(0x5a);
    expect(s.peek(STAND_IN_MARK_0008)).not.toBe(0xa5);
    expect(s.interface1().paged).toBe(false);
  }, 60_000);

  it("a data read of $0008 or $1708 pages nothing", async () => {
    const s = await sp48WithInterface1(standInRom());
    await s.loadCode(`
        .org $8000
      Main:
        ld a,($0008)
        ld ($9010),a
        ld a,($1708)
        ld ($9011),a
        ret
    `);
    s.call("Main");
    expect(s.peek(0x9010)).toBe(0x2a);
    expect(s.peek(0x9011)).toBe(0x23);
    expect(s.peek(STAND_IN_MARK_0008)).not.toBe(0xa5);
    expect(s.interface1().paged).toBe(false);
  }, 60_000);

  it("a reset pages it out", async () => {
    // --- A stand-in whose $0008 is JR $: the CPU stays in the paged ROM
    const rom = standInRom();
    rom.set([0x18, 0xfe], 0x0008);
    const s = await sp48WithInterface1(rom);
    s.machine.pc = 0x0008;
    s.step(3);
    expect(s.machine.pc).toBe(0x0008);
    expect(s.interface1().paged).toBe(true);
    expect(s.peek(0x0008)).toBe(0x18);
    s.reset();
    expect(s.interface1().paged).toBe(false);
    expect(s.peek(0x0008)).toBe(0x2a);
  }, 60_000);

  it("disconnected, a fetch from $0008 runs the 48K ROM", async () => {
    const s = await sp48WithInterface1(standInRom());
    s.interface1Bridge.setPresent(false);
    s.machine.pc = 0x0008;
    s.step(1);
    // --- LD HL,(CH_ADD) is three bytes: the 48K ROM ran, not the stand-in's LD A,$A5
    expect(s.machine.pc).toBe(0x000b);
    expect(s.interface1().paged).toBe(false);
  }, 60_000);
});

describe("Interface 1 paging (128K)", () => {
  it.each([0, 1])("pages in with ROM %i selected: the address alone decides", async (rom) => {
    const s = await createSp128Session("sp128");
    s.runFrames(120);
    s.connectInterface1(standInRom());
    const program = await s.loadCode(`
        .org $8000
      Main:
        di
        ld bc,$7ffd
        ld a,${rom === 0 ? "$00" : "$10"}
        out (c),a
        rst $08
      Done:
        jr Done
    `);
    s.machine.pc = program.entry;
    s.runTo(program.symbol("Done"), { maxFrames: 5 });
    expect(s.peek(STAND_IN_MARK_0008)).toBe(0xa5);
    expect(s.interface1().paged).toBe(false);
    expect(s.paging().rom).toBe(rom);
  }, 60_000);
});
