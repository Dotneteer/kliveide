import { describe, expect, it } from "vitest";

import { MemoryMap, MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { SamCustomDisassembler, samRst8Comment } from "@renderer/appIde/disassemblers/z80-disassembler/sam-disassembler";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";

/* The SAM's custom disassembly (plan §11): the byte after `RST 8` is an error code or a DOS hook */

async function listing(memory: Uint8Array, start: number, end: number) {
  const map = new MemoryMap();
  map.add(new MemorySection(start, end));
  const disassembler = new Z80Disassembler(map.sections, memory, undefined, { getRomPage: () => -1, decimalMode: false });
  disassembler.setCustomDisassembler(new SamCustomDisassembler());
  const output = await disassembler.disassemble();
  return output!.outputItems.map((i) => [i.instruction?.toLowerCase(), i.hardComment]);
}

describe("SAM disassembler", () => {
  it("lists the byte after RST 8 as data with the hook's or error's name", async () => {
    const memory = new Uint8Array(0x10000);
    memory.set([0xcf, 0x82, 0xcf, 0x13, 0x00], 0x8000);
    expect(await listing(memory, 0x8000, 0x8004)).toEqual([
      ["rst $08", "(error or DOS hook)"],
      [".defb $82", "(DOS hook 130: HLOAD)"],
      ["rst $08", "(error or DOS hook)"],
      [".defb $13", "(error 19)"],
      ["nop", undefined]
    ]);
  });

  it("names unknown hooks by number", () => {
    expect(samRst8Comment(200)).toBe("(DOS hook 200)");
  });
});
