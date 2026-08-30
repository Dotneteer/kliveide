import { MemorySectionType } from "@abstractions/MemorySection";
import { toDecimal3, toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import {
  DisassemblyItem,
  DisassemblyAnnotationMetadata,
  DisassemblyOperandLabelResolver,
  MemorySection
} from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import {
  NexAnnotationLabel,
  NexAnnotationLabelScope,
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
          ...(await createInstructionItems(
            annotations,
            bankAnnotation,
            bank,
            contents,
            start,
            end,
            decimalView,
            addressOffset
          ))
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
  annotations: NexFileAnnotations,
  bankAnnotation: NexBankAnnotation,
  bank: number,
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
      decimalMode: decimalView,
      operandLabelResolver: createAnnotationOperandLabelResolver(
        annotations,
        bankAnnotation,
        bank,
        addressOffset
      )
    }
  );
  disassembler.setAddressOffset(addressOffset);
  const output = await disassembler.disassemble(start, end);
  return (output?.outputItems ?? []).map((item) => ({
    ...item,
    annotation: createAnnotationMetadata(
      bank,
      bankOffsetFromAddress(item.address, addressOffset),
      item.opCodes?.length ?? 1,
      "disassemble"
    )
  }));
}

function createAnnotationOperandLabelResolver(
  annotations: NexFileAnnotations,
  bankAnnotation: NexBankAnnotation,
  bank: number,
  addressOffset: number
): DisassemblyOperandLabelResolver {
  return ({ instructionOffset, operandIndex, operandValue }) => {
    const bankOffset = instructionOffset & NEX_BANK_LAST_OFFSET;
    const explicitReference = bankAnnotation.operandReferences?.[String(bankOffset)]?.find(
      (reference) => reference.operandIndex === operandIndex
    );

    if (explicitReference) {
      return resolveReferencedOperandLabel(
        annotations,
        bankAnnotation,
        explicitReference.scope,
        explicitReference.name,
        operandValue,
        addressOffset
      );
    }

    return resolveAutomaticOperandLabel(annotations, bankAnnotation, operandValue, addressOffset);
  };
}

function resolveAutomaticOperandLabel(
  annotations: NexFileAnnotations,
  bankAnnotation: NexBankAnnotation,
  operandValue: number,
  addressOffset: number
): string | undefined {
  const globalLabel = annotations.globalLabels?.find((label) => label.value === operandValue);
  if (globalLabel) {
    return globalLabel.name;
  }

  const bankRelativeValue = operandValue - addressOffset;
  if (bankRelativeValue < 0 || bankRelativeValue > NEX_BANK_LAST_OFFSET) {
    return undefined;
  }
  return bankAnnotation.localLabels?.find((label) => label.value === bankRelativeValue)?.name;
}

function resolveReferencedOperandLabel(
  annotations: NexFileAnnotations,
  bankAnnotation: NexBankAnnotation,
  scope: NexAnnotationLabelScope,
  name: string,
  operandValue: number,
  addressOffset: number
): string | undefined {
  const label =
    scope === "global"
      ? annotations.globalLabels?.find((item) => item.name === name)
      : bankAnnotation.localLabels?.find((item) => item.name === name);
  if (!label) {
    return undefined;
  }
  return labelMatchesOperand(label, scope, operandValue, addressOffset) ? label.name : undefined;
}

function labelMatchesOperand(
  label: NexAnnotationLabel,
  scope: NexAnnotationLabelScope,
  operandValue: number,
  addressOffset: number
): boolean {
  if (scope === "global") {
    return label.value === operandValue;
  }
  const bankRelativeValue = operandValue - addressOffset;
  return bankRelativeValue >= 0 && bankRelativeValue <= NEX_BANK_LAST_OFFSET
    ? label.value === bankRelativeValue
    : false;
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
      instruction: `.defb ${values.join(", ")}`,
      annotation: createAnnotationMetadata(
        undefined,
        offset,
        Math.min(4, end - offset + 1),
        "bytes"
      )
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
      instruction: `.defw ${values.join(", ")}`,
      annotation: createAnnotationMetadata(
        undefined,
        offset,
        Math.min(4, end - offset + 1),
        "words"
      )
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
    instruction: `.skip ${decimalView ? length.toString(10) : `$${toHexa4(length)}`}`,
    annotation: createAnnotationMetadata(undefined, start, length, "skip")
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
    const bankOffset = item.annotation?.bankOffset ?? bankOffsetFromAddress(item.address, addressOffset);
    const lineAnnotation = bankAnnotation.lineAnnotations?.[String(bankOffset)];
    const rowByteLength = item.annotation?.byteLength ?? item.opCodes?.length ?? 1;
    const rowRegionType = item.annotation?.regionType;
    const generatedHardComment = item.hardComment;

    if (lineAnnotation?.synopsis) {
      for (const commentLine of lineAnnotation.synopsis.split(/\r?\n/)) {
        decorated.push({
          address: item.address,
          isPrefixItem: true,
          prefixComment: commentLine,
          annotation: createAnnotationMetadata(
            bank,
            bankOffset,
            rowByteLength,
            rowRegionType,
            true
          )
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
    item.annotation = {
      ...(item.annotation ?? createAnnotationMetadata(bank, bankOffset, rowByteLength, rowRegionType)),
      bank,
      hasLineAnnotation: !!lineAnnotation?.synopsis || !!lineAnnotation?.comment,
      hasLabel: labels.length > 0,
      generatedHardComment
    };

    decorated.push(item);
  }
  return decorated;
}

function createAnnotationMetadata(
  bank: number | undefined,
  bankOffset: number,
  byteLength: number,
  regionType?: DisassemblyAnnotationMetadata["regionType"],
  hasLineAnnotation = false
): DisassemblyAnnotationMetadata {
  return {
    bank,
    bankOffset,
    byteLength,
    regionType,
    hasLineAnnotation
  };
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
