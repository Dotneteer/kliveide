import type { DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";
import { resolveOperandLabel, type DefinitionLabel } from "./goToDefinition";
import {
  ANNOTATION_BANK_LAST_OFFSET,
  getBankAnnotation,
  type ProgramAnnotations
} from "./programAnnotations";

/*
 * "Go to References": the rows of a listing whose operands name a label.
 *
 * A reference is found the way the listing *printed* it — every operand is resolved with
 * `resolveOperandLabel`, the rule the listing and "Go to definition" share (an explicit operand
 * reference first, then a label with the operand's value). So the list holds exactly the rows on
 * which the reader sees the name, `.defw` words included, and never a row that merely holds the
 * same number under another name.
 *
 * Only the listing given is searched: a bank or ROM page. A global label can be named from other
 * banks too; those are not in this listing and are not found.
 *
 * Kept pure and free of React, like `goToDefinition.ts`, so the rules are asserted without a view.
 */

/** A label a row offers "Go to References" for: its own, or one an operand names. */
export type ReferenceSubject = {
  label: DefinitionLabel;
  /** Where on the row the name is: the row's label, or the operand at this index. */
  source: "row" | { operandIndex: number };
};

/** One row that names the label. */
export type LabelReference = {
  /** The row's index in the listing. */
  rowIndex: number;
  /** The row's address, as listed. */
  address: number;
  /** The row's instruction or directive, as listed. */
  instruction: string;
  /** The nearest label at or above the row in the listing: the routine or table it sits in. */
  within?: string;
};

/**
 * The labels a row can be asked about, in menu order: the row's own label first, then each label
 * its operands name, each label once.
 *
 * Only annotation labels: a build symbol or a system variable printed on the row is not a label of
 * these annotations, so there is nothing here to search for.
 */
export function referenceSubjectsOf(
  annotations: ProgramAnnotations | undefined,
  bank: number,
  item: DisassemblyItem | undefined,
  addressOffset: number
): ReferenceSubject[] {
  if (!annotations || !item || item.isPrefixItem) return [];
  const bankAnnotation = getBankAnnotation(annotations, bank);
  const bankOffset = item.annotation?.bankOffset;
  if (!bankAnnotation || bankOffset === undefined) return [];

  const subjects: ReferenceSubject[] = [];
  const seen = new Set<string>();
  const add = (label: DefinitionLabel, source: ReferenceSubject["source"]) => {
    const key = labelKey(label);
    if (seen.has(key)) return;
    seen.add(key);
    subjects.push({ label, source });
  };

  const local = bankAnnotation.localLabels?.find((label) => label.value === bankOffset);
  if (local) add({ name: local.name, scope: "local", value: local.value }, "row");
  const address = (addressOffset + bankOffset) & 0xffff;
  const global = annotations.globalLabels?.find((label) => label.value === address);
  if (global) add({ name: global.name, scope: "global", value: global.value }, "row");

  for (const operand of item.operandCandidates ?? []) {
    if (!operand.resolvedText) continue;
    const label = resolveOperandLabel(
      annotations,
      bankAnnotation,
      { bankOffset: bankOffset & ANNOTATION_BANK_LAST_OFFSET, operandIndex: operand.operandIndex, operandValue: operand.operandValue },
      addressOffset
    );
    if (label) add(label, { operandIndex: operand.operandIndex });
  }
  return subjects;
}

/**
 * Every row of `items` with an operand that resolves to `label`, in listing order, one entry per
 * row however many of its operands name it.
 */
export function findLabelReferences(
  annotations: ProgramAnnotations | undefined,
  bank: number,
  items: readonly DisassemblyItem[],
  label: DefinitionLabel,
  addressOffset: number
): LabelReference[] {
  const wanted = labelKey(label);
  const references: LabelReference[] = [];
  let within: string | undefined;
  forEachNamingRow(annotations, bank, items, addressOffset, (item, rowIndex, names) => {
    if (item.formattedLabel) within = item.formattedLabel;
    if (names.has(wanted)) {
      references.push({ rowIndex, address: item.address, instruction: item.instruction ?? "", within });
    }
  });
  return references;
}

/**
 * How many rows of `items` name each label, keyed by `labelKey`: what `findLabelReferences` would
 * list for every label at once, in one pass over the listing (a ROM page has hundreds of labels).
 */
export function countLabelReferencesInListing(
  annotations: ProgramAnnotations | undefined,
  bank: number,
  items: readonly DisassemblyItem[],
  addressOffset: number
): Map<string, number> {
  const counts = new Map<string, number>();
  forEachNamingRow(annotations, bank, items, addressOffset, (_item, _rowIndex, names) => {
    for (const key of names) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

/** The key `countLabelReferencesInListing` counts a label under: its scope and name. */
export function labelKey(label: Pick<DefinitionLabel, "name" | "scope">): string {
  return `${label.scope}:${label.name}`;
}

/**
 * Every listed row, with the set of labels its operands name (keyed by `labelKey`, empty for most
 * rows) — resolved with `resolveOperandLabel`, the rule the listing printed the names by.
 */
function forEachNamingRow(
  annotations: ProgramAnnotations | undefined,
  bank: number,
  items: readonly DisassemblyItem[],
  addressOffset: number,
  visit: (item: DisassemblyItem, rowIndex: number, names: Set<string>) => void
): void {
  if (!annotations) return;
  const bankAnnotation = getBankAnnotation(annotations, bank);
  if (!bankAnnotation) return;
  items.forEach((item, rowIndex) => {
    if (item.isPrefixItem) return;
    const names = new Set<string>();
    const bankOffset = item.annotation?.bankOffset;
    if (bankOffset !== undefined) {
      for (const operand of item.operandCandidates ?? []) {
        if (!operand.resolvedText) continue;
        const resolved = resolveOperandLabel(
          annotations,
          bankAnnotation,
          { bankOffset: bankOffset & ANNOTATION_BANK_LAST_OFFSET, operandIndex: operand.operandIndex, operandValue: operand.operandValue },
          addressOffset
        );
        if (resolved) names.add(labelKey(resolved));
      }
    }
    visit(item, rowIndex, names);
  });
}
