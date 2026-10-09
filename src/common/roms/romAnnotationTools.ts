import { romCrc32 } from "./romIdentity";

/*
 * The authoring tools of the shipped ROM sidecars (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md`
 * §5.4, §6): the formatter that keeps them diffable, the CRC index the IDE finds them by, and the
 * reports an author works from. Pure — the CLI (`scripts/rom-annotations.cjs`) reads and writes the
 * files, and the tests run the same functions.
 *
 * The rules an author follows are in `.ai/rom-annotations/README.md`; this module only measures.
 */

/** A shipped sidecar as raw JSON: the model plus the ROM sidecar's own keys (§5.1). */
export type RawRomSidecar = Record<string, any>;

/** The provenance an entry carries (§6). */
export type Provenance = "observed" | "manual" | "derived";

// ------------------------------------------------------------------------------------------------
// Formatting

/** The order a sidecar's top-level keys are written in; any other key follows, sorted. */
const TOP_KEYS = [
  "schemaVersion",
  "machine",
  "source",
  "authoring",
  "level",
  "pages",
  "inherits",
  "banks",
  "provenance"
];
const BANK_KEYS = [
  "offsetIndex",
  "lastView",
  "decimalView",
  "comment",
  "regions",
  "localLabels",
  "lineAnnotations",
  "operandReferences"
];

const json = (value: unknown) => JSON.stringify(value);

function orderedKeys(object: Record<string, any>, order: string[]): string[] {
  const known = order.filter((key) => key in object);
  const rest = Object.keys(object)
    .filter((key) => !order.includes(key))
    .sort();
  return [...known, ...rest];
}

/** Numeric object keys in numeric order, other keys after them in text order. */
function sortedOffsets(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const [na, nb] = [Number(a.split(":")[0]), Number(b.split(":")[0])];
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/** The provenance keys (`<page>:<offset>:<kind>`) in page, then offset, then kind order. */
function sortedProvenanceKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const [pa, oa, ka] = a.split(":");
    const [pb, ob, kb] = b.split(":");
    return Number(pa) - Number(pb) || Number(oa) - Number(ob) || (ka < kb ? -1 : ka > kb ? 1 : 0);
  });
}

function formatBank(bank: Record<string, any>, indent: string): string {
  const inner = `${indent}  `;
  const lines: string[] = [];
  for (const key of orderedKeys(bank, BANK_KEYS)) {
    const value = bank[key];
    if (key === "regions" && Array.isArray(value)) {
      const regions = [...value].sort((a, b) => a.start - b.start);
      lines.push(`${inner}"regions": [\n${regions.map((r) => `${inner}  ${json(r)}`).join(",\n")}\n${inner}]`);
    } else if (key === "localLabels" && Array.isArray(value)) {
      const labels = [...value].sort((a, b) => a.value - b.value || (a.name < b.name ? -1 : 1));
      lines.push(
        `${inner}"localLabels": [\n${labels.map((l) => `${inner}  ${json({ name: l.name, value: l.value })}`).join(",\n")}\n${inner}]`
      );
    } else if ((key === "lineAnnotations" || key === "operandReferences") && value && typeof value === "object") {
      const keys = sortedOffsets(Object.keys(value));
      lines.push(
        `${inner}${json(key)}: {\n${keys.map((k) => `${inner}  ${json(k)}: ${json(value[k])}`).join(",\n")}\n${inner}}`
      );
    } else {
      lines.push(`${inner}${json(key)}: ${json(value)}`);
    }
  }
  return `{\n${lines.join(",\n")}\n${indent}}`;
}

/**
 * A shipped sidecar in its one canonical form: a fixed key order, regions, labels, comments and
 * provenance sorted by offset, one entry per line — so a review diff shows the entries that changed
 * and nothing else. Idempotent; `npm run rom:annotations -- --check` fails when a file is not in it.
 */
export function formatRomSidecar(sidecar: RawRomSidecar): string {
  const lines: string[] = [];
  for (const key of orderedKeys(sidecar, TOP_KEYS)) {
    const value = sidecar[key];
    if (key === "banks" && value && typeof value === "object") {
      const pages = sortedOffsets(Object.keys(value));
      lines.push(`  "banks": {\n${pages.map((p) => `    ${json(p)}: ${formatBank(value[p], "    ")}`).join(",\n")}\n  }`);
    } else if (key === "provenance" && value && typeof value === "object") {
      const keys = sortedProvenanceKeys(Object.keys(value));
      lines.push(`  "provenance": {\n${keys.map((k) => `    ${json(k)}: ${json(value[k])}`).join(",\n")}\n  }`);
    } else if (key === "pages" && value && typeof value === "object") {
      const pages = sortedOffsets(Object.keys(value));
      lines.push(`  "pages": {\n${pages.map((p) => `    ${json(p)}: ${json(value[p])}`).join(",\n")}\n  }`);
    } else {
      lines.push(`  ${json(key)}: ${json(value)}`);
    }
  }
  return `{\n${lines.join(",\n")}\n}\n`;
}

// ------------------------------------------------------------------------------------------------
// The index

/**
 * The shipped index (§5.2): every page of every shipped sidecar's ROM file, by CRC-32, to the
 * sidecar and page that describe it. A ROM loaded from *any* file whose bytes equal a shipped page
 * gets that page's annotations, and nothing has to read every sidecar to find out.
 *
 * @param sidecars The shipped sidecar file names (`sp48.rom.dis`)
 * @param romBytes The bytes of the ROM file a sidecar sits beside (its name without `.dis`)
 */
export function buildRomIndex(
  sidecars: readonly string[],
  romBytes: (romFile: string) => Uint8Array
): Record<string, { sidecar: string; page: number }> {
  const index: Record<string, { sidecar: string; page: number }> = {};
  for (const sidecar of [...sidecars].sort()) {
    const bytes = romBytes(sidecar.replace(/\.dis$/i, ""));
    for (let page = 0; page * 0x4000 < bytes.length; page++) {
      const crc = romCrc32(bytes.subarray(page * 0x4000, Math.min(bytes.length, (page + 1) * 0x4000)));
      index[crc] ??= { sidecar, page };
    }
  }
  const sorted: Record<string, { sidecar: string; page: number }> = {};
  for (const crc of Object.keys(index).sort()) sorted[crc] = index[crc];
  return sorted;
}

/** The index file's text: one entry per line. */
export function formatRomIndex(index: Record<string, { sidecar: string; page: number }>): string {
  const entries = Object.keys(index).map((crc) => `  ${json(crc)}: ${json(index[crc])}`);
  return `{\n${entries.join(",\n")}\n}\n`;
}

// ------------------------------------------------------------------------------------------------
// Provenance and checks

/** Every entry of a page that needs a provenance, by its key (§5.1). */
export function provenanceKeysOf(sidecar: RawRomSidecar): string[] {
  const keys: string[] = [];
  for (const [page, bank] of Object.entries<Record<string, any>>(sidecar.banks ?? {})) {
    for (const label of bank.localLabels ?? []) keys.push(`${page}:${label.value}:label`);
    for (const offset of Object.keys(bank.lineAnnotations ?? {})) keys.push(`${page}:${offset}:line`);
    for (const region of bank.regions ?? []) {
      if (region.type !== "disassemble" || region.decode) keys.push(`${page}:${region.start}:region`);
    }
  }
  return keys;
}

/** The entries of a sidecar that carry no provenance (§6: every entry must). */
export function missingProvenance(sidecar: RawRomSidecar): string[] {
  const provenance = sidecar.provenance ?? {};
  return provenanceKeysOf(sidecar).filter((key) => !provenance[key]);
}

/** Provenance entries that name nothing (a removed label, a moved region): kept tidy by the formatter. */
export function strayProvenance(sidecar: RawRomSidecar): string[] {
  const keys = new Set(provenanceKeysOf(sidecar));
  return Object.keys(sidecar.provenance ?? {}).filter((key) => !keys.has(key));
}

// ------------------------------------------------------------------------------------------------
// Code walk: what the level report and the skeleton read

/** A decoded instruction, as much as the reports need. */
export type RomInstruction = {
  offset: number;
  length: number;
  /** The control-transfer target, for `CALL`/`JP`/`JR`/`DJNZ`/`RST`. */
  target?: number;
};

/**
 * The instructions of a page's code regions, decoded linearly from each region start (and from each
 * label, which the author put on an instruction start). The decoder is passed in so this module
 * stays free of the disassembler: the CLI and the tests give it Klive's.
 */
export type RomDecoder = (bytes: Uint8Array, start: number, end: number) => Promise<RomInstruction[]>;

/** The completeness of one page (§5.6). */
export type RomLevelReport = {
  /** 2 when every level 2 rule holds, 1 when every level 1 rule does, else 0. */
  level: 0 | 1 | 2;
  /** Control-transfer targets inside the page's code with no label. */
  unlabelledTargets: number[];
  /** Labels without a synopsis comment. */
  labelsWithoutSynopsis: string[];
  /** Labels that are not on an instruction start inside a code region. */
  misplacedLabels: string[];
  instructions: number;
};

/**
 * Measure a page against the completeness levels (§5.6).
 *
 * Level 1: every `CALL`/`JP`/`RST`/`JR`/`DJNZ` target inside the page that code regions reach has a
 * label. (Every data region being marked is the author's judgement; the coverage tool is what
 * suggests them.) Level 2: level 1, and every label has a synopsis comment.
 */
export async function measureRomLevel(
  bank: Record<string, any>,
  bytes: Uint8Array,
  decode: RomDecoder
): Promise<RomLevelReport> {
  const labels: { name: string; value: number }[] = bank.localLabels ?? [];
  const labelled = new Set(labels.map((label) => label.value));
  const codeRegions = (bank.regions ?? []).filter((r: any) => r.type === "disassemble");
  const inCode = (offset: number) => codeRegions.some((r: any) => offset >= r.start && offset <= r.end);

  const starts = new Set<number>();
  const targets = new Set<number>();
  let instructions = 0;
  // --- Decoded in runs that start at the region and at every label in it: a label sits on an
  // --- instruction start, so it is where a linear decode that slipped over data resynchronises
  const labelOffsets = [...labelled].sort((a, b) => a - b);
  for (const region of codeRegions) {
    const end = Math.min(region.end, bytes.length - 1);
    const cuts = [region.start, ...labelOffsets.filter((o) => o > region.start && o <= end)];
    for (let index = 0; index < cuts.length; index++) {
      const runEnd = index + 1 < cuts.length ? cuts[index + 1] - 1 : end;
      for (const instr of await decode(bytes, cuts[index], runEnd)) {
        starts.add(instr.offset);
        instructions++;
        if (instr.target !== undefined && instr.target < bytes.length && inCode(instr.target)) {
          targets.add(instr.target);
        }
      }
    }
  }

  const unlabelledTargets = [...targets].filter((target) => !labelled.has(target)).sort((a, b) => a - b);
  const synopsisAt = (offset: number) => !!bank.lineAnnotations?.[String(offset)]?.synopsis;
  const labelsWithoutSynopsis = labels.filter((l) => !synopsisAt(l.value)).map((l) => l.name);
  const misplacedLabels = labels
    .filter((l) => inCode(l.value) && !starts.has(l.value))
    .map((l) => l.name);
  const level1 = unlabelledTargets.length === 0 && misplacedLabels.length === 0;
  const level2 = level1 && labelsWithoutSynopsis.length === 0;
  return {
    level: level2 ? 2 : level1 ? 1 : 0,
    unlabelledTargets,
    labelsWithoutSynopsis,
    misplacedLabels,
    instructions
  };
}

// ------------------------------------------------------------------------------------------------
// Skeleton and binding reports

/** The level 1 to-do list for a page (§6 `skeleton`): its unlabelled targets, as label stubs. */
export function skeletonOf(report: RomLevelReport): string[] {
  return report.unlabelledTargets.map(
    (target) => `{ "name": "L${target.toString(16).toUpperCase().padStart(4, "0")}", "value": ${target} }`
  );
}
