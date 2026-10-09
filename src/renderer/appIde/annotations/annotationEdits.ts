import type {
  AnnotationBankView,
  AnnotationLabel,
  AnnotationLabelScope,
  AnnotationOffsetIndex,
  AnnotationRegion,
  AnnotationRegionType,
  BankAnnotation,
  BankSprites,
  ProgramAnnotations,
  LineAnnotation
} from "./programAnnotations";

import { getBankAnnotation, normalizeMultilineComment, sameRegionLayout } from "./programAnnotations";

/*
 * The pure edits behind the NEX annotation UI: label bookkeeping, region algebra, and the operand
 * references that have to follow a deleted label.
 *
 * These accumulated inside `StaticMemoryDump.tsx` — a 2168-line memory-dump component — where they
 * could only be reached by mounting React and driving the DOM, even though not one of them touches
 * it. They are moved here unchanged, beside the annotation model they operate on, so the rules can
 * be tested directly and so the dump component can stop owning them.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §9 (step 4a).
 */

export function countLabelReferences(
  annotations: ProgramAnnotations,
  bank: number,
  scope: AnnotationLabelScope,
  name: string
): number {
  const banks = scope === "global"
    ? Object.values(annotations.banks)
    : [getBankAnnotation(annotations, bank)].filter(
        (bankAnnotation): bankAnnotation is BankAnnotation => !!bankAnnotation
      );

  return banks.reduce((count, bankAnnotation) => {
    const references = Object.values(bankAnnotation.operandReferences ?? {}).flat();
    return count + references.filter((reference) =>
      reference.scope === scope && reference.name === name
    ).length;
  }, 0);
}

export function removeLabel(
  labels: AnnotationLabel[],
  labelToRemove: AnnotationLabel
): AnnotationLabel[] {
  return labels.filter((label) =>
    label.name !== labelToRemove.name || label.value !== labelToRemove.value
  );
}

export function addLabelIfMissing(
  labels: AnnotationLabel[],
  labelToAdd: AnnotationLabel
): AnnotationLabel[] {
  return labels.some((label) => label.name === labelToAdd.name)
    ? labels
    : [...labels, labelToAdd];
}

export function replaceAnnotationRegion(
  regions: AnnotationRegion[],
  start: number,
  end: number,
  type: AnnotationRegionType
): AnnotationRegion[] {
  const nextRegions: AnnotationRegion[] = [];
  for (const region of regions) {
    if (region.end < start || region.start > end) {
      nextRegions.push({ ...region });
      continue;
    }
    // --- The parts left either side keep everything about the region, its row size included.
    if (region.start < start) {
      nextRegions.push({ ...region, end: start - 1 });
    }
    if (region.end > end) {
      nextRegions.push({ ...region, start: end + 1 });
    }
  }
  nextRegions.push({ start, end, type });
  return mergeAnnotationRegions(nextRegions);
}

export function getRegionTypeForSpan(
  regions: AnnotationRegion[],
  start: number,
  end: number
): AnnotationRegionType {
  const intersectingRegions = regions.filter((region) => region.start <= end && region.end >= start);
  const firstRegion = intersectingRegions[0];
  return intersectingRegions.length > 0 &&
    intersectingRegions.every((region) => region.type === firstRegion.type)
    ? firstRegion.type
    : "disassemble";
}

export function getAlternativeRegionType(type: AnnotationRegionType): AnnotationRegionType {
  return type === "disassemble" ? "bytes" : "disassemble";
}

export function mergeAnnotationRegions(regions: AnnotationRegion[]): AnnotationRegion[] {
  const sortedRegions = [...regions].sort((left, right) =>
    left.start - right.start || left.end - right.end
  );
  const mergedRegions: AnnotationRegion[] = [];
  for (const region of sortedRegions) {
    const previousRegion = mergedRegions[mergedRegions.length - 1];
    if (
      previousRegion &&
      sameRegionLayout(previousRegion, region) &&
      previousRegion.end + 1 >= region.start
    ) {
      previousRegion.end = Math.max(previousRegion.end, region.end);
    } else {
      mergedRegions.push({ ...region });
    }
  }
  return mergedRegions;
}

export function removeLabelOperandReferencesFromBanks(
  banks: Record<string, BankAnnotation>,
  bank: number,
  scope: AnnotationLabelScope,
  name: string
): Record<string, BankAnnotation> {
  const nextBanks: Record<string, BankAnnotation> = {};
  for (const [bankKey, bankAnnotation] of Object.entries(banks)) {
    if (scope === "local" && bankKey !== String(bank)) {
      nextBanks[bankKey] = bankAnnotation;
      continue;
    }
    nextBanks[bankKey] = removeLabelOperandReferences(bankAnnotation, scope, name);
  }
  return nextBanks;
}

export function removeLabelOperandReferences(
  bankAnnotation: BankAnnotation,
  scope: AnnotationLabelScope,
  name: string
): BankAnnotation {
  if (!bankAnnotation.operandReferences) {
    return bankAnnotation;
  }

  const nextOperandReferences: BankAnnotation["operandReferences"] = {};
  for (const [offset, references] of Object.entries(bankAnnotation.operandReferences)) {
    const remainingReferences = references.filter((reference) =>
      reference.scope !== scope || reference.name !== name
    );
    if (remainingReferences.length > 0) {
      nextOperandReferences[offset] = remainingReferences;
    }
  }

  const nextBankAnnotation = {
    ...bankAnnotation
  };
  if (Object.keys(nextOperandReferences).length > 0) {
    nextBankAnnotation.operandReferences = nextOperandReferences;
  } else {
    delete nextBankAnnotation.operandReferences;
  }
  return nextBankAnnotation;
}

// ─── Whole-model transforms ──────────────────────────────────────────────────
/*
 * Each returns the edited model, or `undefined` for "nothing changed — do not publish".
 *
 * Publishing an unchanged model would mark the sidecar dirty for an edit that did nothing, so the
 * distinction is behaviour, not an optimisation. These were inlined in the component's callbacks,
 * where each mixed the transformation with reading a ref and publishing a session update; the pure
 * half is here so its rules can be tested directly.
 */

/** Replace one bank's annotation, leaving the rest of the model alone. */
function withBank(
  annotations: ProgramAnnotations,
  bank: number,
  next: BankAnnotation
): ProgramAnnotations {
  return { ...annotations, banks: { ...annotations.banks, [String(bank)]: next } };
}

/**
 * Put `globalLabels` back on the model, or take the key away.
 *
 * The key survives an emptied list when it was already present, so a file that had global labels
 * keeps an explicit empty array rather than silently losing the field.
 */
function withGlobalLabels(
  annotations: ProgramAnnotations,
  banks: Record<string, BankAnnotation>,
  nextGlobalLabels: AnnotationLabel[]
): ProgramAnnotations {
  const updated: ProgramAnnotations = { ...annotations, banks };
  if (nextGlobalLabels.length > 0 || annotations.globalLabels) {
    updated.globalLabels = nextGlobalLabels;
  } else {
    delete updated.globalLabels;
  }
  return updated;
}

/** The per-bank display settings the sidecar remembers. */
export function withBankSettings(
  annotations: ProgramAnnotations,
  bank: number,
  patch: {
    lastView?: AnnotationBankView;
    decimalView?: boolean;
    offsetIndex?: AnnotationOffsetIndex;
  }
): ProgramAnnotations | undefined {
  const bankAnnotation = getBankAnnotation(annotations, bank);
  if (!bankAnnotation) return undefined;

  const next = { ...bankAnnotation };
  let changed = false;
  if (patch.lastView !== undefined && next.lastView !== patch.lastView) {
    next.lastView = patch.lastView;
    changed = true;
  }
  if (patch.decimalView !== undefined && next.decimalView !== patch.decimalView) {
    next.decimalView = patch.decimalView;
    changed = true;
  }
  if (patch.offsetIndex !== undefined && next.offsetIndex !== patch.offsetIndex) {
    next.offsetIndex = patch.offsetIndex;
    changed = true;
  }
  return changed ? withBank(annotations, bank, next) : undefined;
}

/**
 * Edit the line annotation at one bank offset.
 *
 * An annotation left with neither a synopsis nor a comment is removed rather than stored empty, and
 * an emptied map takes its key with it — otherwise the sidecar would accumulate `{}` entries for
 * every comment a user ever typed and then deleted.
 */
export function withLineAnnotation(
  annotations: ProgramAnnotations,
  bank: number,
  bankOffset: number,
  update: (current: LineAnnotation) => LineAnnotation
): ProgramAnnotations | undefined {
  const bankAnnotation = getBankAnnotation(annotations, bank);
  if (!bankAnnotation) return undefined;

  const offsetKey = String(bankOffset);
  const currentLines = bankAnnotation.lineAnnotations ?? {};
  const nextLine = update({ ...(currentLines[offsetKey] ?? {}) });

  const nextLines = { ...currentLines };
  if (nextLine.synopsis || nextLine.comment) {
    nextLines[offsetKey] = nextLine;
  } else {
    delete nextLines[offsetKey];
  }

  const next: BankAnnotation = { ...bankAnnotation };
  if (Object.keys(nextLines).length > 0) {
    next.lineAnnotations = nextLines;
  } else {
    delete next.lineAnnotations;
  }
  return withBank(annotations, bank, next);
}

/** Set or clear a row's synopsis comment — the multi-line note rendered above it. */
export function withSynopsisComment(
  annotations: ProgramAnnotations,
  bank: number,
  bankOffset: number,
  synopsis?: string
): ProgramAnnotations | undefined {
  return withLineAnnotation(annotations, bank, bankOffset, (current) => {
    const next: LineAnnotation = { ...current };
    if (synopsis) {
      next.synopsis = synopsis;
    } else {
      delete next.synopsis;
    }
    return next;
  });
}

/**
 * Set or clear the comment on a whole bank.
 *
 * The text is normalized here as well as in the dialog, so a caller that is not the dialog — a test,
 * a future command — cannot store a form the dialog would not have written. `undefined` when the
 * bank is not in the model or the comment would not change, so nothing is published for a no-op.
 */
export function withBankComment(
  annotations: ProgramAnnotations,
  bank: number,
  comment?: string
): ProgramAnnotations | undefined {
  const bankAnnotation = getBankAnnotation(annotations, bank);
  if (!bankAnnotation) return undefined;

  const normalized = comment === undefined ? undefined : normalizeMultilineComment(comment);
  if (bankAnnotation.comment === normalized) return undefined;

  const next: BankAnnotation = { ...bankAnnotation };
  if (normalized) {
    next.comment = normalized;
  } else {
    delete next.comment;
  }
  return withBank(annotations, bank, next);
}

/** A bank's sprite settings with every default filled in. */
export type ResolvedBankSprites = {
  format: "8bit" | "4bit";
  offset: number;
  /** Whether the Sprites view is the one a reopened bank shows. */
  active: boolean;
};

export function resolveBankSprites(sprites: BankSprites | undefined): ResolvedBankSprites {
  return {
    format: sprites?.format ?? "8bit",
    offset: sprites?.offset ?? 0,
    active: sprites?.active ?? false
  };
}

/**
 * Change how the Sprites view reads a bank — its pattern format, where pattern #0 starts — or whether
 * it is the view the bank reopens in.
 *
 * Defaults are normalized away — `8bit` and offset `0` are not stored, and a block left with nothing
 * in it is removed — so a bank someone only ever looked at leaves no trace in the sidecar. An offset
 * outside the bank is clamped. `undefined` when the bank is not in the model or nothing changes.
 */
export function withBankSprites(
  annotations: ProgramAnnotations,
  bank: number,
  patch: Partial<ResolvedBankSprites>
): ProgramAnnotations | undefined {
  const bankAnnotation = getBankAnnotation(annotations, bank);
  if (!bankAnnotation) return undefined;

  const current = resolveBankSprites(bankAnnotation.sprites);
  const format = patch.format ?? current.format;
  const offset = Math.max(0, Math.min(0x3fff, Math.floor(patch.offset ?? current.offset)));
  const active = patch.active ?? current.active;
  if (format === current.format && offset === current.offset && active === current.active) {
    return undefined;
  }

  const nextSprites: BankSprites = {};
  if (format !== "8bit") nextSprites.format = format;
  if (offset !== 0) nextSprites.offset = offset;
  if (active) nextSprites.active = true;

  const next: BankAnnotation = { ...bankAnnotation };
  if (Object.keys(nextSprites).length > 0) {
    next.sprites = nextSprites;
  } else {
    delete next.sprites;
  }
  return withBank(annotations, bank, next);
}

/** What separates the lines of a bank comment when it is flattened onto one heading line. */
export const BANK_COMMENT_LINE_SEPARATOR = " \u00b7 ";

/**
 * A bank comment as one line, for a heading.
 *
 * Blank lines are dropped and each line's surrounding whitespace collapsed; the lines that remain
 * are joined with ` · ` so the breaks stay legible. Truncation is *not* done here: the heading
 * truncates with CSS, so "as much as fits" follows the panel's width and font size rather than a
 * character count decided in advance.
 */
export function flattenBankComment(comment: string | undefined): string {
  return splitBankCommentLines(comment).join(BANK_COMMENT_LINE_SEPARATOR);
}

/** The non-blank lines of a bank comment, each with its whitespace collapsed. */
export function splitBankCommentLines(comment: string | undefined): string[] {
  if (!comment) return [];
  return comment
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);
}

/** Set or clear a row's end-of-line comment. */
export function withEndOfLineComment(
  annotations: ProgramAnnotations,
  bank: number,
  bankOffset: number,
  comment?: string
): ProgramAnnotations | undefined {
  return withLineAnnotation(annotations, bank, bankOffset, (current) => {
    const next: LineAnnotation = { ...current };
    if (comment) {
      next.comment = comment;
    } else {
      delete next.comment;
    }
    return next;
  });
}

/** Retype a span of the bank as disassembly, bytes, words, Copper, DMA or skip. */
export function withRegion(
  annotations: ProgramAnnotations,
  bank: number,
  start: number,
  end: number,
  type: AnnotationRegionType
): ProgramAnnotations | undefined {
  const bankAnnotation = getBankAnnotation(annotations, bank);
  if (!bankAnnotation) return undefined;
  // --- A Copper list is whole 2-byte words. The region dialog refuses an odd span; this refuses
  // --- one that arrives without it (a span gesture), rather than writing it.
  if (type === "copper" && (end - start + 1) % 2 !== 0) return undefined;
  return withBank(annotations, bank, {
    ...bankAnnotation,
    regions: replaceAnnotationRegion(bankAnnotation.regions, start, end, type)
  });
}

/**
 * Clear every annotation covering a span: its line annotations, and any non-disassembly region.
 *
 * The region reset is the part that is easy to miss — a row marked as `bytes` is still annotated
 * even once its comment is gone, so "clear" has to put the span back to disassembly too. Returns
 * `undefined` only when there was nothing of either kind to clear.
 */
export function withClearedRowAnnotations(
  annotations: ProgramAnnotations,
  bank: number,
  start: number,
  end: number
): ProgramAnnotations | undefined {
  const bankAnnotation = getBankAnnotation(annotations, bank);
  if (!bankAnnotation) return undefined;

  const nextLines = { ...(bankAnnotation.lineAnnotations ?? {}) };
  let clearedALine = false;
  for (const offsetKey of Object.keys(nextLines)) {
    const offset = Number(offsetKey);
    if (Number.isInteger(offset) && offset >= start && offset <= end) {
      delete nextLines[offsetKey];
      clearedALine = true;
    }
  }

  const resetRegion = bankAnnotation.regions.some(
    (region) => region.type !== "disassemble" && region.start <= end && region.end >= start
  );
  if (!clearedALine && !resetRegion) return undefined;

  const next: BankAnnotation = {
    ...bankAnnotation,
    regions: resetRegion
      ? replaceAnnotationRegion(bankAnnotation.regions, start, end, "disassemble")
      : bankAnnotation.regions
  };
  if (clearedALine) {
    if (Object.keys(nextLines).length > 0) {
      next.lineAnnotations = nextLines;
    } else {
      delete next.lineAnnotations;
    }
  }
  return withBank(annotations, bank, next);
}

/** A label save or delete, as the label dialog reports it. */
export type LabelChange = {
  action: "save" | "delete";
  scope: AnnotationLabelScope;
  name: string;
  value: number;
  /** The label being replaced or removed, when the dialog was opened on an existing one. */
  originalLabel?: AnnotationLabel & { scope: AnnotationLabelScope };
};

/**
 * Apply a label save or delete.
 *
 * A delete also clears every operand reference to the name, because a reference to a label that no
 * longer exists would render as a dangling name. The caller is responsible for confirming the
 * delete first — that decision is asynchronous and belongs with the ports.
 */
export function withLabelChange(
  annotations: ProgramAnnotations,
  bank: number,
  change: LabelChange
): ProgramAnnotations | undefined {
  const bankAnnotation = getBankAnnotation(annotations, bank);
  if (!bankAnnotation) return undefined;
  // --- Nothing identifies what to remove.
  if (change.action === "delete" && !change.originalLabel) return undefined;

  let nextGlobalLabels = [...(annotations.globalLabels ?? [])];
  const next: BankAnnotation = {
    ...bankAnnotation,
    localLabels: [...(bankAnnotation.localLabels ?? [])]
  };

  if (change.originalLabel) {
    if (change.originalLabel.scope === "global") {
      nextGlobalLabels = removeLabel(nextGlobalLabels, change.originalLabel);
    } else {
      next.localLabels = removeLabel(next.localLabels!, change.originalLabel);
    }
  }

  if (change.action === "save") {
    const label: AnnotationLabel = { name: change.name, value: change.value };
    if (change.scope === "global") {
      nextGlobalLabels.push(label);
    } else {
      next.localLabels!.push(label);
    }
  }

  if (next.localLabels!.length === 0) {
    delete next.localLabels;
  }

  let banks: Record<string, BankAnnotation> = {
    ...annotations.banks,
    [String(bank)]: next
  };
  if (change.action === "delete") {
    banks = removeLabelOperandReferencesFromBanks(banks, bank, change.scope, change.name);
  }
  return withGlobalLabels(annotations, banks, nextGlobalLabels);
}

/** An operand label assignment, as the operand dialog reports it. */
export type OperandLabelChange = {
  action: "apply" | "clear" | "create-label";
  operandIndex: number;
  scope: AnnotationLabelScope;
  name: string;
  value: number;
};

/**
 * Attach, replace or clear the label reference on one decoded operand.
 *
 * `create-label` both defines the label and attaches it, which is why the two cannot be separate
 * steps: a label created and then not attached would be indistinguishable from a stray one.
 * References at an offset stay sorted by operand index so a two-operand instruction renders its
 * labels in the order it prints them.
 */
export function withOperandLabel(
  annotations: ProgramAnnotations,
  bank: number,
  bankOffset: number,
  change: OperandLabelChange
): ProgramAnnotations | undefined {
  const bankAnnotation = getBankAnnotation(annotations, bank);
  if (!bankAnnotation) return undefined;

  let nextGlobalLabels = [...(annotations.globalLabels ?? [])];
  const next: BankAnnotation = {
    ...bankAnnotation,
    localLabels: bankAnnotation.localLabels ? [...bankAnnotation.localLabels] : undefined
  };

  if (change.action === "create-label") {
    const label: AnnotationLabel = { name: change.name, value: change.value };
    if (change.scope === "global") {
      nextGlobalLabels = addLabelIfMissing(nextGlobalLabels, label);
    } else {
      next.localLabels = addLabelIfMissing(next.localLabels ?? [], label);
    }
  }

  const nextReferences = { ...(bankAnnotation.operandReferences ?? {}) };
  const offsetKey = String(bankOffset);
  const remaining = (nextReferences[offsetKey] ?? []).filter(
    (reference) => reference.operandIndex !== change.operandIndex
  );

  if (change.action === "apply" || change.action === "create-label") {
    nextReferences[offsetKey] = [
      ...remaining,
      { operandIndex: change.operandIndex, scope: change.scope, name: change.name }
    ].sort((left, right) => left.operandIndex - right.operandIndex);
  } else if (remaining.length > 0) {
    nextReferences[offsetKey] = remaining;
  } else {
    delete nextReferences[offsetKey];
  }

  if (Object.keys(nextReferences).length > 0) {
    next.operandReferences = nextReferences;
  } else {
    delete next.operandReferences;
  }
  if (next.localLabels?.length === 0) {
    delete next.localLabels;
  }

  return withGlobalLabels(
    annotations,
    { ...annotations.banks, [String(bank)]: next },
    nextGlobalLabels
  );
}

/**
 * A label as the label dialogs list it: the label itself, its scope, and how many operands point at
 * it.
 *
 * Structurally what `NexLabelDialogLabel` asks for, but declared here so this module stays free of
 * dialog imports — the dialogs are React, and these rules are not.
 */
export type LabelListEntry = AnnotationLabel & {
  scope: AnnotationLabelScope;
  bank?: number;
  referenced: boolean;
  referenceCount: number;
};

/**
 * Every label a bank can use — the file's global labels followed by the bank's own — each with its
 * reference count.
 *
 * The count is what the delete confirmation reports, and what marks a label as referenced in the
 * list, so it is derived here rather than at each call site.
 */
export function listLabelsForBank(
  annotations: ProgramAnnotations,
  bank: number
): LabelListEntry[] {
  const bankAnnotation = getBankAnnotation(annotations, bank);
  const entry = (
    label: AnnotationLabel,
    scope: AnnotationLabelScope
  ): LabelListEntry => {
    const referenceCount = countLabelReferences(annotations, bank, scope, label.name);
    return {
      ...label,
      scope,
      ...(scope === "local" ? { bank } : {}),
      referenced: referenceCount > 0,
      referenceCount
    };
  };
  return [
    ...(annotations.globalLabels ?? []).map((label) => entry(label, "global")),
    ...(bankAnnotation?.localLabels ?? []).map((label) => entry(label, "local"))
  ];
}
