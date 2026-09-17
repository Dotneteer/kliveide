import type { DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";

import {
  NEX_BANK_LAST_OFFSET,
  getBankAnnotation,
  type NexAnnotationLabelScope,
  type NexBankAnnotation,
  type NexFileAnnotations
} from "./nexAnnotations";

/*
 * Where the label on an instruction line is defined, and whether we can go there.
 *
 * `LD HL,SomeLabel` shows a name because a resolver put one there; this works out which label that
 * was and where it lives, so the listing can jump to its definition.
 *
 * Kept pure and free of React so the whole decision — is there a label, is it in this bank, is the
 * jump possible at all — is assertable without a machine, a document hub or a DOM.
 */

/** A label an operand resolves to. `value` is an absolute address for a global, a bank offset for a local. */
export type NexDefinitionLabel = {
  name: string;
  scope: NexAnnotationLabelScope;
  value: number;
};

/**
 * Which operand of a row carries a label, resolved exactly as the listing resolved it.
 *
 * **Explicit reference first, then value match** — the same precedence
 * `createAnnotationOperandLabelResolver` uses, because it calls this. Sharing the rule is the point:
 * a menu that sent you to a different label than the one printed on the line would be worse than no
 * menu at all.
 *
 * `undefined` when the operand names no label, which includes an explicit reference pointing at a
 * label that has since been deleted or moved off this operand's value.
 */
export function resolveOperandLabel(
  annotations: NexFileAnnotations,
  bankAnnotation: NexBankAnnotation,
  operand: { bankOffset: number; operandIndex: number; operandValue: number },
  addressOffset: number
): NexDefinitionLabel | undefined {
  const explicit = bankAnnotation.operandReferences?.[String(operand.bankOffset)]?.find(
    (reference) => reference.operandIndex === operand.operandIndex
  );

  if (explicit) {
    const label =
      explicit.scope === "global"
        ? annotations.globalLabels?.find((item) => item.name === explicit.name)
        : bankAnnotation.localLabels?.find((item) => item.name === explicit.name);
    if (!label) return undefined;
    return matchesOperand(label.value, explicit.scope, operand.operandValue, addressOffset)
      ? { name: label.name, scope: explicit.scope, value: label.value }
      : undefined;
  }

  const global = annotations.globalLabels?.find((item) => item.value === operand.operandValue);
  if (global) return { name: global.name, scope: "global", value: global.value };

  const bankRelative = operand.operandValue - addressOffset;
  if (bankRelative < 0 || bankRelative > NEX_BANK_LAST_OFFSET) return undefined;
  const local = bankAnnotation.localLabels?.find((item) => item.value === bankRelative);
  return local ? { name: local.name, scope: "local", value: local.value } : undefined;
}

function matchesOperand(
  labelValue: number,
  scope: NexAnnotationLabelScope,
  operandValue: number,
  addressOffset: number
): boolean {
  if (scope === "global") return labelValue === operandValue;
  const bankRelative = operandValue - addressOffset;
  return bankRelative >= 0 && bankRelative <= NEX_BANK_LAST_OFFSET
    ? labelValue === bankRelative
    : false;
}

/**
 * Where "Go to definition" would take you from a row.
 *
 * Three answers, and the middle one is why this is a union rather than an address:
 *
 * - `none` — the row names no label, so the command has nothing to do.
 * - `same-bank` — the definition is inside the bank already on screen. Scrolling this document is
 *   the whole job, and it works with no machine at all.
 * - `other-bank` — the definition is at an address outside this bank's window. Which bank holds it
 *   depends on how the program has paged memory, which only a *running* machine can answer, so the
 *   command offers itself only when there is one.
 *
 * A **local** label can never be `other-bank`: the resolver only ever matches locals of the bank
 * being listed, so its value is a bank offset in this very bank.
 */
export type NexGoToDefinitionTarget =
  | { kind: "none" }
  | { kind: "same-bank"; label: NexDefinitionLabel; address: number }
  | { kind: "other-bank"; label: NexDefinitionLabel; address: number };

/**
 * Work out the jump for a row of the listing.
 *
 * Only operands the listing actually *printed* a name for are considered — `resolvedText` is how a
 * resolved operand is distinguishable afterwards, the instruction text having been flattened to a
 * string. Re-resolving from the value alone would offer a jump on a line showing a bare number.
 */
export function goToDefinitionTarget(args: {
  annotations?: NexFileAnnotations;
  bank?: number;
  item?: DisassemblyItem;
  /** Where this bank's byte 0 is listed at — the offset dropdown's value. */
  addressOffset: number;
}): NexGoToDefinitionTarget {
  const { annotations, bank, item, addressOffset } = args;
  if (!annotations || bank === undefined || !item || item.isPrefixItem) return { kind: "none" };

  const bankAnnotation = getBankAnnotation(annotations, bank);
  if (!bankAnnotation) return { kind: "none" };

  const bankOffset = item.annotation?.bankOffset;
  if (bankOffset === undefined) return { kind: "none" };

  for (const operand of item.operandCandidates ?? []) {
    // --- Only an operand the listing put a name on. A bare number is not a definition to visit.
    if (!operand.resolvedText) continue;

    const label = resolveOperandLabel(
      annotations,
      bankAnnotation,
      { bankOffset, operandIndex: operand.operandIndex, operandValue: operand.operandValue },
      addressOffset
    );
    if (!label) continue;

    const address =
      label.scope === "local" ? addressOffset + label.value : label.value;
    const inThisBank =
      address >= addressOffset && address <= addressOffset + NEX_BANK_LAST_OFFSET;
    return inThisBank
      ? { kind: "same-bank", label, address }
      : { kind: "other-bank", label, address };
  }

  return { kind: "none" };
}
