import {
  DisassemblyOutput,
  MemorySection,
  MemorySectionType,
} from "../../disassembler/disassembly-helper";
import { getMemoryContents } from "../messaging/messaging-core";
import { Z80Disassembler } from "../../disassembler/z80-disassembler";

/**
 * Gets the disassembly for the specified memory range
 * @param from Start address
 * @param to End address
 */
export async function disassembly(
  from: number,
  to: number
): Promise<DisassemblyOutput> {
  const memoryContents = await getMemoryContents(from, to);
  const bytes = new Uint8Array(Buffer.from(memoryContents.bytes, "base64"));
  const sections: MemorySection[] = [
    new MemorySection(from, to, MemorySectionType.Disassemble),
  ];
  const disassembler = new Z80Disassembler(sections, bytes);
  return await disassembler.disassemble();
}
