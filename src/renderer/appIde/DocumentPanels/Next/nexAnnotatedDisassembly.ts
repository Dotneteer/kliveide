import { MemorySectionType } from "@abstractions/MemorySection";
import { toDecimal3, toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import {
  DisassemblyItem,
  MemorySection
} from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import {
  NexBankAnnotation,
  NexFileAnnotations,
  NEX_BANK_LAST_OFFSET,
  getBankAnnotation,
  getNexBankAddressOffset
} from "./nexAnnotations";

export type AnnotatedNexDisassemblyOptions = {
  annotations: NexFileAnnotations;
  bank: number;
  contents: Uint8Array;
  decimalView?: boolean;
  disassOffset?: number;
};

export async function createAnnotatedNexDisassemblyItems({
  annotations,
  bank,
  contents,
  decimalView = false,
  disassOffset
}: AnnotatedNexDisassemblyOptions): Promise<DisassemblyItem[] | undefined> {
  const bankAnnotation = getBankAnnotation(annotations, bank);
  if (!bankAnnotation) {
    return undefined;
  }

  const addressOffset = disassOffset ?? getNexBankAddressOffset(bankAnnotation.offsetIndex);
  const items: DisassemblyItem[] = [];

  for (const region of bankAnnotation.regions) {
    const start = clampBankOffset(region.start, contents.length);
    const end = clampBankOffset(region.end, contents.length);
    if (start > end) {
      continue;
    }

    switch (region.type) {
      case "disassemble":
        items.push(
          ...(await createInstructionItems(contents, start, end, decimalView, addressOffset))
        );
        break;

      case "bytes":
        items.push(...createByteItems(contents, start, end, decimalView, addressOffset));
        break;

      case "words":
        items.push(...createWordItems(contents, start, end, decimalView, addressOffset));
        break;

      case "skip":
        items.push(createSkipItem(start, end, decimalView, addressOffset));
        break;
    }
  }

  return decorateAnnotatedItems(items, annotations, bankAnnotation, bank, addressOffset);
}

async function createInstructionItems(
  contents: Uint8Array,
  start: number,
  end: number,
  decimalView: boolean,
  addressOffset: number
): Promise<DisassemblyItem[]> {
  const disassembler = new Z80Disassembler(
    [new MemorySection(start, end, MemorySectionType.Disassemble)],
    contents,
    undefined,
    {
      allowExtendedSet: true,
      decimalMode: decimalView
    }
  );
  disassembler.setAddressOffset(addressOffset);
  const output = await disassembler.disassemble(start, end);
  return output?.outputItems ?? [];
}

function createByteItems(
  contents: Uint8Array,
  start: number,
  end: number,
  decimalView: boolean,
  addressOffset: number
): DisassemblyItem[] {
  const items: DisassemblyItem[] = [];
  for (let offset = start; offset <= end; offset += 4) {
    const values: string[] = [];
    for (let idx = 0; idx < 4 && offset + idx <= end; idx++) {
      const value = contents[offset + idx];
      values.push(decimalView ? toDecimal3(value) : `$${toHexa2(value)}`);
    }
    items.push({
      address: effectiveAddress(offset, addressOffset),
      instruction: `.defb ${values.join(", ")}`
    });
  }
  return items;
}

function createWordItems(
  contents: Uint8Array,
  start: number,
  end: number,
  decimalView: boolean,
  addressOffset: number
): DisassemblyItem[] {
  const items: DisassemblyItem[] = [];
  for (let offset = start; offset <= end; offset += 4) {
    const values: string[] = [];
    for (let idx = 0; idx < 4 && offset + idx + 1 <= end; idx += 2) {
      const value = contents[offset + idx] | (contents[offset + idx + 1] << 8);
      values.push(decimalView ? value.toString(10) : `$${toHexa4(value)}`);
    }
    items.push({
      address: effectiveAddress(offset, addressOffset),
      instruction: `.defw ${values.join(", ")}`
    });
  }
  return items;
}

function createSkipItem(
  start: number,
  end: number,
  decimalView: boolean,
  addressOffset: number
): DisassemblyItem {
  const length = end - start + 1;
  return {
    address: effectiveAddress(start, addressOffset),
    instruction: `.skip ${decimalView ? length.toString(10) : `$${toHexa4(length)}`}`
  };
}

function decorateAnnotatedItems(
  items: DisassemblyItem[],
  annotations: NexFileAnnotations,
  bankAnnotation: NexBankAnnotation,
  bank: number,
  addressOffset: number
): DisassemblyItem[] {
  const decorated: DisassemblyItem[] = [];
  for (const item of items) {
    const bankOffset = bankOffsetFromAddress(item.address, addressOffset);
    const lineAnnotation = bankAnnotation.lineAnnotations?.[String(bankOffset)];

    if (lineAnnotation?.synopsis) {
      for (const commentLine of lineAnnotation.synopsis.split(/\r?\n/)) {
        decorated.push({
          address: item.address,
          isPrefixItem: true,
          prefixComment: commentLine
        });
      }
    }

    const labels = getLabelsForOffset(annotations, bankAnnotation, bank, bankOffset, addressOffset);
    if (labels.length > 0) {
      item.hasLabel = true;
      item.formattedLabel = labels[0].name;
    }

    if (lineAnnotation?.comment) {
      item.hardComment = item.hardComment
        ? `${item.hardComment} | ${lineAnnotation.comment}`
        : lineAnnotation.comment;
    }

    decorated.push(item);
  }
  return decorated;
}

function getLabelsForOffset(
  annotations: NexFileAnnotations,
  bankAnnotation: NexBankAnnotation,
  bank: number,
  bankOffset: number,
  addressOffset: number
) {
  const effective = effectiveAddress(bankOffset, addressOffset);
  return [
    ...(annotations.globalLabels ?? [])
      .filter((label) => label.value === effective)
      .map((label) => ({ ...label, scope: "global" as const })),
    ...(bankAnnotation.localLabels ?? [])
      .filter((label) => label.value === bankOffset)
      .map((label) => ({ ...label, scope: "local" as const, bank }))
  ];
}

function bankOffsetFromAddress(address: number, addressOffset: number): number {
  return (address - addressOffset) & NEX_BANK_LAST_OFFSET;
}

function effectiveAddress(bankOffset: number, addressOffset: number): number {
  return (addressOffset + bankOffset) & 0xffff;
}

function clampBankOffset(offset: number, length: number): number {
  return Math.min(Math.max(offset, 0), Math.min(length - 1, NEX_BANK_LAST_OFFSET));
}
