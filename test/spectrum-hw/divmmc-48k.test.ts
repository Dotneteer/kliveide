import { describe, expect, it } from "vitest";

import { createSp48Session, type Sp48TestSession } from "../harness/sp48";
import { DIVMMC_ROM_SIZE } from "@emu/machines/zxSpectrum/divmmc/divMmcCoreBridge";
import { buildDivMmcTestRom, COUNTER } from "../sp128-hw/divmmc/divmmc-test-rom";

/*
 * The DivMMC on the 48K (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C4). The 48K's flat memory
 * holds the ROM at $0000, so while the interface is mapped its view replaces those bytes and the
 * core keeps the ROM aside: these tests check that the ROM comes back every time it unmaps.
 */

type Exports = Record<string, (...args: number[]) => number>;

const CODE = 0x8000;

async function withDivMmc(): Promise<{ s: Sp48TestSession; x: Exports }> {
  const s = await createSp48Session();
  const x = s.machine.wasmV2Runtime!.exports as unknown as Exports;
  s.machine.divMmc.uploadRom(await buildDivMmcTestRom());
  x.sp48DivMmcSetPresent(1);
  x.sp48Reset();
  s.machine.pc = 0;
  return { s, x };
}

const counter = (s: Sp48TestSession, at: number) => s.machine.divMmc.memory![at - 0x2000 + DIVMMC_ROM_SIZE];

function run(s: Sp48TestSession, x: Exports, body: number[]) {
  const code = [0xf3, 0x31, 0x00, 0x90, ...body, 0x18, 0xfe];
  s.poke(CODE, code);
  x.sp48SetCpuHalted(0);
  s.machine.pc = CODE;
  s.runTo(CODE + code.length - 2, { maxFrames: 20 });
}

describe("DivMMC on the 48K", () => {
  it("boots through RST $00, handles RST $08, and gives the ROM back each time", async () => {
    const { s, x } = await withDivMmc();
    s.bootToBasic();
    expect(counter(s, COUNTER.reset)).toBe(1);
    // --- Every IM 1 interrupt went through the interface (RST $38 traps with the 48K ROM in)
    expect(counter(s, COUNTER.rst38)).toBeGreaterThan(0);
    expect(s.peek(0x0000)).toBe(0xf3);
    run(s, x, [0xcf, 0x00, 0xcf, 0x00]); // RST $08 twice
    expect(counter(s, COUNTER.rst8)).toBe(2);
    expect(x.sp48DivMmcGetMapped()).toBe(0);
    // --- The 48K ROM is back at $0000-$3FFF, byte for byte
    expect(s.peek(0x0000)).toBe(0xf3);
    expect(s.peek(0x0008)).toBe(0x2a);
    expect(s.peek(0x1ff8)).not.toBe(0xc9);
  }, 120_000);

  it("conmem pages it in for the CPU and the IDE alike; writes reach its RAM, not the ROM", async () => {
    const { s, x } = await withDivMmc();
    s.bootToBasic();
    run(s, x, [
      0x3e, 0x80, 0xd3, 0xe3, //       LD A,$80 / OUT ($E3),A
      0x3e, 0x42, 0x32, 0x10, 0x20, // LD A,$42 / LD ($2010),A
      0x3e, 0x99, 0x32, 0x10, 0x00 //  LD A,$99 / LD ($0010),A  (its ROM: ignored)
    ]);
    expect(x.sp48DivMmcGetMapped()).toBe(1);
    expect(s.peek(0x0000)).toBe(0xa5);
    expect(s.peek(0x2010)).toBe(0x42);
    expect(s.machine.divMmc.memory![DIVMMC_ROM_SIZE + 0x10]).toBe(0x42);
    expect(s.machine.divMmc.memory![0x10]).not.toBe(0x99);
    run(s, x, [0xaf, 0xd3, 0xe3]); // XOR A / OUT ($E3),A
    expect(s.peek(0x0000)).toBe(0xf3);
    expect(s.peek(0x2010)).not.toBe(0x42);
  }, 120_000);
});
