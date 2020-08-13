import {
  DisassemblyOutput,
  MemorySection,
  MemorySectionType,
  DisassemblyItem,
} from "../../disassembler/disassembly-helper";
import { getMemoryContents } from "../messaging/messaging-core";
import { Z80Disassembler } from "../../disassembler/z80-disassembler";
import { DisassemblyAnnotation } from "../../disassembler/annotations";
import { CancellationToken } from "../../utils/cancellation";
import { intToX4 } from "../../disassembler/disassembly-helper";

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
  // --- Get the Z80 memory to disassemble
  const memoryContents = await getMemoryContents(from, to);
  const bytes = new Uint8Array(Buffer.from(memoryContents.bytes, "base64"));

  // --- Use the memory sections in the annotations
  const sections: MemorySection[] = annotations?.memoryMap?.sections ?? [
    new MemorySection(from, to, MemorySectionType.Disassemble),
  ];

  // --- Do the disassembly
  const disassembler = new Z80Disassembler(sections, bytes);
  const rawItems = await disassembler.disassemble(from, to, cancellation);
  if (!rawItems) {
    return rawItems;
  }

  // --- Compose annotations
  const updatedItems: DisassemblyItem[] = [];
  for (const item of rawItems.outputItems) {
    const prefixComment = annotations?.prefixComments.get(item.address);
    if (prefixComment) {
      const prefixItem = new DisassemblyItem(item.address);
      prefixItem.isPrefixItem = true;
      prefixItem.prefixComment = prefixComment;
      updatedItems.push(prefixItem);
    }
    const formattedLabel = annotations?.labels.get(item.address);
    item.formattedLabel =
      formattedLabel ?? (item.hasLabel ? "L" + intToX4(item.address) : "");
    item.formattedComment = item.hardComment ? item.hardComment + " " : "";
    const comment = annotations?.comments.get(item.address);
    if (comment) {
      item.formattedComment += comment;
    }
    if (annotations && item.tokenLength > 0) {
      let symbol: string | undefined;
      if (item.hasLabelSymbol) {
        const label = annotations.labels.get(item.symbolValue);
        if (label) {
          symbol = label;
        }
      } else {
        symbol = annotations.literalReplacements.get(item.address);
      }
      if (symbol && item.instruction) {
        item.instruction =
          item.instruction.substr(0, item.tokenPosition) +
          symbol +
          item.instruction.substr(item.tokenPosition + item.tokenLength);
      }
    }
    updatedItems.push(item);
  }
  rawItems.replaceOutputItems(updatedItems);
  return rawItems;
}
