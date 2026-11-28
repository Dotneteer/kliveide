import { describe, expect, it } from "vitest";

import { MemoryMap, MemorySection } from "@renderer/appIde/disassemblers/common-types";
import {
  SamCustomDisassembler,
  samCalcOpInvalid,
  samCalcShape,
  samRst8Comment
} from "@renderer/appIde/disassemblers/z80-disassembler/sam-disassembler";
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

  it("lists the calculator stream after RST 28h, operands included, up to the operation that ends it", async () => {
    const memory = new Uint8Array(0x10000);
    // --- RST 28h; $27 + a 5-byte number; $20 + offset -6 from $8008 (to $8002); $D9; $33 (end); then code
    memory.set([0xef, 0x27, 1, 2, 3, 4, 5, 0x20, 0xfa, 0xd9, 0x33, 0x00], 0x8000);
    expect(await listing(memory, 0x8000, 0x800b)).toEqual([
      ["rst $28", "(calculator)"],
      [".defb $27, $01, $02, $03, $04, $05", "(calc $27: stack a 5-byte number)"],
      [".defb $20, $fa", "(calc $20: jump to $8002)"],
      [".defb $d9", "(calc $D9: recall memory 1)"],
      [".defb $33", "(calc $33: end of calculation)"],
      ["nop", undefined]
    ]);
  });

  it("lists the bytes after operation $28 one 5-byte number to a row", async () => {
    const memory = new Uint8Array(0x10000);
    // --- RST 28h; $28 with 12 bytes; $33 (end)
    memory.set([0xef, 0x28, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0x33], 0x8000);
    expect(await listing(memory, 0x8000, 0x800f)).toEqual([
      ["rst $28", "(calculator)"],
      [".defb $28, $0c", "(calc $28: stack bytes 12)"],
      [".defb $01, $02, $03, $04, $05", "(calc $28: bytes 1-5 of 12)"],
      [".defb $06, $07, $08, $09, $0a", "(calc $28: bytes 6-10 of 12)"],
      [".defb $0b, $0c", "(calc $28: bytes 11-12 of 12)"],
      [".defb $33", "(calc $33: end of calculation)"]
    ]);
  });

  it("leaves the calculator stream at a byte that is no operation", async () => {
    const memory = new Uint8Array(0x10000);
    memory.set([0xef, 0x03, 0x78, 0x00], 0x8000);
    expect(await listing(memory, 0x8000, 0x8003)).toEqual([
      ["rst $28", "(calculator)"],
      [".defb $03", "(calc $03: operation)"],
      ["ld a,b", undefined],
      ["nop", undefined]
    ]);
  });

  it("lists the ROM1 address after RST 30h below $4000, and nothing after it above", async () => {
    const memory = new Uint8Array(0x10000);
    memory.set([0xf7, 0x14, 0xf3, 0xf7, 0x56, 0x52], 0x0100);
    memory.set([0xf7, 0x00], 0x8000);
    expect(await listing(memory, 0x0100, 0x0105)).toEqual([
      ["rst $30", "(ROM1 call)"],
      [".defw $f314", "(call ROM1 $F314)"],
      ["rst $30", "(ROM1 call)"],
      [".defw $5256", "(jump to ROM1 $D256)"]
    ]);
    expect(await listing(memory, 0x8000, 0x8001)).toEqual([
      ["rst $30", undefined],
      ["nop", undefined]
    ]);
  });

  it("lists the ROM0 address after CALL $0201 and CALL $01FA, not after a conditional call", async () => {
    const memory = new Uint8Array(0x10000);
    memory.set([0xcd, 0x01, 0x02, 0x75, 0x30, 0xcd, 0xfa, 0x01, 0x98, 0x17, 0xcc, 0x01, 0x02, 0x00], 0xc000);
    expect(await listing(memory, 0xc000, 0xc00d)).toEqual([
      ["call l0201", undefined],
      [".defw $3075", "(call $3075, ROM1 paged out)"],
      ["call l01fa", undefined],
      [".defw $1798", "(jump to $1798, ROM1 paged out)"],
      ["call z,l0201", undefined],
      ["nop", undefined]
    ]);
  });

  it("lists the error code after CALL $0D47, the statement search", async () => {
    const memory = new Uint8Array(0x10000);
    memory.set([0xcd, 0x47, 0x0d, 0x09, 0x00], 0x1800);
    expect(await listing(memory, 0x1800, 0x1804)).toEqual([
      ["call l0d47", undefined],
      [".defb $09", "(error 9)"],
      ["nop", undefined]
    ]);
  });

  it("knows which calculator operations take operands and which end the stream", () => {
    expect(samCalcShape(0x28).operands).toBe("counted");
    expect(samCalcShape(0x29).operands).toBe("word");
    expect(samCalcShape(0x34).ends).toBe(true);
    expect(samCalcShape(0x39).ends).toBeUndefined();
    expect(samCalcOpInvalid(0x5e)).toBe(true);
    expect(samCalcOpInvalid(0xc7)).toBe(true);
    expect(samCalcOpInvalid(0xc8)).toBe(false);
  });
});
