import { describe, expect, it } from "vitest";

import { MemoryMap, MemorySection } from "@renderer/appIde/disassemblers/common-types";
import {
  EXOS_FUNCTIONS,
  EpCustomDisassembler
} from "@renderer/appIde/disassemblers/z80-disassembler/ep-disassembler";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";

/*
 * The Enterprise's custom disassembly (`.plans/ENTERPRISE_PLAN.md` §11): the byte after `RST 30h` is
 * the EXOS function's code, anywhere in memory.
 */

async function listing(memory: Uint8Array, start: number, end: number, decimal = false) {
  const map = new MemoryMap();
  map.add(new MemorySection(start, end));
  const disassembler = new Z80Disassembler(map.sections, memory, undefined, { getRomPage: () => -1, decimalMode: decimal });
  disassembler.setCustomDisassembler(new EpCustomDisassembler());
  const output = await disassembler.disassemble();
  return output!.outputItems.map((i) => [i.instruction?.toLowerCase(), i.hardComment]);
}

describe("Enterprise disassembler", () => {
  it("lists the byte after RST 30h as the EXOS function", async () => {
    const memory = new Uint8Array(0x10000);
    // --- rst $30 / .defb $01 / rst $30 / .defb $f7 (a code that looks like another RST) / nop
    memory.set([0xf7, 0x01, 0xf7, 0xf7, 0x00], 0x6000);
    expect(await listing(memory, 0x6000, 0x6004)).toEqual([
      ["rst $30", "(EXOS call)"],
      [".defb $01", "(EXOS 1: Open channel)"],
      ["rst $30", "(EXOS call)"],
      [".defb $f7", "(EXOS 247: not a function)"],
      ["nop", undefined]
    ]);
  });

  it("names the function code in decimal mode too", async () => {
    const memory = new Uint8Array(0x10000);
    memory.set([0xf7, 0x10, 0x00], 0x0100);
    expect(await listing(memory, 0x0100, 0x0102, true)).toEqual([
      ["rst 48", "(EXOS call)"],
      [".defb 16", "(EXOS 16: Read, write or toggle EXOS variable)"],
      ["nop", undefined]
    ]);
  });

  it("leaves the other restarts alone", async () => {
    const memory = new Uint8Array(0x10000);
    memory.set([0xcf, 0x00, 0xff, 0x00], 0x6000);
    expect((await listing(memory, 0x6000, 0x6003)).map(([i]) => i)).toEqual(["rst $08", "nop", "rst $38", "nop"]);
  });

  it("knows the specification's 31 functions: 0-11 and 16-34", () => {
    const codes = [...EXOS_FUNCTIONS.keys()].sort((a, b) => a - b);
    const expected = [
      ...Array.from({ length: 12 }, (_, i) => i),
      ...Array.from({ length: 19 }, (_, i) => i + 16)
    ];
    expect(codes).toEqual(expected);
    expect(new Set(EXOS_FUNCTIONS.values()).size).toBe(EXOS_FUNCTIONS.size);
  });
});
