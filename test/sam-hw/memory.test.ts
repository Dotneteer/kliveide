import { describe, expect, it } from "vitest";

import { createBareSam } from "./bare";
import { SAM_PHYS_UNMAPPED } from "@emu/machines/samcoupe/samMachineInfo";

/*
 * The memory map (plan §5; ASIC_VIDEO_MEMORY_TIMING.md §2): LMPR/HMPR over ROM0/ROM1/RAM, write
 * protection, the page wrap, the 256K model's missing pages and external memory over ROM1.
 */

const LMPR = 0x00fa;
const HMPR = 0x00fb;

describe("SAM memory map", () => {
  it("section A is ROM0 unless RAM0, then page LMPR; B is page LMPR + 1", async () => {
    const s = await createBareSam();
    s.pokePage(5, 0, 0x55).pokePage(6, 0, 0x66);
    s.out(LMPR, 0x05);
    expect(s.peek(0x0000)).toBe(0xf3); // the ROM's DI
    expect(s.peek(0x4000)).toBe(0x66);
    s.out(LMPR, 0x25);
    expect(s.peek(0x0000)).toBe(0x55);
  });

  it("section C is page HMPR, D page HMPR + 1, or ROM1 with LMPR bit 6", async () => {
    const s = await createBareSam();
    s.pokePage(9, 0, 0x99).pokePage(10, 0, 0xaa);
    s.out(HMPR, 0x09);
    s.out(LMPR, 0x20);
    expect(s.peek(0x8000)).toBe(0x99);
    expect(s.peek(0xc000)).toBe(0xaa);
    s.out(LMPR, 0x60);
    expect(s.machine.doReadMemory(0xc000)).toBe(s.memory[0x4000]);
  });

  it("page numbers wrap at 32: page 31 + 1 is page 0", async () => {
    const s = await createBareSam();
    s.pokePage(31, 0, 0x31).pokePage(0, 0, 0x00);
    s.out(HMPR, 0x1f);
    expect(s.peek(0x8000)).toBe(0x31);
    expect(s.peek(0xc000)).toBe(0x00);
  });

  it("LMPR bit 7 write-protects section A; ROM writes are dropped", async () => {
    const s = await createBareSam();
    // --- CPU writes: LD (HL),A through the core
    const write = (address: number, value: number) => {
      s.wasm.samSetCpuPc(0x8000);
      s.wasm.samSetCpuHl(address);
      s.wasm.samSetCpuAf(value << 8);
      s.step(1);
    };
    s.out(HMPR, 0x02);
    s.pokePage(2, 0, 0x77);
    s.out(LMPR, 0xa4);
    write(0x0100, 0x12);
    expect(s.page(4, 0x100)).not.toBe(0x12);
    s.out(LMPR, 0x24);
    write(0x0100, 0x12);
    expect(s.page(4, 0x100)).toBe(0x12);
    s.out(LMPR, 0x04);
    write(0x0100, 0x34);
    expect(s.memory[0x0100]).not.toBe(0x34);
  });

  it("the 256K model's pages 16-31 read FFh and drop writes", async () => {
    const s = await createBareSam({ model: "sam256", codePage: 2 });
    s.out(HMPR, 0x14);
    expect(s.peek(0x8000)).toBe(0xff);
    s.poke(0x8000, 0x12);
    expect(s.wasm.samGetSectionBase(2)).toBe(SAM_PHYS_UNMAPPED);
    expect(s.peek(0x8000)).toBe(0xff);
  });

  it("HMPR bit 7 maps the external pack's pages LEPR/HEPR into C/D, over ROM1", async () => {
    const s = await createBareSam({ extmem: true });
    s.out(0x0080, 0x03);
    s.out(0x0081, 0x07);
    s.out(LMPR, 0x60);
    s.out(HMPR, 0x80);
    s.poke(0x8000, 0x33).poke(0xc000, 0x77);
    expect(s.peek(0x8000)).toBe(0x33);
    expect(s.peek(0xc000)).toBe(0x77);
    s.out(0x0080, 0x07);
    expect(s.peek(0x8000)).toBe(0x77);
    // --- No pack fitted: external pages read FFh
    const bare = await createBareSam();
    bare.out(HMPR, 0x80);
    expect(bare.peek(0x8000)).toBe(0xff);
  });

  it("LMPR, HMPR and VMPR read back; VMPR's bit 7 is MIDI IN, idle high", async () => {
    const s = await createBareSam();
    s.out(LMPR, 0x2b).out(HMPR, 0x45).out(0x00fc, 0x3c);
    expect(s.in(LMPR)).toBe(0x2b);
    expect(s.in(HMPR)).toBe(0x45);
    expect(s.in(0x00fc)).toBe(0xbc);
  });
});
