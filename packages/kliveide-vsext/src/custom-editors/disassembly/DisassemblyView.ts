import {
  DisassemblyOutput,
  MemorySection,
  MemorySectionType,
} from "../../disassembler/disassembly-helper";
import { getMemoryContents } from "../messaging/messaging-core";
import { Z80Disassembler } from "../../disassembler/z80-disassembler";
import { DisassemblyAnnotation } from "../../disassembler/annotations";
import { CancellationToken } from "../../utils/cancellation";

/**
 * Gets the disassembly for the specified memory range
 * @param from Start address
 * @param to End address
 */
export async function disassembly(
  from: number,
  to: number,
  annotations?: DisassemblyAnnotation | null,
  cancellation?: CancellationToken
): Promise<DisassemblyOutput | null> {
  const memoryContents = await getMemoryContents(from, to);
  const bytes = new Uint8Array(Buffer.from(memoryContents.bytes, "base64"));
  const sections: MemorySection[] = annotations?.memoryMap?.sections ?? [
    new MemorySection(from, to, MemorySectionType.Disassemble),
  ];
  const disassembler = new Z80Disassembler(sections, bytes);
  return await disassembler.disassemble(from, to, cancellation);
}
