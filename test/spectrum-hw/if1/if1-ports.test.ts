import { describe, expect, it } from "vitest";

import { formattedMdr, SELECT, sp48WithInterface1, standInRom } from "./if1TestSupport";

/*
 * The Interface 1's ports and its drive-select chain (`.plans/MICRODRIVE_PLAN.md` §3 M3, M7, M8;
 * `_input/microdrive/interface1-hardware.md` §2, §5), driven from RAM with interrupts off.
 */

async function session() {
  // --- The stand-in ROM: nothing here pages it in, and its ports are the interface's own
  return sp48WithInterface1(standInRom());
}

describe("Interface 1 ports", () => {
  it("A4 and A3 decode them: $EF and $0F are both the control port", async () => {
    const s = await session();
    await s.loadCode(`
        .org $8000
      Main:
        di
        ld a,$e1
        out ($ef),a
        ld a,(Probe)
        ld bc,$000f
        out (c),a
        ret
      Probe: .defb $c3
    `);
    s.call("Main");
    expect(s.interface1().control).toBe(0xc3);
  }, 60_000);

  it("A4 = A3 = 1 is not the interface's: the Kempston port $1F and $FF reach nothing", async () => {
    const s = await session();
    await s.loadCode(`
        .org $8000
      Main:
        di
        ld a,$ee
        out ($ef),a
        ld a,$00
        out ($1f),a
        out ($ff),a
        ret
    `);
    s.call("Main");
    expect(s.interface1().control).toBe(0xee);
  }, 60_000);

  it("status with no drive selected: write-protected, no sync, gap; DTR, BUSY and b5-b7 high", async () => {
    const s = await session();
    await s.loadCode(`
        .org $8000
      Main:
        di
        in a,($ef)
        ld ($9000),a
        ret
    `);
    s.call("Main");
    expect(s.peek(0x9000)).toBe(0xfe);
  }, 60_000);

  it("write-protect reads 1 only for a selected drive holding a writable cartridge", async () => {
    const s = await session();
    s.insertCartridge(0, formattedMdr(), false).insertCartridge(1, formattedMdr(), true);
    await s.loadCode(`
        .org $8000
      Main:
        di
        ld a,1
        call Select
        in a,($ef)
        ld ($9000),a
        ld a,2
        call Select
        in a,($ef)
        ld ($9001),a
        ld a,3
        call Select
        in a,($ef)
        ld ($9002),a
        xor a
        call Select
        ret
      ${SELECT}
    `);
    s.call("Main");
    expect(s.peek(0x9000) & 0x01).toBe(1);
    expect(s.peek(0x9001) & 0x01).toBe(0);
    expect(s.peek(0x9002) & 0x01).toBe(0);
  }, 60_000);

  it("the stubbed network reads the inverse of what the station sends; RS232 never starts a byte", async () => {
    const s = await session();
    await s.loadCode(`
        .org $8000
      Main:
        di
        ld a,$ee
        out ($ef),a
        ld a,1
        out ($f7),a
        in a,($f7)
        ld ($9000),a
        xor a
        out ($f7),a
        in a,($f7)
        ld ($9001),a
        ld a,$ef
        out ($ef),a
        in a,($f7)
        ld ($9002),a
        ret
    `);
    s.call("Main");
    expect(s.peek(0x9000) & 0x01).toBe(0);
    expect(s.peek(0x9001) & 0x01).toBe(1);
    // --- RS232 routed: TXD (b7) stays low - no start bit ever arrives
    expect(s.peek(0x9002) & 0x80).toBe(0);
  }, 60_000);
});

describe("Interface 1 drive select", () => {
  it.each([1, 2, 5, 8])("eight clocks select drive %i alone; its motor runs", async (drive) => {
    const s = await session();
    await s.loadCode(`
        .org $8000
      Main:
        di
        ld a,${drive}
        call Select
        ret
      ${SELECT}
    `);
    s.call("Main");
    const state = s.interface1();
    expect(state.select).toBe(1 << (drive - 1));
    expect(state.drives.map((d) => d.motorOn)).toEqual(Array.from({ length: 8 }, (_, d) => d === drive - 1));
  }, 60_000);

  it("eight deselect clocks stop every motor", async () => {
    const s = await session();
    await s.loadCode(`
        .org $8000
      Main:
        di
        ld a,3
        call Select
        xor a
        call Select
        ret
      ${SELECT}
    `);
    s.call("Main");
    expect(s.interface1().select).toBe(0);
    expect(s.interface1().drives.some((d) => d.motorOn)).toBe(false);
  }, 60_000);

  it("the chain shifts on COMMS CLK's falling edge only", async () => {
    const s = await session();
    await s.loadCode(`
        .org $8000
      Main:
        di
        ld a,$ee
        out ($ef),a
        ld a,$ec
        out ($ef),a
        in a,($ef)
        ld a,$ee
        out ($ef),a
        ret
      Second:
        ld a,$ec
        out ($ef),a
        ret
    `);
    s.call("Main");
    // --- Falling with DATA 0 shifted a select bit in; the rising edge after it moved nothing
    expect(s.interface1().select).toBe(0x01);
    s.call("Second");
    expect(s.interface1().select).toBe(0x03);
  }, 60_000);
});
