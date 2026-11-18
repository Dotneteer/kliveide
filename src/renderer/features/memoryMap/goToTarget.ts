import type { RoutineLabel } from "@common/profile/routineMap";

/*
 * The Go to box of the Memory and Disassembly views (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md`
 * §4.1), and the address argument of `show-memory` / `show-disass` (phase 6): one language.
 *
 * - a number: hex unless the view is in Decimal (`8000`), or with a prefix that says (`$8000`,
 *   `0x8000`, `#8000`, `%1000`, `32768d`)
 * - a register name (`HL`, `pc`, `IX`)
 * - a label: the build's, the active annotation set's, the ROM's
 * - a partition-qualified address, `PART:offset` (`47:$0100`, `R0:0`), in the breakpoint syntax
 *   (`bp-set r1:$32ac`): the partition by its machine label, the offset in the partition
 *
 * Pure, so the commands and the views parse the same way and a test can pin the whole language.
 */

/** The message key of each refusal (`GoToResult.error`, but "empty", which is no refusal) */
export const GO_TO_ERROR_KEYS = {
  number: "panels.memoryMap.goToError.number",
  partition: "panels.memoryMap.goToError.partition",
  unknown: "panels.memoryMap.goToError.unknown",
  range: "panels.memoryMap.goToError.range"
} as const;

/** Where a Go to lands */
export type GoToTarget =
  | { kind: "address"; address: number; via?: "number" | "register" | "label"; name?: string }
  | { kind: "partition"; partition: number; offset: number; via?: "number" | "label"; name?: string };

export type GoToResult = { target: GoToTarget } | { error: "empty" | "number" | "partition" | "unknown" | "range" };

export type GoToContext = {
  /** The view shows decimal numbers: a bare number is decimal */
  decimal?: boolean;
  /** The register values (`PC`, `HL`, `HL'`...), upper case names */
  registers?: Record<string, number>;
  /** The machine's partition labels (`getPartitionLabels()`) */
  partitionLabels?: Record<number, string>;
  /** Each partition's size (8K or 16K), for a label in a partition and an offset's range */
  partitionSize?: (partition: number) => number | undefined;
  /** The partition paged in at each 8K slot now (`slotPartitions`), to tell a paged label from one that is not */
  slotPartitions?: (number | undefined)[];
  /** Every named location (build, annotation, ROM labels) */
  labels?: readonly RoutineLabel[];
};

/**
 * Parse a number in the Go to language.
 * @returns The value, or undefined when the text is not a number
 */
export function parseGoToNumber(text: string, decimal = false): number | undefined {
  const s = text.trim().replace(/_/g, "");
  let m: RegExpExecArray | null;
  if ((m = /^(?:\$|#|0x)([0-9a-f]+)$/i.exec(s))) return parseInt(m[1], 16);
  if ((m = /^([0-9a-f]+)h$/i.exec(s)) && /^[0-9]/.test(s)) return parseInt(m[1], 16);
  if ((m = /^%([01]+)$/.exec(s))) return parseInt(m[1], 2);
  if ((m = /^([0-9]+)d$/i.exec(s))) return parseInt(m[1], 10);
  if (decimal) return /^[0-9]+$/.test(s) ? parseInt(s, 10) : undefined;
  return /^[0-9a-f]+$/i.test(s) ? parseInt(s, 16) : undefined;
}

/** The partition a machine label names, case-insensitively (`r1` is `R1`; a Z88 `4` is `04`) */
export function partitionOfLabel(label: string, labels: Record<number, string> | undefined): number | undefined {
  if (!labels) return undefined;
  const wanted = label.trim().toUpperCase();
  if (!wanted) return undefined;
  for (const [key, value] of Object.entries(labels)) {
    if (value.toUpperCase() === wanted) return Number(key);
  }
  // --- A hex partition label typed without its leading zero
  if (/^[0-9A-F]$/.test(wanted)) return partitionOfLabel(`0${wanted}`, labels);
  return undefined;
}

/** Register names Go to accepts, as `buildPointedRegisterHints` names them */
export const GO_TO_REGISTERS = ["PC", "SP", "HL", "DE", "BC", "IX", "IY", "HL'", "DE'", "BC'", "IR", "WZ"] as const;

/**
 * Where a label goes: its address when its partition is paged in there (or it has none), else the
 * partition and the offset in it.
 */
export function labelTarget(label: RoutineLabel, ctx: GoToContext): GoToTarget {
  const partition = label.partition;
  if (partition === undefined) {
    return { kind: "address", address: label.address & 0xffff, via: "label", name: label.name };
  }
  const slot = (label.address >> 13) & 0x07;
  if (ctx.slotPartitions?.[slot] === partition) {
    return { kind: "address", address: label.address & 0xffff, via: "label", name: label.name };
  }
  const size = ctx.partitionSize?.(partition) ?? 0x4000;
  return { kind: "partition", partition, offset: label.address % size, via: "label", name: label.name };
}

/** Parse the Go to box's text */
export function parseGoToTarget(text: string, ctx: GoToContext = {}): GoToResult {
  const s = text.trim();
  if (!s) return { error: "empty" };

  // --- PART:offset
  const colon = s.indexOf(":");
  if (colon > 0) {
    const partition = partitionOfLabel(s.slice(0, colon), ctx.partitionLabels);
    if (partition === undefined) return { error: "partition" };
    const offset = parseGoToNumber(s.slice(colon + 1), ctx.decimal);
    if (offset === undefined) return { error: "number" };
    const size = ctx.partitionSize?.(partition);
    if (offset < 0 || (size !== undefined && offset >= size)) return { error: "range" };
    return { target: { kind: "partition", partition, offset, via: "number" } };
  }

  // --- A register
  const reg = s.toUpperCase();
  if (ctx.registers && reg in ctx.registers) {
    return { target: { kind: "address", address: ctx.registers[reg] & 0xffff, via: "register", name: reg } };
  }

  // --- A label, before a number: `add` or `beef` may be both, and the label is what the user named
  const label =
    ctx.labels?.find((l) => l.name === s) ?? ctx.labels?.find((l) => l.name.toLowerCase() === s.toLowerCase());
  if (label) return { target: labelTarget(label, ctx) };

  const value = parseGoToNumber(s, ctx.decimal);
  if (value !== undefined) {
    if (value < 0 || value > 0xffff) return { error: "range" };
    return { target: { kind: "address", address: value, via: "number" } };
  }
  return { error: "unknown" };
}

/** Label names that start with the text, for the Go to box's suggestions */
export function suggestLabels(text: string, labels: readonly RoutineLabel[] | undefined, max = 8): string[] {
  const s = text.trim().toLowerCase();
  if (!s || !labels) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of labels) {
    if (out.length >= max) break;
    if (!label.name.toLowerCase().startsWith(s) || seen.has(label.name)) continue;
    seen.add(label.name);
    out.push(label.name);
  }
  return out;
}
