import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Z80Tester } from "./z80-tester";
import { Zx80CustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/zx80-disassembler";
import { romDecoderFor } from "@renderer/appIde/annotations/romDecoder";

/**
 * The ZX80's custom disassembly: the byte after RST $08 is an error code (the handler at $0008 reads
 * it with POP HL / LD L,(HL)), shown with its report, the code + 1. RST $28 is ordinary code: the
 * ZX80 has no calculator.
 */
describe("Disassembler - ZX80-specific", () => {
  it("RST $08 is followed by an error code, shown as its report", async () => {
    await Z80Tester.TestCustomWithComments(
      new Zx80CustomDisassembler(),
      -1,
      ["rst $08", ".defb $03", "pop hl"],
      ["(report error)", "(report 4)", undefined],
      [0xcf, 0x03, 0xe1]
    );
  });

  it("RST $28 is not a calculator: the next byte is an instruction", async () => {
    await Z80Tester.TestCustomWithComments(
      new Zx80CustomDisassembler(),
      -1,
      ["rst $28", "and b", "nop"],
      [undefined, undefined, undefined],
      [0xef, 0xa0, 0x00]
    );
  });

  it("keeps the ROM's instruction starts after RST $08: RETURN_CMD's error ($0970) before PRINT_CMD ($0972)", async () => {
    const rom = new Uint8Array(readFileSync(join(__dirname, "../../src/public/roms/zx80.rom")));
    const starts = (listing: { offset: number }[]) => new Set(listing.map((item) => item.offset));
    // --- Plain Z80 reads $CF $06 $7E as RST $08 and LD B,$7E, which swallows PRINT_CMD's first byte
    const plain = starts(await romDecoderFor(undefined)(rom, 0x0960, 0x0980));
    expect(plain.has(0x0972)).toBe(false);
    const zx80 = await romDecoderFor("zx80")(rom, 0x0960, 0x0980);
    expect(starts(zx80).has(0x0972)).toBe(true);
    expect(zx80.find((item) => item.offset === 0x0971)?.length).toBe(1);
  });
});
