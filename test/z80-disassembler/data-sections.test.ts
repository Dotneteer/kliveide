import { describe, it, expect } from "vitest";
import { MemorySectionType } from "@abstractions/MemorySection";
import { MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";

async function disassemble(
  type: MemorySectionType,
  bytes: number[],
  decimalMode = false
): Promise<string[]> {
  const end = bytes.length - 1;
  const disassembler = new Z80Disassembler(
    [new MemorySection(0, end, type)],
    new Uint8Array(bytes),
    undefined,
    { decimalMode }
  );
  const output = await disassembler.disassemble(0, end);
  return output!.outputItems.map((item) => `${item.address}: ${item.instruction}`);
}

describe("Disassembler - data sections", () => {
  it("reads every word of a full .defw row", async () => {
    const lines = await disassemble(
      MemorySectionType.WordArray,
      [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]
    );
    expect(lines).toEqual(["0: .defw $0201, $0403, $0605, $0807"]);
  });

  it("starts the next .defw row on the right bytes", async () => {
    const lines = await disassemble(
      MemorySectionType.WordArray,
      [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c]
    );
    expect(lines).toEqual(["0: .defw $0201, $0403, $0605, $0807", "8: .defw $0A09, $0C0B"]);
  });

  it("never reads past the end of a short word section", async () => {
    const lines = await disassemble(MemorySectionType.WordArray, [0x34, 0x12, 0x78, 0x56]);
    expect(lines).toEqual(["0: .defw $1234, $5678"]);
  });

  it("emits a trailing odd byte of a word section as .defb", async () => {
    const lines = await disassemble(MemorySectionType.WordArray, [0x34, 0x12, 0x56]);
    expect(lines).toEqual(["0: .defw $1234", "2: .defb $56"]);
  });

  it("formats words in decimal mode", async () => {
    const lines = await disassemble(MemorySectionType.WordArray, [0x34, 0x12, 0x78, 0x56], true);
    expect(lines).toEqual(["0: .defw 4660, 22136"]);
  });

  it("writes .skip with its length", async () => {
    expect(await disassemble(MemorySectionType.Skip, [0, 0, 0, 0])).toEqual(["0: .skip $0004"]);
    expect(await disassemble(MemorySectionType.Skip, [0, 0, 0, 0], true)).toEqual(["0: .skip 4"]);
  });
});
