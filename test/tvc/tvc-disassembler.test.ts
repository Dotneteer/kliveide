import { describe, expect, it } from "vitest";

import { MemoryMap, MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { TvcCustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/tvc-disassembler";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";

/*
 * The TVC's custom disassembly (`.plans/VIDEOTON_TVC_PLAN.md` §11): the byte after `RST 30h` is the
 * system call's function code, anywhere in memory.
 */

async function listing(memory: Uint8Array, start: number, end: number, decimal = false) {
  const map = new MemoryMap();
  map.add(new MemorySection(start, end));
  const disassembler = new Z80Disassembler(map.sections, memory, undefined, { getRomPage: () => -1, decimalMode: decimal });
  disassembler.setCustomDisassembler(new TvcCustomDisassembler());
  const output = await disassembler.disassemble();
  return output!.outputItems.map((i) => [i.instruction?.toLowerCase(), i.hardComment]);
}

describe("TVC disassembler", () => {
  it("lists the byte after RST 30h as the system call's function", async () => {
    const memory = new Uint8Array(0x10000);
    // --- rst $30 / .defb $21 / rst $30 / .defb $f7 (a code that looks like another RST) / nop
    memory.set([0xf7, 0x21, 0xf7, 0xf7, 0x00], 0x6000);
    expect(await listing(memory, 0x6000, 0x6004)).toEqual([
      ["rst $30", "(System call)"],
      [".defb $21", "(system call function)"],
      ["rst $30", "(System call)"],
      [".defb $f7", "(system call function)"],
      ["nop", undefined]
    ]);
  });

  it("leaves the other restarts alone", async () => {
    const memory = new Uint8Array(0x10000);
    memory.set([0xcf, 0x00, 0xff, 0x00], 0x6000);
    expect((await listing(memory, 0x6000, 0x6003)).map(([i]) => i)).toEqual(["rst $08", "nop", "rst $38", "nop"]);
  });
});
