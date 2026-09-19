import { MemorySectionType } from "@abstractions/MemorySection";
import { toDecimal3, toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import {
  DisassemblyItem,
  DisassemblyAnnotationMetadata,
  DisassemblyOperandLabelResolver,
  MemorySection
} from "@renderer/appIde/disassemblers/common-types";
import { resolveOperandLabel } from "./nexGoToDefinition";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import {
  NexAnnotationRegion,
  NexBankAnnotation,
  NexFileAnnotations,
  NEX_BANK_LAST_OFFSET,
  NEX_MAX_ROW_BYTES,
  getBankAnnotation,
  getNexBankAddressOffset
} from "./nexAnnotations";
import { chainOperandLabelResolvers } from "@renderer/appIde/disassemblers/sys-var-operand-labels";

/**
 * Split a byte range so that an instruction boundary is guaranteed to fall on `anchor`.
 *
 * A linear disassembly is only as well-aligned as the offset it started from. Decode from byte 0 of
 * a bank and every instruction boundary after the first stretch of data is a guess — one that
 * self-modifying code, a jump table, or a decompressed payload can make wrong for the rest of the
 * bank. The program counter is the one offset in the bank where the alignment is *known*: a paused
 * Z80 sits between instructions, so whatever is at PC is the first byte of a real one.
 *
 * So the run is cut in two at PC and each half decoded separately. Where the listing was already
 * aligned there, the two halves rejoin exactly as before — the first run ends at `anchor - 1` of its
 * own accord — and the listing is unchanged. Where it was not, the rows from PC onward are now the
 * instructions the processor will actually execute instead of a decode that slipped a byte.
 *
 * The seam is honest rather than tidy: when the old alignment was wrong, the instruction straddling
 * PC is still emitted by the first run, so its bytes overlap the row beneath it. That overlap *is*
 * the disagreement between the two decodes, and hiding it would hide the one thing worth noticing.
 *
 * `anchor` outside `(start, end]` leaves the range alone — including `anchor === start`, which needs
 * no cut because the run already begins on the boundary.
 */
export function pcAnchoredRuns(
  start: number,
  end: number,
  anchor: number | undefined
): Array<[number, number]> {
  if (anchor === undefined || anchor <= start || anchor > end) return [[start, end]];
  return [
    [start, anchor - 1],
    [anchor, end]
  ];
}

/**
 * Where the ULA screen sits: `$4000-$57FF` bitmap and `$5800-$5AFF` attributes, 6,912 bytes.
 *
 * Bank-relative, because it only means "the screen" in a bank listed at `$4000` — see
 * `screenAreaApplies`. Anywhere else these offsets are just the first 7K of some other bank.
 */
export const SCREEN_AREA_BASE = 0x4000;
export const SCREEN_AREA_RANGE = { start: 0x0000, end: 0x1aff } as const;

/**
 * Does this listing have a screen area to hide?
 *
 * Keyed on the **listing offset**, not on live paging: the offset is what makes bank offset 0 read as
 * `$4000` on screen, so it is what decides whether the rows the reader sees are screen memory. It also
 * means the choice holds with no machine running, which a paging test could not.
 */
export function screenAreaApplies(args: { isNexBank: boolean; disassOffset: number }): boolean {
  return args.isNexBank && args.disassOffset === SCREEN_AREA_BASE;
}

/**
 * Lay one region over a bank's authored regions, cutting whatever it covers.
 *
 * A **display override**, never an edit: the result is used to generate a listing and is not written
 * anywhere. That is the property that matters — a switch that rewrote the sidecar's regions would
 * silently destroy any annotation the user had made inside the range the first time it was flipped.
 *
 * Regions that straddle an edge are trimmed rather than dropped, so the bytes either side of the
 * overlay keep the type the user gave them.
 */
export function overlayRegion(
  regions: NexAnnotationRegion[],
  overlay: NexAnnotationRegion
): NexAnnotationRegion[] {
  const result: NexAnnotationRegion[] = [];
  for (const region of regions) {
    if (region.end < overlay.start || region.start > overlay.end) {
      result.push(region);
      continue;
    }
    if (region.start < overlay.start) {
      result.push({ ...region, end: overlay.start - 1 });
    }
    if (region.end > overlay.end) {
      result.push({ ...region, start: overlay.end + 1 });
    }
  }
  result.push(overlay);
  return result.sort((a, b) => a.start - b.start);
}

/** The single row a hidden screen area collapses to, shared by the annotated and plain listings. */
export function createScreenSkipItem(decimalView: boolean, addressOffset: number): DisassemblyItem {
  return {
    ...createSkipItem(SCREEN_AREA_RANGE.start, SCREEN_AREA_RANGE.end, decimalView, addressOffset),
    hardComment: "Screen memory, not disassembled"
  };
}

export type AnnotatedNexDisassemblyOptions = {
  annotations: NexFileAnnotations;
  bank: number;
  contents: Uint8Array;
  decimalView?: boolean;
  disassOffset?: number;
  /**
   * Where the program counter is in this bank, when the machine is paused and it is in this bank.
   *
   * Only `disassemble` regions are cut at it: a region the user has declared to be `bytes`, `words`
   * or `skip` is a statement about what those bytes *are*, and the program counter passing through
   * it does not turn it into code.
   */
  pcBankOffset?: number;
  /**
   * Names for operands the annotations themselves cannot name — in practice, the machine's system
   * variables.
   *
   * Consulted only after the annotation lookup declines, so a hand-authored label always wins: the
   * user's label is a statement about this program, a system variable name only a fact about the
   * machine.
   */
  fallbackOperandLabelResolver?: DisassemblyOperandLabelResolver;
  /**
   * Collapse `$4000-$5AFF` into one line instead of disassembling it.
   *
   * The caller decides whether this bank is listed where that range *is* the screen
   * (`screenAreaApplies`); this only applies it. Overrides the authored regions for this listing
   * alone — the sidecar is untouched.
   */
  hideScreenArea?: boolean;
};

export async function createAnnotatedNexDisassemblyItems({
  annotations,
  bank,
  contents,
  decimalView = false,
  disassOffset,
  pcBankOffset,
  fallbackOperandLabelResolver,
  hideScreenArea = false
}: AnnotatedNexDisassemblyOptions): Promise<DisassemblyItem[] | undefined> {
  const bankAnnotation = getBankAnnotation(annotations, bank);
  if (!bankAnnotation) {
    return undefined;
  }

  const addressOffset = disassOffset ?? getNexBankAddressOffset(bankAnnotation.offsetIndex);
  const items: DisassemblyItem[] = [];

  const regions = hideScreenArea
    ? overlayRegion(bankAnnotation.regions, { ...SCREEN_AREA_RANGE, type: "skip" })
    : bankAnnotation.regions;

  const labelOffsets = getLabelBankOffsets(annotations, bankAnnotation, addressOffset);

  for (const region of regions) {
    const start = clampBankOffset(region.start, contents.length);
    const end = clampBankOffset(region.end, contents.length);
    if (start > end) {
      continue;
    }

    switch (region.type) {
      case "disassemble":
        // --- Cut at the program counter so the rows from it on are the instructions that will
        // --- actually run, rather than a decode that slipped a byte somewhere above.
        for (const [runStart, runEnd] of pcAnchoredRuns(start, end, pcBankOffset)) {
          items.push(
            ...(await createInstructionItems(
              annotations,
              bankAnnotation,
              bank,
              contents,
              runStart,
              runEnd,
              decimalView,
              addressOffset,
              fallbackOperandLabelResolver
            ))
          );
        }
        break;

      case "bytes":
        items.push(
          ...createByteItems(
            contents,
            start,
            end,
            decimalView,
            addressOffset,
            labelOffsets,
            region.rowBytes
          )
        );
        break;

      case "words":
        items.push(
          ...createWordItems(contents, start, end, decimalView, addressOffset, labelOffsets)
        );
        break;

      case "skip":
        // --- The screen overlay is the one skip that explains itself; an authored skip does not.
        items.push(
          hideScreenArea && start === SCREEN_AREA_RANGE.start && end === SCREEN_AREA_RANGE.end
            ? createScreenSkipItem(decimalView, addressOffset)
            : createSkipItem(start, end, decimalView, addressOffset)
        );
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
  addressOffset: number,
  fallbackOperandLabelResolver?: DisassemblyOperandLabelResolver
): Promise<DisassemblyItem[]> {
  const disassembler = new Z80Disassembler(
    [new MemorySection(start, end, MemorySectionType.Disassemble)],
    contents,
    undefined,
    {
      allowExtendedSet: true,
      decimalMode: decimalView,
      operandLabelResolver: chainOperandLabelResolvers(
        createAnnotationOperandLabelResolver(annotations, bankAnnotation, bank, addressOffset),
        fallbackOperandLabelResolver
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
  // --- Kept for call-site symmetry with the other per-bank helpers; the resolver works purely in
  // --- bank-relative offsets, so it never needs the bank number itself.
  _bank: number,
  addressOffset: number
): DisassemblyOperandLabelResolver {
  /*
   * Delegated to `resolveOperandLabel` rather than implemented here.
   *
   * "Go to definition" has to reach the same label this prints, and the only way to guarantee that
   * is for both to run the same rule. Two implementations of "explicit reference first, then value
   * match" would agree until the day one of them was edited.
   */
  return ({ instructionOffset, operandIndex, operandValue }) =>
    resolveOperandLabel(
      annotations,
      bankAnnotation,
      {
        bankOffset: instructionOffset & NEX_BANK_LAST_OFFSET,
        operandIndex,
        operandValue
      },
      addressOffset
    )?.name;
}




/** Most values a `.defb` / `.defw` row shows before starting a new row. */
const DATA_ROW_BYTES = NEX_MAX_ROW_BYTES;

/**
 * The bank offsets that carry a label, global or local, in the bank being listed.
 *
 * A data row's label is looked up by the offset the row *starts* at, so a label on any other byte
 * of a row would be silently hidden. Data rows are cut at these offsets instead — see
 * `dataRowLength` — which is what lets a label sit on a parameter in the middle of a table.
 */
function getLabelBankOffsets(
  annotations: NexFileAnnotations,
  bankAnnotation: NexBankAnnotation,
  addressOffset: number
): number[] {
  const offsets = new Set<number>();
  for (const label of annotations.globalLabels ?? []) {
    const bankOffset = label.value - addressOffset;
    if (bankOffset >= 0 && bankOffset <= NEX_BANK_LAST_OFFSET) {
      offsets.add(bankOffset);
    }
  }
  for (const label of bankAnnotation.localLabels ?? []) {
    offsets.add(label.value);
  }
  return [...offsets].sort((a, b) => a - b);
}

/**
 * How many bytes the data row starting at `offset` takes: up to `rowBytes`, stopping short of the
 * region end and of the next label, so the label starts a row of its own.
 *
 * `step` is the unit a row may not be split inside. A word row only stops at a label on a word
 * boundary of its region; a label on the high byte of a word cannot start a row without splitting
 * that word, so it stays inside the row. A `bytes` region with an explicit `rowBytes` is the same:
 * its rows are records (a copper instruction, say), so a label naming a byte *inside* a record — the
 * operand code patches — keeps the record whole. The label still names that address in operands.
 */
function dataRowLength(
  offset: number,
  regionStart: number,
  end: number,
  step: number,
  labelOffsets: number[],
  rowBytes = DATA_ROW_BYTES
): number {
  let length = Math.min(rowBytes, end - offset + 1);
  for (const labelOffset of labelOffsets) {
    if (labelOffset <= offset) continue;
    if (labelOffset >= offset + length) break;
    if ((labelOffset - regionStart) % step === 0) {
      length = labelOffset - offset;
      break;
    }
  }
  return length;
}

function createByteItems(
  contents: Uint8Array,
  start: number,
  end: number,
  decimalView: boolean,
  addressOffset: number,
  labelOffsets: number[] = [],
  rowBytes?: number
): DisassemblyItem[] {
  const items: DisassemblyItem[] = [];
  // --- An explicit row size makes each row a record that a label cannot split; the default keeps
  // --- the long-standing behaviour of starting a row at any labelled byte.
  const step = rowBytes ?? 1;
  for (let offset = start, rowLength = 0; offset <= end; offset += rowLength) {
    rowLength = dataRowLength(offset, start, end, step, labelOffsets, rowBytes ?? DATA_ROW_BYTES);
    const values: string[] = [];
    for (let idx = 0; idx < rowLength; idx++) {
      const value = contents[offset + idx];
      values.push(decimalView ? toDecimal3(value) : `$${toHexa2(value)}`);
    }
    items.push({
      address: effectiveAddress(offset, addressOffset),
      instruction: `.defb ${values.join(", ")}`,
      annotation: createAnnotationMetadata(
        undefined,
        offset,
        rowLength,
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
  addressOffset: number,
  labelOffsets: number[] = []
): DisassemblyItem[] {
  const items: DisassemblyItem[] = [];
  for (let offset = start, rowLength = 0; offset <= end; offset += rowLength) {
    rowLength = dataRowLength(offset, start, end, 2, labelOffsets);
    const values: string[] = [];
    for (let idx = 0; idx + 1 < rowLength; idx += 2) {
      const value = contents[offset + idx] | (contents[offset + idx + 1] << 8);
      values.push(decimalView ? value.toString(10) : `$${toHexa4(value)}`);
    }
    items.push({
      address: effectiveAddress(offset, addressOffset),
      instruction: `.defw ${values.join(", ")}`,
      annotation: createAnnotationMetadata(
        undefined,
        offset,
        rowLength,
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
      const commentLines = lineAnnotation.synopsis.split(/\r?\n/);
      commentLines.forEach((commentLine, lineIndex) => {
        decorated.push({
          address: item.address,
          isPrefixItem: true,
          prefixComment: commentLine,
          annotation: {
            ...createAnnotationMetadata(bank, bankOffset, rowByteLength, rowRegionType, true),
            synopsisEdge: synopsisEdgeAt(lineIndex, commentLines.length)
          }
        });
      });
    }

    const labels = getLabelsForOffset(annotations, bankAnnotation, bank, bankOffset, addressOffset);
    if (labels.length > 0) {
      item.hasLabel = true;
      item.formattedLabel = labels[0].name;
    }

    /*
     * A user's end-of-line comment *replaces* the disassembler's own, rather than joining it.
     *
     * Both want the same place — the one column at the right of the row — and the generated note is
     * the weaker claim of the two: `; Palette Control` says what the *opcode* does, which the reader
     * of an annotated listing already knows by the time they have written a note about what this
     * particular instruction is doing in this particular program. Joining them produced
     * `; Palette Control | set the border to black`, which buries the sentence worth reading behind
     * the one that is not, on exactly the rows the reader cared enough to annotate.
     *
     * The generated text is not lost: it is kept in `generatedHardComment` below, and the end-of-line
     * dialog shows it in its own row so what is being replaced stays visible while you type. Clearing
     * the user comment brings it back to the listing.
     */
    if (lineAnnotation?.comment) {
      item.hardComment = lineAnnotation.comment;
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

/**
 * Which edge of its synopsis block a line sits on.
 *
 * The view sets the block off from the code with space above the first line and below the last —
 * see `synopsisBlockFirst` / `synopsisBlockLast` in `DisassemblyPanel.module.scss`. Interior lines
 * get neither, so a multi-line note still reads as one paragraph.
 */
function synopsisEdgeAt(
  lineIndex: number,
  lineCount: number
): DisassemblyAnnotationMetadata["synopsisEdge"] {
  if (lineCount === 1) return "only";
  if (lineIndex === 0) return "first";
  return lineIndex === lineCount - 1 ? "last" : "middle";
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
