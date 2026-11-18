/*
 * The Next Registers document's view model: pure functions from the descriptor table, the
 * register state and the view settings to what the document draws. No React, no text — the view
 * translates (`dev/ai/i18n-guide.md`, rule 6), so everything here is testable without rendering.
 */
import type { NextRegDescriptor, RegValueState } from "@emu/machines/zxNext/nextRegDescriptors";
import {
  NEXT_REG_CATEGORIES,
  type NextRegCategory,
  type NextRegCategoryId
} from "@common/zxnext/nextRegCategories";
import { sliceMask } from "@common/zxnext/nextRegSlices";

export type NextRegGrouping = "index" | "category";
export type NextRegValueFormat = "hex" | "dec" | "bin";

/** What the document keeps in its view state, so a reopened document looks the way it was left. */
export type NextRegDocumentViewState = {
  grouping: NextRegGrouping;
  format: NextRegValueFormat;
  changedOnly: boolean;
  writtenOnly: boolean;
  expandAll: boolean;
  /** The register the inspector shows */
  selected: number;
  /** Keys of the collapsed groups (`NextRegGroup.key`) */
  collapsed: string[];
};

export const DEFAULT_NEXT_REG_DOCUMENT_VIEW_STATE: NextRegDocumentViewState = {
  grouping: "index",
  format: "hex",
  changedOnly: false,
  writtenOnly: false,
  expandAll: false,
  selected: 0x00,
  collapsed: []
};

// ---------------------------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------------------------

export const hex2 = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");
export const bin8 = (value: number) => value.toString(2).padStart(8, "0");

/** A register byte in the chosen format: `$3A`, `58` or `0011 1010`. */
export function formatRegValue(value: number, format: NextRegValueFormat): string {
  switch (format) {
    case "dec":
      return String(value);
    case "bin": {
      const bits = bin8(value);
      return `${bits.slice(0, 4)} ${bits.slice(4)}`;
    }
    default:
      return `$${hex2(value)}`;
  }
}

/** The `nextreg` instruction that writes this value back. */
export const nextRegInstruction = (id: number, value: number) => `nextreg $${hex2(id)}, $${hex2(value)}`;

/**
 * The byte the bit view decodes: what the register reads back, or — for a write-only register,
 * which reads back nothing — what was last written to it.
 */
export const displayedValue = (state: RegValueState | undefined) => state?.value ?? state?.lastWrite;

// ---------------------------------------------------------------------------------------------
// Bits and fields
// ---------------------------------------------------------------------------------------------

/**
 * Which slice owns each bit, indexed by bit number (`owners[7]` is bit 7); -1 for a bit no slice
 * documents. A register with no slices has every bit unowned.
 */
export function bitOwners(descriptor: NextRegDescriptor | undefined): number[] {
  const owners = new Array<number>(8).fill(-1);
  descriptor?.slices?.forEach((slice, index) => {
    const mask = sliceMask(slice);
    for (let bit = 0; bit < 8; bit++) if (mask & (1 << bit)) owners[bit] = index;
  });
  return owners;
}

/** A run of adjacent bits with the same owner, from the high bit down. */
export type BitSpan = { owner: number; high: number; low: number };

/** The register's bits as runs of one owner each, bit 7 first. */
export function bitSpans(descriptor: NextRegDescriptor | undefined): BitSpan[] {
  const owners = bitOwners(descriptor);
  const spans: BitSpan[] = [];
  for (let bit = 7; bit >= 0; ) {
    const owner = owners[bit];
    let low = bit;
    while (low > 0 && owners[low - 1] === owner) low--;
    spans.push({ owner, high: bit, low });
    bit = low - 1;
  }
  return spans;
}

// ---------------------------------------------------------------------------------------------
// Categories and groups
// ---------------------------------------------------------------------------------------------

/** The categories each register is filed under; "other" for one the book's table does not list. */
export function categoriesByRegister(
  descriptors: readonly NextRegDescriptor[]
): Map<number, NextRegCategoryId[]> {
  const result = new Map<number, NextRegCategoryId[]>();
  const known = new Set(descriptors.map((d) => d.id));
  for (const category of NEXT_REG_CATEGORIES) {
    for (const id of category.regs) {
      if (!known.has(id)) continue;
      const list = result.get(id) ?? [];
      if (!list.includes(category.id)) list.push(category.id);
      result.set(id, list);
    }
  }
  for (const d of descriptors) if (!result.has(d.id)) result.set(d.id, ["other"]);
  return result;
}

export type NextRegGroup = {
  /** Stable across renders and languages; what `collapsed` stores */
  key: string;
  /** `index` groups carry their register range */
  range?: { from: number; to: number };
  /** `category` groups carry their category */
  category?: NextRegCategory;
  /** The registers, in display order */
  ids: number[];
};

/**
 * The document's groups: sixteen-register blocks by index (only those with a documented register),
 * or the book's categories, each register in every category that lists it, with "Other" last.
 */
export function buildGroups(
  grouping: NextRegGrouping,
  descriptors: readonly NextRegDescriptor[]
): NextRegGroup[] {
  if (grouping === "index") {
    const groups: NextRegGroup[] = [];
    for (let block = 0; block < 16; block++) {
      const ids = descriptors.filter((d) => d.id >> 4 === block).map((d) => d.id);
      if (!ids.length) continue;
      groups.push({ key: `i${block}`, range: { from: block << 4, to: (block << 4) | 0x0f }, ids });
    }
    return groups;
  }
  const byRegister = categoriesByRegister(descriptors);
  const known = new Set(descriptors.map((d) => d.id));
  return NEXT_REG_CATEGORIES.map((category) => ({
    key: `c-${category.id}`,
    category,
    ids:
      category.id === "other"
        ? descriptors.filter((d) => byRegister.get(d.id)?.[0] === "other").map((d) => d.id)
        : category.regs.filter((id) => known.has(id))
  })).filter((group) => group.ids.length > 0);
}

// ---------------------------------------------------------------------------------------------
// Filtering and change tracking
// ---------------------------------------------------------------------------------------------

/**
 * Whether a register matches the filter text.
 *
 * `$15`, `0x15` and `#15` match that register number only; a bare two-digit hex number (`15`,
 * `5a`) matches the number *or* any text containing it; anything else matches the register's
 * name, its fields' texts and value names, and the names of its categories (passed in already
 * translated, so the filter finds what the reader sees).
 */
export function matchesFilter(
  descriptor: NextRegDescriptor,
  filter: string,
  categoryNames: readonly string[] = []
): boolean {
  const query = filter.trim().toLowerCase();
  if (!query) return true;
  const prefixed = /^(\$|0x|#)([0-9a-f]{1,2})$/.exec(query);
  if (prefixed) return descriptor.id === parseInt(prefixed[2], 16);
  if (/^[0-9a-f]{2}$/.test(query) && hex2(descriptor.id).toLowerCase() === query) return true;
  const haystack = [
    descriptor.description,
    ...(descriptor.slices ?? []).flatMap((s) => [s.description, ...Object.values(s.valueSet ?? {})]),
    ...categoryNames
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return haystack.includes(query);
}

/** The value each register read back at a stop, to compare the next stop against. */
export type NextRegBaseline = ReadonlyMap<number, number>;

export const baselineOf = (regs: readonly RegValueState[]): NextRegBaseline =>
  new Map(regs.filter((r) => r.value !== undefined).map((r) => [r.id, r.value!]));

/** Whether a register reads back something other than it did at the baseline stop. */
export function isChanged(state: RegValueState | undefined, baseline: NextRegBaseline | undefined) {
  if (!state || state.value === undefined || !baseline) return false;
  const before = baseline.get(state.id);
  return before !== undefined && before !== state.value;
}

/** The registers of a group the view settings and the filter let through. */
export function visibleIds(
  group: NextRegGroup,
  options: {
    descriptors: ReadonlyMap<number, NextRegDescriptor>;
    states: ReadonlyMap<number, RegValueState>;
    baseline?: NextRegBaseline;
    filter: string;
    changedOnly: boolean;
    writtenOnly: boolean;
    categoryNamesOf: (id: number) => readonly string[];
  }
): number[] {
  return group.ids.filter((id) => {
    const descriptor = options.descriptors.get(id);
    if (!descriptor) return false;
    const state = options.states.get(id);
    if (options.changedOnly && !isChanged(state, options.baseline)) return false;
    if (options.writtenOnly && state?.lastWrite === undefined) return false;
    return matchesFilter(descriptor, options.filter, options.categoryNamesOf(id));
  });
}
