import { describe, expect, it } from "vitest";
import { MemoryMap, MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { extendedInstructionLenghts } from "@emu/machines/zxNext/z80nInstructionLengths";

/**
 * `getCallInstructionLength` decides where step-over plants its temporary breakpoint: at
 * `PC + length`. If the length is wrong, that address is never reached as a PC value, the temporary
 * breakpoint never fires, and **the machine runs free to the next real breakpoint** — which looks
 * to the user like step-over teleporting somewhere unrelated.
 *
 * That is not hypothetical. `ED 92` (`NEXTREG n,A`) was listed as 4 bytes when it is 3, so stepping
 * over `$00FD` in the ZX Spectrum Next ROM aimed at `$0101`, which is the middle of the *following*
 * instruction, and execution ran away.
 *
 * The lengths are therefore checked against the disassembler, which derives them by actually
 * consuming operand bytes, rather than being maintained by hand in two places.
 */
async function decodedLength(secondOpCode: number): Promise<number> {
  // --- Trailing zeros stand in for any operand bytes the instruction consumes.
  const bytes = [0xed, secondOpCode, 0x00, 0x00, 0x00];
  const map = new MemoryMap();
  map.add(new MemorySection(0x0000, bytes.length - 1));
  const output = await new Z80Disassembler(map.sections, new Uint8Array(bytes), undefined, {
    allowExtendedSet: true
  }).disassemble();
  return output!.outputItems[0].opCodes!.length;
}

describe("Z80N step-over instruction lengths", () => {
  const entries = Object.entries(extendedInstructionLenghts).map(
    ([op, length]) => [Number(op), length as number] as const
  );

  it("covers a non-empty table", () => {
    expect(entries.length).toBeGreaterThan(20);
  });

  it.each(entries)("ED $%s is %i bytes", async (opCode, declared) => {
    const actual = await decodedLength(opCode);
    expect(
      declared,
      `ED ${opCode.toString(16).padStart(2, "0")} is ${actual} bytes, but step-over believes it is ` +
        `${declared}. Step-over would aim its temporary breakpoint at the wrong address and the ` +
        `machine would run away.`
    ).toBe(actual);
  });

  it("gets NEXTREG right in both of its forms, which differ by one operand", async () => {
    // --- The pair that produced the original bug: `NEXTREG n,n` takes two operand bytes and
    // --- `NEXTREG n,A` takes one, so they are 4 and 3 bytes and must not be given the same length.
    expect(extendedInstructionLenghts[0x91]).toBe(4);
    expect(extendedInstructionLenghts[0x92]).toBe(3);
    expect(await decodedLength(0x91)).toBe(4);
    expect(await decodedLength(0x92)).toBe(3);
  });
});
