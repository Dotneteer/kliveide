import { describe, expect, it } from "vitest";
import { MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { isReassemblable, nonCanonicalReason } from "@common/reverse/canonicalEncoding";

/*
 * The exhaustive check behind source export's R10 (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md`
 * §7.3): every opcode pattern — unprefixed, CB, ED, DD/FD and DD CB/FD CB, with fixed operand
 * bytes, with and without the Next's set — is disassembled, its text assembled, and
 * `isReassemblable` must predict exactly whether the bytes came back.
 */

const BASE = 0x8000;

async function disassembleOne(bytes: number[], z80n: boolean) {
  const memory = new Uint8Array(0x10000);
  memory.set(bytes, BASE);
  const disassembler = new Z80Disassembler(
    [new MemorySection(BASE, BASE + bytes.length - 1)],
    memory,
    undefined,
    { allowExtendedSet: z80n, noLabelPrefix: true }
  );
  const output = await disassembler.disassemble(BASE, BASE + bytes.length - 1);
  return output!.outputItems[0];
}

async function assembleOne(text: string, z80n: boolean): Promise<number[] | undefined> {
  const options = new AssemblerOptions();
  options.allowNextInstructions = z80n;
  const output = await new Z80Assembler().compile(`  .org $${BASE.toString(16)}\n  ${text}\n`, options);
  if (output.errorCount > 0) return undefined;
  return output.segments[0]?.emittedCode ?? [];
}

function patterns(): number[][] {
  const result: number[][] = [];
  for (let op = 0; op < 256; op++) {
    if (![0xcb, 0xdd, 0xed, 0xfd].includes(op)) result.push([op, 0x12, 0x34, 0x56]);
    result.push([0xcb, op, 0x12, 0x34]);
    result.push([0xed, op, 0x12, 0x34]);
    result.push([0xdd, op, 0x12, 0x34]);
    result.push([0xfd, op, 0x12, 0x34]);
    result.push([0xdd, 0xcb, 0x12, op]);
    result.push([0xfd, 0xcb, 0x12, op]);
  }
  return result;
}

const hex = (bytes: ArrayLike<number>) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ");

describe("canonical encodings", () => {
  for (const z80n of [false, true]) {
    it(`predicts every round trip exactly (${z80n ? "Z80N" : "Z80"})`, async () => {
      const wrong: string[] = [];
      let nonCanonical = 0;
      for (const pattern of patterns()) {
        const item = await disassembleOne(pattern, z80n);
        const opcodes = item.opCodes!;
        const assembled = await assembleOne(item.instruction ?? "", z80n);
        const roundTrips =
          !!assembled &&
          assembled.length === opcodes.length &&
          assembled.every((b, i) => b === opcodes[i]);
        if (!roundTrips) nonCanonical++;
        if (roundTrips !== isReassemblable(opcodes, z80n)) {
          wrong.push(`${hex(opcodes)} "${item.instruction}" round-trips: ${roundTrips}`);
        }
      }
      expect(wrong).toEqual([]);
      // --- The table is not vacuous: today's list of non-canonical forms is long
      expect(nonCanonical).toBeGreaterThan(z80n ? 500 : 600);
    }, 120_000);
  }

  it("names the reasons", () => {
    expect(nonCanonicalReason([0xed, 0x4c], false)).toBe("ed-mirror");
    expect(nonCanonicalReason([0xed, 0x63, 0, 0], false)).toBe("ed-mirror");
    expect(nonCanonicalReason([0xed, 0x00], false)).toBe("undefined-ed");
    expect(nonCanonicalReason([0xed, 0x91, 1, 2], false)).toBe("undefined-ed");
    expect(nonCanonicalReason([0xed, 0x91, 1, 2], true)).toBeUndefined();
    expect(nonCanonicalReason([0xdd, 0x00], false)).toBe("ignored-prefix");
    expect(nonCanonicalReason([0xdd, 0xcb, 5, 0x40], false)).toBe("indexed-bit-mirror");
    expect(nonCanonicalReason([0xdd, 0xcb, 5, 0x46], false)).toBeUndefined();
    expect(nonCanonicalReason([0x3e, 5], false)).toBeUndefined();
  });
});
