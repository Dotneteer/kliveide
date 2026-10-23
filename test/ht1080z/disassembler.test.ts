import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import { HT1080Z_TOKENS } from "@common/ht1080z/basicTokens";
import { MemoryMap, MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { Ht1080zCustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/ht1080z-disassembler";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";

/*
 * The HT-1080Z's custom disassembly (`.plans/HT1080Z_PLAN.md` §11): the byte after `RST 08h` and the
 * BASIC ROM's tables, checked against the real ROMs of all three models.
 */
const romOf = (set: string) => new Uint8Array(readFileSync(join(__dirname, `../../src/public/roms/ht1080z-${set}.rom`)));

async function listing(memory: Uint8Array, start: number, end: number) {
  const map = new MemoryMap();
  map.add(new MemorySection(start, end));
  const disassembler = new Z80Disassembler(map.sections, memory, undefined, { getRomPage: () => -1 });
  disassembler.setCustomDisassembler(new Ht1080zCustomDisassembler());
  const output = await disassembler.disassemble();
  return output!.outputItems.map((i) => ({ address: i.address, instruction: i.instruction, comment: i.hardComment }));
}

describe("HT-1080Z disassembler", () => {
  it("decodes the reserved-word table into the 124 tokens, the same in every model's ROM", () => {
    for (const set of ["s1", "s2", "s64"]) {
      const rom = romOf(set);
      const words: string[] = [];
      for (let a = 0x1650; rom[a] !== 0x80 || words.length === 0; a++) {
        if (rom[a] & 0x80) words.push(String.fromCharCode(rom[a] & 0x7f));
        else words[words.length - 1] += String.fromCharCode(rom[a]);
      }
      expect(words).toEqual(HT1080Z_TOKENS);
    }
  });

  it("lists the byte after RST 08h as the character the syntax check expects", async () => {
    const memory = new Uint8Array(0x10000);
    memory.set([0xcf, 0x28, 0xcf, 0xd5, 0x00], 0x2000);
    const items = await listing(memory, 0x2000, 0x2004);
    expect(items.map((i) => [i.instruction?.toLowerCase(), i.comment])).toEqual([
      ["rst $08", "(Syntax check)"],
      [".defb $28", '(expects "(")'],
      ["rst $08", "(Syntax check)"],
      [".defb $d5", "(expects token =)"],
      ["nop", undefined]
    ]);
  });

  it("leaves RST 08h in RAM alone", async () => {
    const memory = new Uint8Array(0x10000);
    memory.set([0xcf, 0x00], 0x5000);
    const items = await listing(memory, 0x5000, 0x5001);
    expect(items.map((i) => i.instruction?.toLowerCase())).toEqual(["rst $08", "nop"]);
  });

  it("lists the ROM's tables as data", async () => {
    const memory = new Uint8Array(0x10000);
    memory.set(romOf("s2"), 0);
    const items = await listing(memory, 0x1608, 0x18f6);
    const at = (a: number) => items.find((i) => i.address === a);
    // --- Function dispatch: SGN first
    expect(at(0x1608)).toMatchObject({ instruction: ".defw $098A", comment: "(SGN)" });
    // --- Reserved words: END, then the terminator
    expect(at(0x1650)).toMatchObject({ instruction: ".defb $C5, $4E, $44", comment: '("END")' });
    expect(at(0x1820)).toMatchObject({ comment: `("'")` });
    expect(at(0x1821)).toMatchObject({ comment: "(end of reserved words)" });
    // --- Statement dispatch: END at 1DAEh, NEW last
    expect(at(0x1822)).toMatchObject({ instruction: ".defw $1DAE", comment: "(END)" });
    expect(at(0x1898)).toMatchObject({ comment: "(NEW)" });
    expect(at(0x189a)).toMatchObject({ instruction: ".defb $79", comment: "(precedence of +)" });
    // --- The error codes: NF is error 1, FD error 22
    expect(at(0x18c9)).toMatchObject({ instruction: '.defb "NF"', comment: "(error 1)" });
    expect(at(0x18f3)).toMatchObject({ instruction: '.defb "FD"', comment: "(error 22)" });
    // --- Nothing in the tables is listed as an instruction
    expect(items.every((i) => i.instruction?.startsWith("."))).toBe(true);
  });
});
