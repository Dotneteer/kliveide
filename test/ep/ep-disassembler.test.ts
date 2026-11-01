import { describe, expect, it } from "vitest";

import { MemoryMap, MemorySection } from "@renderer/appIde/disassemblers/common-types";
import {
  BASIC_CALL_OPERANDS,
  EXOS_FUNCTIONS,
  EpBasicCustomDisassembler,
  EpCustomDisassembler
} from "@renderer/appIde/disassemblers/z80-disassembler/ep-disassembler";
import { ChainedCustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/rom-gated-disassembler";
import { machineRegistry } from "@common/machines/machine-registry";
import { CT_CUSTOM_DISASSEMBLER, MI_ENTERPRISE } from "@common/machines/constants";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import type { ICustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/custom-disassembly";

/*
 * The Enterprise's custom disassembly (`.plans/ENTERPRISE_PLAN.md` §11): the byte after `RST 30h` is
 * the EXOS function's code, anywhere in memory.
 */

async function listing(
  memory: Uint8Array,
  start: number,
  end: number,
  decimal = false,
  custom: ICustomDisassembler = new EpCustomDisassembler()
) {
  const map = new MemoryMap();
  map.add(new MemorySection(start, end));
  const disassembler = new Z80Disassembler(map.sections, memory, undefined, { getRomPage: () => -1, decimalMode: decimal });
  disassembler.setCustomDisassembler(custom);
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

describe("IS-BASIC's call lists", () => {
  const basic = () => new ChainedCustomDisassembler([new EpCustomDisassembler(), new EpBasicCustomDisassembler()]);

  it("lists the bytes after RST 10h up to the $00 that ends them", async () => {
    const memory = new Uint8Array(0x10000);
    // --- rst $10 / $8c $20 $00 / ret: EXOS segment 1's entry 12, the BASIC ROM's entry 32, the end
    memory.set([0xd7, 0x8c, 0x20, 0x00, 0xc9], 0xc316);
    expect(await listing(memory, 0xc316, 0xc31a, false, basic())).toEqual([
      ["rst $10", "(IS-BASIC call list)"],
      [".defb $8c", "(IS-BASIC call: segment 1, entry 12)"],
      [".defb $20", "(IS-BASIC call: the BASIC ROM, entry 32)"],
      [".defb $00", "(IS-BASIC call list: end)"],
      ["ret", undefined]
    ]);
  });

  it("lists a routine's inline operands, a $00 among them", async () => {
    const memory = new Uint8Array(0x10000);
    // --- $92 takes a byte (here $00, not the end), $93 a word
    memory.set([0xd7, 0x92, 0x00, 0x93, 0x0b, 0x0e, 0x00, 0xc9], 0xc000);
    expect(await listing(memory, 0xc000, 0xc007, false, basic())).toEqual([
      ["rst $10", "(IS-BASIC call list)"],
      [".defb $92", "(IS-BASIC call: segment 1, entry 18)"],
      [".defb $00", "(operand)"],
      [".defb $93", "(IS-BASIC call: segment 1, entry 19)"],
      [".defw $0e0b", "(operand)"],
      [".defb $00", "(IS-BASIC call list: end)"],
      ["ret", undefined]
    ]);
    expect([...BASIC_CALL_OPERANDS.entries()]).toEqual([
      [0x92, 1],
      [0x93, 2],
      [0x96, 2]
    ]);
  });

  it("still decodes RST 30h, inside the BASIC pages too", async () => {
    const memory = new Uint8Array(0x10000);
    memory.set([0xf7, 0x18, 0xd7, 0x80, 0x00, 0x00], 0xc000);
    expect(await listing(memory, 0xc000, 0xc005, false, basic())).toEqual([
      ["rst $30", "(EXOS call)"],
      [".defb $18", "(EXOS 24: Allocate segment)"],
      ["rst $10", "(IS-BASIC call list)"],
      [".defb $80", "(IS-BASIC call: segment 1, entry 0)"],
      [".defb $00", "(IS-BASIC call list: end)"],
      ["nop", undefined]
    ]);
  });

  it("decodes the lists only where the machine's context says IS-BASIC's ROM page is", async () => {
    const factory = machineRegistry.find((m) => m.machineId === MI_ENTERPRISE)!.toolInfo![CT_CUSTOM_DISASSEMBLER] as (
      context?: unknown
    ) => ICustomDisassembler;
    const memory = new Uint8Array(0x10000);
    memory.set([0xd7, 0x8c, 0x00, 0x00], 0xc000);
    const inBasic = factory({ inDescribedRom: () => false, inRomOfKind: (_a: number, kind: string) => kind === "ep-exos-basic" });
    expect((await listing(memory, 0xc000, 0xc003, false, inBasic)).map(([i]) => i)).toEqual([
      "rst $10",
      ".defb $8c",
      ".defb $00",
      "nop"
    ]);
    const elsewhere = factory({ inDescribedRom: () => false, inRomOfKind: () => false });
    expect((await listing(memory, 0xc000, 0xc003, false, elsewhere)).map(([i]) => i)).toEqual([
      "rst $10",
      "adc a,h",
      "nop",
      "nop"
    ]);
  });
});
