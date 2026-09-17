import { describe, expect, it } from "vitest";
import {
  MemoryMap,
  MemorySection
} from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";

describe("Z80Disassembler operandLabelResolver", () => {
  it("keeps 16-bit operand output unchanged without a resolver", async () => {
    const item = await disassembleOne([0x21, 0x34, 0x12]);

    expect(item.instruction).toBe("ld hl,$1234");
    expect(item.operandCandidates).toEqual([
      expect.objectContaining({
        instructionAddress: 0x0000,
        instructionOffset: 0x0000,
        operandIndex: 0,
        operandValue: 0x1234,
        pragma: "W",
        defaultText: "$1234"
      })
    ]);
  });

  it("can replace a 16-bit word operand", async () => {
    const item = await disassembleOne([0x21, 0x34, 0x12], {
      operandLabelResolver: (operand) => {
        expect(operand).toEqual(
          expect.objectContaining({
            instructionAddress: 0x0000,
            instructionOffset: 0x0000,
            operandIndex: 0,
            operandValue: 0x1234,
            pragma: "W",
            defaultText: "$1234"
          })
        );
        return "WordTarget";
      }
    });

    expect(item.instruction).toBe("ld hl,WordTarget");
  });

  it("can replace an absolute label operand", async () => {
    const item = await disassembleOne([0xcd, 0x34, 0x12], {
      operandLabelResolver: (operand) => (operand.pragma === "L" ? "CallTarget" : undefined)
    });

    expect(item.instruction).toBe("call CallTarget");
  });

  it("can replace a relative jump target, reporting the resolved address", async () => {
    // --- jr +$10 at $8000 lands on $8002 + $10 = $8012.
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, 1));
    const seen: unknown[] = [];
    const disassembler = new Z80Disassembler(map.sections, new Uint8Array([0x18, 0x10]), undefined, {
      operandLabelResolver: (operand) => {
        seen.push(operand);
        return operand.pragma === "r" && operand.operandValue === 0x8012 ? "LoopHead" : undefined;
      }
    });
    disassembler.setAddressOffset(0x8000);
    const output = await disassembler.disassemble();

    expect(output!.outputItems[0].instruction).toBe("jr LoopHead");
    expect(seen).toEqual([
      expect.objectContaining({ pragma: "r", operandIndex: 0, operandValue: 0x8012, defaultText: "L8012" })
    ]);
  });

  it("keeps the generated label for an unresolved djnz target", async () => {
    // --- djnz -2 loops onto itself.
    const item = await disassembleOne([0x10, 0xfe], { operandLabelResolver: () => undefined });
    expect(item.instruction).toBe("djnz L0000");
  });

  it("can replace a big-endian 16-bit word operand", async () => {
    const item = await disassembleOne([0xed, 0x8a, 0x12, 0x34], {
      allowExtendedSet: true,
      operandLabelResolver: (operand) => (operand.pragma === "w" ? "StackTarget" : undefined)
    });

    expect(item.instruction).toBe("push StackTarget");
  });
});

async function disassembleOne(
  opCodes: number[],
  options?: ConstructorParameters<typeof Z80Disassembler>[3]
) {
  const map = new MemoryMap();
  map.add(new MemorySection(0x0000, opCodes.length - 1));
  const disassembler = new Z80Disassembler(map.sections, new Uint8Array(opCodes), undefined, options);
  const output = await disassembler.disassemble();

  expect(output).not.toBeNull();
  expect(output?.outputItems).toHaveLength(1);
  return output!.outputItems[0];
}
