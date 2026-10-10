import type { BreakpointHitMode, LogDialect } from "@abstractions/BreakpointInfo";

import { readStoredBreakpointFilters } from "@common/utils/breakpoint-filters";
import type { AnnotationMachine } from "@common/annotations/bankSpace";

/**
 * The schema a newly written sidecar declares.
 *
 * **2** added the `debug` subtree — the bank breakpoints a NEX carries. A v1 file loads unchanged
 * and is only rewritten as v2 when something is actually saved, so opening an old project never
 * touches its files.
 */
export const NEXT_ANNOTATION_SCHEMA_VERSION = 2;

/**
 * The schema a sidecar for any machine but the Next declares.
 *
 * **3** added `machine`. A Next sidecar never carries it and stays at 2, byte for byte, so a build
 * that reads only `[1, 2]` keeps opening every NEX sidecar — and refuses a 48K one instead of
 * reading its banks as Next banks. See `.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` A6.
 */
export const MACHINE_ANNOTATION_SCHEMA_VERSION = 3;

/** Every schema this build can read. */
export const ANNOTATION_READABLE_SCHEMA_VERSIONS = [1, 2, 3];


/**
 * The highest bank number each bank space can hold (`BankSpace.maxBank`; `rom` is the 16K pages of a
 * ROM file, up to a 128K file).
 */
export const ANNOTATION_MACHINE_MAX_BANK: Record<AnnotationMachine, number> = {
  next: 111,
  sp48: 7,
  sp128: 7,
  plus3: 7,
  scorpion: 15,
  timex: 7,
  zx81: 3,
  zx80: 3,
  rom: 7
};

export const ANNOTATION_MACHINES = Object.keys(ANNOTATION_MACHINE_MAX_BANK) as AnnotationMachine[];

export function isAnnotationMachine(value: unknown): value is AnnotationMachine {
  return typeof value === "string" && value in ANNOTATION_MACHINE_MAX_BANK;
}

/** The schema version a model for this machine is written as: 2 for the Next, 3 for the rest. */
export function schemaVersionFor(machine: AnnotationMachine | undefined): number {
  return machine && machine !== "next"
    ? MACHINE_ANNOTATION_SCHEMA_VERSION
    : NEXT_ANNOTATION_SCHEMA_VERSION;
}

/** The bank space a model's banks are numbered in; absent means the Next (schema 1 and 2). */
export function annotationMachineOf(annotations: Pick<ProgramAnnotations, "machine">): AnnotationMachine {
  return annotations.machine ?? "next";
}
export const ANNOTATION_BANK_SIZE = 0x4000;
export const ANNOTATION_BANK_LAST_OFFSET = ANNOTATION_BANK_SIZE - 1;
export const NEX_MAX_BANK = 111;
export const ANNOTATION_LABEL_MAX_LENGTH = 16;
/**
 * How long a bank comment may grow before validation says so.
 *
 * A warning, not an error: an over-long comment is still a comment and still loads. The limit is
 * about keeping the sidecar a JSON file a person can read, not about anything that would break.
 */
export const BANK_COMMENT_SOFT_LIMIT = 4000;

export type AnnotationOffsetIndex = 0 | 1 | 2 | 3;
/**
 * What a region of a bank is. `copper` and `dma` exist only in memory: on disk they are `bytes`
 * regions with a `decode` key, which shipped builds ignore — see `toSidecarRegion` and
 * `.plans/NEX_DMA_COPPER_REGIONS_PLAN.md` D3.
 */
export type AnnotationRegionType =
  | "disassemble"
  | "bytes"
  | "words"
  | "skip"
  | "copper"
  | "dma"
  | "text"
  | "graphic";

/**
 * The region kinds stored as `bytes` + `decode` on disk. `copper`/`dma` are the Next's; `text` is
 * printable runs, decoded with the machine's own character set on the ZX80/ZX81 (§4.7 of the
 * reverse-engineering annotations plan) and as ASCII elsewhere; `graphic` is bytes laid out by the
 * bank's matching `graphics` entry (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §3).
 */
export type DecodedRegionType = Extract<AnnotationRegionType, "copper" | "dma" | "text" | "graphic">;

/** The decoded region types a bank space offers. Every other type is offered everywhere. */
export function decodedRegionTypesFor(machine: AnnotationMachine): DecodedRegionType[] {
  switch (machine) {
    case "next":
      return ["copper", "dma", "text", "graphic"];
    default:
      return ["text", "graphic"];
  }
}

/**
 * Who wrote a region. Absent: the user. `auto`: code/data detection (G7.3); `skool`: a SkoolKit
 * import (G7.5). An additive key that a shipped build ignores (R2).
 */
export type AnnotationRegionOrigin = "auto" | "skool";

/** A region as the sidecar stores it: only the types every shipped build accepts. */
export type SidecarRegion = {
  start: number;
  end: number;
  type: "disassemble" | "bytes" | "words" | "skip";
  rowBytes?: number;
  decode?: DecodedRegionType;
  origin?: AnnotationRegionOrigin;
};
export type AnnotationLabelScope = "global" | "local";
export type AnnotationBankView = "memory" | "disassembly";

export type AnnotationDiagnostic = {
  severity: "error" | "warning";
  path: string;
  message: string;
};

export type AnnotationSource = {
  fileName?: string;
  sha256?: string;
};

export type AnnotationLabel = {
  name: string;
  value: number;
};

export type AnnotationRegion = {
  start: number;
  end: number;
  type: AnnotationRegionType;
  /**
   * For a `bytes` region: how many bytes each `.defb` row holds, 1..`MAX_ROW_BYTES`. Omitted means
   * the default of four. Set it when the data has a record structure the rows should follow — a
   * copper list is two-byte instructions, so `rowBytes: 2` gives each instruction its own row.
   * A `graphic` region keeps the value it is stored with (`min(width, 4)`), so an older build lists
   * it one pixel row per `.defb` where it can.
   */
  rowBytes?: number;
  /** Who wrote it; see `AnnotationRegionOrigin`. Absent: the user. */
  origin?: AnnotationRegionOrigin;
};

/** The most values a `.defb` row holds, and the row size when a region does not set `rowBytes`. */
export const MAX_ROW_BYTES = 4;

/** The row size a region lays its data out in. */
export function getRegionRowBytes(region: Pick<AnnotationRegion, "rowBytes">): number {
  return region.rowBytes ?? MAX_ROW_BYTES;
}

/**
 * Whether two regions lay out the same way, so that touching each other they can be one region.
 * Type alone is not enough: two `bytes` regions with different row sizes must stay apart.
 */
export function sameRegionLayout(
  a: Pick<AnnotationRegion, "type" | "rowBytes" | "origin">,
  b: Pick<AnnotationRegion, "type" | "rowBytes" | "origin">
): boolean {
  // --- `origin` takes part, so a detected region never merges into one the user wrote (§3). Two
  // --- graphics never merge: each is its own named thing, laid out by its own `graphics` entry.
  return (
    a.type === b.type &&
    a.type !== "graphic" &&
    getRegionRowBytes(a) === getRegionRowBytes(b) &&
    a.origin === b.origin
  );
}

/**
 * A region as the sidecar stores it (D3): a Copper list is `bytes` with `rowBytes: 2` and
 * `decode: "copper"`, a DMA program is `bytes` with `decode: "dma"`. A shipped build ignores
 * `decode` and lists them as plain `.defb` rows — one Copper word per row — instead of refusing the
 * whole file over an unknown type.
 */
export function toSidecarRegion(region: AnnotationRegion): SidecarRegion {
  const origin = region.origin ? { origin: region.origin } : {};
  switch (region.type) {
    case "copper":
      return { start: region.start, end: region.end, type: "bytes", rowBytes: 2, decode: "copper", ...origin };
    case "dma":
      return { start: region.start, end: region.end, type: "bytes", decode: "dma", ...origin };
    case "text":
      return { start: region.start, end: region.end, type: "bytes", decode: "text", ...origin };
    case "graphic":
      return {
        start: region.start,
        end: region.end,
        type: "bytes",
        ...(region.rowBytes !== undefined && region.rowBytes !== MAX_ROW_BYTES ? { rowBytes: region.rowBytes } : {}),
        decode: "graphic",
        ...origin
      };
    default:
      return { ...region, type: region.type };
  }
}

/** The bank map with every region in its stored form; everything else is passed through as is. */
export function toSidecarBanks(
  banks: Record<string, BankAnnotation>
): Record<string, Omit<BankAnnotation, "regions"> & { regions: SidecarRegion[] }> {
  const result: Record<string, Omit<BankAnnotation, "regions"> & { regions: SidecarRegion[] }> =
    {};
  for (const [key, bank] of Object.entries(banks)) {
    result[key] = { ...bank, regions: bank.regions.map(toSidecarRegion) };
  }
  return result;
}

export type LineAnnotation = {
  synopsis?: string;
  comment?: string;
  /**
   * Lines after the row: SkoolKit's end comment, which has nowhere else to go (G7.5). Additive; a
   * shipped build ignores it.
   */
  endComment?: string;
};

/** How a named graphic's bytes are laid out (`graphicsDecode.ts`). */
export type BankGraphicLayout = "linear" | "cells" | "columns" | "screen";
export type BankGraphicMask = "none" | "interleaved" | "before" | "after";

/**
 * A graphic the finder named (G7.4, R6): the label, the `graphic` region over its bytes and this
 * entry together. The entry is what the finder, the listing, the source export and the SkoolKit
 * export all lay the bytes out by.
 */
export type BankGraphic = {
  /** Where it starts, bank-relative. */
  offset: number;
  /** Bytes per pixel row, 1..32. */
  width: number;
  /** Pixel rows per frame, 1..256. */
  height: number;
  /** Frames laid out one after another. */
  count: number;
  layout: BankGraphicLayout;
  mask?: BankGraphicMask;
  /** The label it is named by (also a local or global label). */
  label?: string;
};

/** The bytes a named graphic covers. */
export function bankGraphicLength(graphic: Pick<BankGraphic, "width" | "height" | "count" | "mask">): number {
  const frame = graphic.width * graphic.height;
  return frame * graphic.count * (graphic.mask && graphic.mask !== "none" ? 2 : 1);
}

/**
 * What a SkoolKit file says that Klive does not model, kept so an unedited file round-trips (G7.5,
 * S5). Keys are bank offsets, as strings.
 */
export type SkoolInterop = {
  /** ASM directives Klive does not apply, by the offset they stand before (`name=value`). */
  directives?: Record<string, string[]>;
  /** Non-entry text, by the offset it stands before. */
  nonEntry?: Record<string, string[]>;
  /** A braced comment's span: the offset of its last instruction, by its first. */
  braces?: Record<string, number>;
  /** Entry points (`*`) without a label. */
  entryPoints?: number[];
  /** The block character of each entry, by its first offset, when it is not the region's own. */
  blocks?: Record<string, string>;
  /** The entries a file had: by first offset, how its synopsis splits back into the header's sections. */
  entries?: Record<string, { title: boolean; desc: number; regs: number; start: number }>;
  /** ASM directives written above an entry's header, by the entry's offset. */
  entryDirectives?: Record<string, string[]>;
  /** An ignored (`i`) entry's lines, by its offset. */
  ignored?: Record<string, string[]>;
  /** The file wrote its addresses in hex (`$8000`) rather than decimal. */
  hex?: boolean;
};

export type BankInterop = { skool?: SkoolInterop };

export type OperandReference = {
  operandIndex: number;
  scope: AnnotationLabelScope;
  name: string;
};

/**
 * What a bank's sprite data is: its pattern format and where pattern #0 starts.
 *
 * Both optional; an absent block means 8-bit patterns from `$0000`. A fact about the program, so it
 * is shared through the sidecar — unlike which palette the Sprites view shows, which is view state.
 */
export type BankSprites = {
  format?: "8bit" | "4bit";
  offset?: number;
  /**
   * The Sprites view was the view last shown for this bank, so a reopened bank shows it again.
   *
   * Here rather than as `lastView: "sprites"`: a shipped build reports any `lastView` other than
   * memory or disassembly as an error and refuses the whole file, while it simply ignores a key it
   * does not know inside this block. `lastView` keeps the last *listing* view, which is what an
   * older build falls back to.
   */
  active?: boolean;
};

export type BankAnnotation = {
  offsetIndex: AnnotationOffsetIndex;
  lastView?: AnnotationBankView;
  decimalView?: boolean;
  regions: AnnotationRegion[];
  localLabels?: AnnotationLabel[];
  lineAnnotations?: Record<string, LineAnnotation>;
  operandReferences?: Record<string, OperandReference[]>;
  /**
   * Free text about the whole bank: what lives in it, who calls it, what to watch for.
   *
   * LF line breaks, trailing whitespace trimmed, and never empty — an emptied comment is removed
   * rather than stored as `""`. Additive within the bank, not a schema bump; see
   * `.plans/NEX_BANK_COMMENTS_PLAN.md` §3 for what that costs a previously shipped build.
   */
  comment?: string;
  /** How the Sprites view reads this bank. See `BankSprites`. */
  sprites?: BankSprites;
  /** The graphics the finder named, in offset order (G7.4). */
  graphics?: BankGraphic[];
  /** What another tool's file said that Klive does not model (G7.5). */
  interop?: BankInterop;
};

/** A breakpoint as the sidecar stores it: an offset in a bank, and what kind it is. */
export type SidecarBreakpointKind = "exec" | "memRead" | "memWrite";

export type SidecarBreakpoint = SidecarBreakpointFilters & {
  bank: number;
  offset: number;
  kind: SidecarBreakpointKind;
  disabled?: boolean;
};

/**
 * A breakpoint's condition and hit-count rule, stored under the names `BreakpointInfo` uses. Shared
 * by both stored shapes; absent fields mean "always stop". Additive fields, like
 * `labelBreakpoints` — not a schema bump. See `.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §4.7.
 */
export type SidecarBreakpointFilters = {
  condition?: string;
  hitMode?: BreakpointHitMode;
  hitCount?: number;
  /** A logpoint's template (`.plans/LOGPOINTS_PLAN.md` §4.6). */
  logMessage?: string;
  /** Absent means the Klive dialect. */
  logDialect?: LogDialect;
};

/**
 * A **label-anchored** breakpoint as the sidecar stores it.
 *
 * No offset: the label *is* the anchor, and resolution finds where it currently points. That is the
 * whole reason this shape exists rather than reusing `SidecarBreakpoint` — storing an offset
 * would make it a bank breakpoint that happened to be named, and it would stop meaning the same
 * thing the moment the code moved.
 *
 * `bank` absent means a **global** label. See `.plans/NEX_DEBUGGING_PLAN.md` §13.2.
 */
export type SidecarLabelBreakpoint = SidecarBreakpointFilters & {
  label: string;
  bank?: number;
  kind: SidecarBreakpointKind;
  disabled?: boolean;
};

/**
 * The sidecar's debug subtree.
 *
 * Saved **independently of the annotations beside it**, and on a different policy: annotation edits
 * are written when the user asks, while a breakpoint is written the moment it is set — a breakpoint
 * lost because nobody pressed Save is a bug, not a policy. Both writers read-merge-write over
 * disjoint keys, so neither can clobber the other. See `.plans/NEX_DEBUGGING_PLAN.md` §4.5.
 */
export type AnnotationDebugState = {
  breakpoints?: SidecarBreakpoint[];
  /**
   * Breakpoints anchored to this file's labels.
   *
   * An additive field within `debug`, not a schema bump: bumping to 3 would make a build that reads
   * only `[1, 2]` reject the whole file, losing access to the annotations as well — much worse than
   * losing these.
   *
   * The cost is real and worth stating: `readDebug` rebuilds this subtree from the keys it knows,
   * so a **previously shipped** build that opens such a file and then saves a breakpoint change
   * will drop these entries. Nothing here can fix that, since that build already exists. Future
   * additions inside `debug` have the same exposure.
   */
  labelBreakpoints?: SidecarLabelBreakpoint[];
};

export type ProgramAnnotations = {
  schemaVersion: number;
  /** Absent (schema 1 and 2) means the ZX Spectrum Next. Present only from schema 3. */
  machine?: AnnotationMachine;
  source?: AnnotationSource;
  globalLabels?: AnnotationLabel[];
  banks: Record<string, BankAnnotation>;
  debug?: AnnotationDebugState;
};

export type CreateDefaultAnnotationsOptions = {
  /** The bank space; absent (or `next`) writes a schema 2 Next sidecar. */
  machine?: AnnotationMachine;
  nexPath?: string;
  nexFileName?: string;
  sha256?: string;
  loadedBanks: number[];
  getDefaultOffsetIndex?: (bank: number) => AnnotationOffsetIndex;
};

export type ParseAnnotationsOptions = {
  loadedBanks?: number[];
};

/**
 * What a ROM sidecar adds to a program's (§5.1 of the reverse-engineering annotations plan). These
 * keys are not part of the model the session writes: the annotation subtree writer replaces only
 * its own keys, so they survive a user edit untouched.
 */
export type RomSidecarExtras = {
  pages?: Record<string, { crc32: string; name: string }>;
  inherits?: { sidecar: string; page: number }[];
  provenance?: Record<string, "observed" | "manual" | "derived">;
  level?: number;
};

export type ParseAnnotationsResult = {
  annotations?: ProgramAnnotations;
  diagnostics: AnnotationDiagnostic[];
};

export type ResolvedAnnotationLabel = AnnotationLabel & {
  scope: AnnotationLabelScope;
  bank?: number;
};

const LABEL_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** The types a sidecar may store: deliberately the set every shipped build accepts (D3). */
const REGION_TYPES = new Set<AnnotationRegionType>([
  "disassemble",
  "bytes",
  "words",
  "skip"
]);
const DECODED_REGION_TYPES = new Set<DecodedRegionType>(["copper", "dma", "text", "graphic"]);
const REGION_ORIGINS = new Set<AnnotationRegionOrigin>(["auto", "skool"]);
const GRAPHIC_LAYOUTS = new Set<BankGraphicLayout>(["linear", "cells", "columns", "screen"]);
const GRAPHIC_MASKS = new Set<BankGraphicMask>(["none", "interleaved", "before", "after"]);
const LABEL_SCOPES = new Set<AnnotationLabelScope>(["global", "local"]);
const BANK_VIEWS = new Set<AnnotationBankView>(["memory", "disassembly"]);
/**
 * What a bank's coverage is when nothing has been said about it: the whole bank, disassembled.
 *
 * Exported so the one other place that has to *create* a bank entry — promoting a label into a bank
 * the sidecar does not yet describe (§13.3) — creates the same thing a new sidecar would, rather
 * than its own idea of an empty bank.
 */
export const DEFAULT_REGION: AnnotationRegion = {
  start: 0,
  end: ANNOTATION_BANK_LAST_OFFSET,
  type: "disassemble"
};

export function getAnnotationPath(nexPath: string): string {
  return `${nexPath}.dis`;
}

/** Whether a path names an annotation sidecar of any kind: `<file>.dis`. */
export function isAnnotationPath(path: string): boolean {
  return path.toLowerCase().endsWith(".dis");
}

export function isNexAnnotationPath(path: string): boolean {
  return path.toLowerCase().endsWith(".nex.dis");
}

export function getBankAddressOffset(offsetIndex: AnnotationOffsetIndex): number {
  return offsetIndex * ANNOTATION_BANK_SIZE;
}

export function getBankOffsetIndex(addressOffset: number): AnnotationOffsetIndex | undefined {
  if (!Number.isInteger(addressOffset) || addressOffset % ANNOTATION_BANK_SIZE !== 0) {
    return undefined;
  }
  const offsetIndex = addressOffset / ANNOTATION_BANK_SIZE;
  return isIntegerInRange(offsetIndex, 0, 3)
    ? offsetIndex as AnnotationOffsetIndex
    : undefined;
}

export function isValidLabelName(name: string): boolean {
  return name.length > 0 && name.length <= ANNOTATION_LABEL_MAX_LENGTH && LABEL_NAME_PATTERN.test(name);
}

export function createDefaultAnnotations(
  options: CreateDefaultAnnotationsOptions
): ProgramAnnotations {
  const banks: Record<string, BankAnnotation> = {};
  const machine = options.machine ?? "next";
  for (const bank of options.loadedBanks) {
    if (!isIntegerInRange(bank, 0, ANNOTATION_MACHINE_MAX_BANK[machine])) {
      continue;
    }
    banks[String(bank)] = {
      offsetIndex: options.getDefaultOffsetIndex?.(bank) ?? 0,
      regions: [{ ...DEFAULT_REGION }]
    };
  }

  const annotations: ProgramAnnotations = {
    schemaVersion: schemaVersionFor(machine),
    source: createSourceInfo(options),
    banks
  };
  if (machine !== "next") annotations.machine = machine;
  // --- A ROM label is always page-relative (§5.1): a ROM sidecar has no global labels at all.
  if (machine !== "rom") annotations.globalLabels = [];
  return annotations;
}

export function parseAnnotations(
  contents: string,
  options: ParseAnnotationsOptions = {}
): ParseAnnotationsResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (err) {
    return {
      diagnostics: [
        error("$", `Annotation JSON cannot be parsed: ${err instanceof Error ? err.message : err}`)
      ]
    };
  }
  return validateAnnotations(parsed, options);
}

export function validateAnnotations(
  value: unknown,
  options: ParseAnnotationsOptions = {}
): ParseAnnotationsResult {
  const diagnostics: AnnotationDiagnostic[] = [];
  if (!isRecord(value)) {
    return { diagnostics: [error("$", "Annotation root must be a JSON object.")] };
  }

  if (
    typeof value.schemaVersion !== "number" ||
    !ANNOTATION_READABLE_SCHEMA_VERSIONS.includes(value.schemaVersion)
  ) {
    diagnostics.push(
      error(
        "$.schemaVersion",
        `schemaVersion must be one of ${ANNOTATION_READABLE_SCHEMA_VERSIONS.join(", ")}.`
      )
    );
  }

  const machine = readMachine(value, diagnostics);
  const source = readSource(value.source, "$.source", diagnostics);
  const globalLabels = readLabels(value.globalLabels, "$.globalLabels", 0xffff, diagnostics);
  const banks = readBanks(value.banks, globalLabels, machine ?? "next", options, diagnostics);
  const debug = readDebug(value.debug, "$.debug", diagnostics, machine ?? "next");
  if (machine === "rom") {
    // --- A ROM label is page-relative, and a ROM's breakpoints belong to the program that set them.
    if (value.globalLabels !== undefined) {
      diagnostics.push(error("$.globalLabels", "A ROM sidecar cannot have global labels."));
    }
    if (value.debug !== undefined) {
      diagnostics.push(error("$.debug", "A ROM sidecar cannot have a debug subtree."));
    }
  }

  if (diagnostics.some((item) => item.severity === "error")) {
    return { diagnostics };
  }

  // --- Built in the order the file is written, so a file read and formatted again comes out the
  // --- same: schema, machine, source, global labels, banks, debug.
  const annotations = { schemaVersion: schemaVersionFor(machine) } as ProgramAnnotations;
  if (machine && machine !== "next") {
    annotations.machine = machine;
  }
  if (source) {
    annotations.source = source;
  }
  if (globalLabels.length > 0 || Array.isArray(value.globalLabels)) {
    annotations.globalLabels = globalLabels;
  }
  annotations.banks = banks;
  if (debug) {
    annotations.debug = debug;
  }
  return { annotations, diagnostics };
}

/**
 * Read `machine`, which schema 3 requires and schemas 1 and 2 forbid.
 *
 * Forbidden, not ignored, in a schema 2 file: a 48K sidecar that claimed version 2 would be read by
 * an older build as a Next sidecar, bank 5 and all, which is exactly what the version bump prevents.
 */
function readMachine(
  value: Record<string, any>,
  diagnostics: AnnotationDiagnostic[]
): AnnotationMachine | undefined {
  const version = value.schemaVersion;
  if (value.machine === undefined) {
    if (version === MACHINE_ANNOTATION_SCHEMA_VERSION) {
      diagnostics.push(error("$.machine", "A schema 3 sidecar must name its machine."));
    }
    return undefined;
  }
  if (!isAnnotationMachine(value.machine)) {
    diagnostics.push(
      error("$.machine", `machine must be one of ${ANNOTATION_MACHINES.join(", ")}.`)
    );
    return undefined;
  }
  if (typeof version === "number" && version < MACHINE_ANNOTATION_SCHEMA_VERSION) {
    diagnostics.push(error("$.machine", "machine requires schemaVersion 3."));
    return undefined;
  }
  return value.machine;
}

/**
 * Read the `debug` subtree.
 *
 * Absent is normal — every v1 file, and any v2 file with nothing to debug — and yields `undefined`
 * so the key is not written back for nothing. A malformed *entry* is dropped with a warning rather
 * than failing the file: a breakpoint nobody can place is worth less than the annotations beside it.
 */
function readDebug(
  value: unknown,
  path: string,
  diagnostics: AnnotationDiagnostic[],
  machine: AnnotationMachine = "next"
): AnnotationDebugState | undefined {
  const maxBank = ANNOTATION_MACHINE_MAX_BANK[machine];
  const isBankNumber = (bank: unknown): bank is number => isIntegerInRange(bank, 0, maxBank);
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    diagnostics.push(error(path, "debug must be a JSON object."));
    return undefined;
  }
  const labelBreakpoints = readLabelBreakpoints(value.labelBreakpoints, path, diagnostics, maxBank);
  const withLabels = (state: AnnotationDebugState): AnnotationDebugState =>
    labelBreakpoints.length ? { ...state, labelBreakpoints } : state;

  if (value.breakpoints === undefined) return withLabels({});
  if (!Array.isArray(value.breakpoints)) {
    diagnostics.push(error(`${path}.breakpoints`, "breakpoints must be an array."));
    return withLabels({});
  }

  const breakpoints: SidecarBreakpoint[] = [];
  value.breakpoints.forEach((entry, index) => {
    const entryPath = `${path}.breakpoints[${index}]`;
    if (!isRecord(entry)) {
      diagnostics.push(warning(entryPath, "Breakpoint must be a JSON object; ignored."));
      return;
    }
    const { bank, offset, kind, disabled } = entry as Record<string, unknown>;
    if (!isBankNumber(bank)) {
      diagnostics.push(warning(entryPath, `bank must be 0..${maxBank}; ignored.`));
      return;
    }
    if (!isBankOffset(offset)) {
      diagnostics.push(
        warning(entryPath, `offset must be 0..${ANNOTATION_BANK_LAST_OFFSET}; ignored.`)
      );
      return;
    }
    if (kind !== "exec" && kind !== "memRead" && kind !== "memWrite") {
      diagnostics.push(
        warning(entryPath, "kind must be exec, memRead or memWrite; ignored.")
      );
      return;
    }
    const breakpoint: SidecarBreakpoint = { bank, offset, kind };
    if (disabled === true) {
      breakpoint.disabled = true;
    }
    breakpoints.push(withStoredFilters(breakpoint, entry, entryPath, diagnostics));
  });

  return withLabels(breakpoints.length > 0 ? { breakpoints } : {});
}

/**
 * The label-anchored breakpoints in a `debug` subtree.
 *
 * A malformed entry is dropped with a warning rather than failing the file, for the same reason the
 * bank breakpoints beside it are: a breakpoint nobody can place is worth less than the annotations
 * around it.
 */
function readLabelBreakpoints(
  value: unknown,
  path: string,
  diagnostics: AnnotationDiagnostic[],
  maxBank: number
): SidecarLabelBreakpoint[] {
  const isBankNumber = (bank: unknown): bank is number => isIntegerInRange(bank, 0, maxBank);
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    diagnostics.push(warning(`${path}.labelBreakpoints`, "labelBreakpoints must be an array."));
    return [];
  }

  const entries: SidecarLabelBreakpoint[] = [];
  value.forEach((entry, index) => {
    const entryPath = `${path}.labelBreakpoints[${index}]`;
    if (!isRecord(entry)) {
      diagnostics.push(warning(entryPath, "Label breakpoint must be a JSON object; ignored."));
      return;
    }
    const { label, bank, kind, disabled } = entry as Record<string, unknown>;
    if (typeof label !== "string" || !isValidLabelName(label)) {
      diagnostics.push(warning(entryPath, "label must be a valid label name; ignored."));
      return;
    }
    // --- Absent is a *global* label, which is a meaningful state rather than a missing field.
    if (bank !== undefined && !isBankNumber(bank)) {
      diagnostics.push(warning(entryPath, `bank must be 0..${maxBank}; ignored.`));
      return;
    }
    if (kind !== "exec" && kind !== "memRead" && kind !== "memWrite") {
      diagnostics.push(warning(entryPath, "kind must be exec, memRead or memWrite; ignored."));
      return;
    }

    const breakpoint: SidecarLabelBreakpoint = { label, kind };
    // --- Narrowed by `isBankNumber` above; the `!== undefined` guard around it is what leaves the
    // --- type as `unknown` here rather than `number`.
    if (isBankNumber(bank)) breakpoint.bank = bank;
    if (disabled === true) breakpoint.disabled = true;
    entries.push(withStoredFilters(breakpoint, entry, entryPath, diagnostics));
  });
  return entries;
}

/**
 * Add a stored entry's condition and hit-count rule to the breakpoint read from it.
 *
 * A malformed filter field is dropped with a warning and the breakpoint kept — it then stops on
 * every hit, the safe direction (`readStoredBreakpointFilters`).
 */
function withStoredFilters<T extends SidecarBreakpointFilters>(
  breakpoint: T,
  entry: Record<string, unknown>,
  entryPath: string,
  diagnostics: AnnotationDiagnostic[]
): T {
  const { filters, problems } = readStoredBreakpointFilters(entry);
  problems.forEach((problem) => diagnostics.push(warning(entryPath, problem)));
  return { ...breakpoint, ...filters };
}

function isBankOffset(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= ANNOTATION_BANK_LAST_OFFSET
  );
}

export function getBankAnnotation(
  annotations: ProgramAnnotations,
  bank: number
): BankAnnotation | undefined {
  return annotations.banks[String(bank)];
}

export function getLabelsAtBankOffset(
  annotations: ProgramAnnotations,
  bank: number,
  bankOffset: number,
  offsetIndex?: AnnotationOffsetIndex
): ResolvedAnnotationLabel[] {
  const bankAnnotation = getBankAnnotation(annotations, bank);
  const effectiveOffsetIndex = offsetIndex ?? bankAnnotation?.offsetIndex ?? 0;
  const effectiveAddress = (getBankAddressOffset(effectiveOffsetIndex) + bankOffset) & 0xffff;
  const labels: ResolvedAnnotationLabel[] = [];

  for (const label of annotations.globalLabels ?? []) {
    if (label.value === effectiveAddress) {
      labels.push({ ...label, scope: "global" });
    }
  }

  for (const label of bankAnnotation?.localLabels ?? []) {
    if (label.value === bankOffset) {
      labels.push({ ...label, scope: "local", bank });
    }
  }

  return labels;
}

export function getOperandLabelCandidates(
  annotations: ProgramAnnotations,
  bank: number,
  operandValue: number,
  offsetIndex?: AnnotationOffsetIndex
): ResolvedAnnotationLabel[] {
  const bankAnnotation = getBankAnnotation(annotations, bank);
  const effectiveOffsetIndex = offsetIndex ?? bankAnnotation?.offsetIndex ?? 0;
  const bankRelativeValue = operandValue - getBankAddressOffset(effectiveOffsetIndex);
  const labels: ResolvedAnnotationLabel[] = [];

  for (const label of annotations.globalLabels ?? []) {
    if (label.value === operandValue) {
      labels.push({ ...label, scope: "global" });
    }
  }

  if (isIntegerInRange(bankRelativeValue, 0, ANNOTATION_BANK_LAST_OFFSET)) {
    for (const label of bankAnnotation?.localLabels ?? []) {
      if (label.value === bankRelativeValue) {
        labels.push({ ...label, scope: "local", bank });
      }
    }
  }

  return labels;
}

function createSourceInfo(options: CreateDefaultAnnotationsOptions): AnnotationSource {
  const source: AnnotationSource = {};
  const fileName = options.nexFileName ?? getFileName(options.nexPath);
  if (fileName) {
    source.fileName = fileName;
  }
  if (options.sha256) {
    source.sha256 = options.sha256;
  }
  return source;
}

function getFileName(path?: string): string | undefined {
  if (!path) {
    return undefined;
  }
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || undefined;
}

function readSource(
  value: unknown,
  path: string,
  diagnostics: AnnotationDiagnostic[]
): AnnotationSource | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    diagnostics.push(error(path, "source must be an object when specified."));
    return undefined;
  }

  const source: AnnotationSource = {};
  if (value.fileName !== undefined) {
    if (typeof value.fileName !== "string") {
      diagnostics.push(error(`${path}.fileName`, "fileName must be a string."));
    } else {
      source.fileName = value.fileName;
    }
  }
  if (value.sha256 !== undefined) {
    if (typeof value.sha256 !== "string") {
      diagnostics.push(error(`${path}.sha256`, "sha256 must be a string."));
    } else {
      source.sha256 = value.sha256;
    }
  }
  return source;
}

function readBanks(
  value: unknown,
  globalLabels: AnnotationLabel[],
  machine: AnnotationMachine,
  options: ParseAnnotationsOptions,
  diagnostics: AnnotationDiagnostic[]
): Record<string, BankAnnotation> {
  const banks: Record<string, BankAnnotation> = {};
  if (!isRecord(value)) {
    diagnostics.push(error("$.banks", "banks must be an object."));
    return banks;
  }

  const loadedBankSet = options.loadedBanks ? new Set(options.loadedBanks) : undefined;
  const maxBank = ANNOTATION_MACHINE_MAX_BANK[machine];
  for (const [bankKey, bankValue] of Object.entries(value)) {
    const bank = Number(bankKey);
    const bankPath = `$.banks.${bankKey}`;
    if (!/^(0|[1-9][0-9]*)$/.test(bankKey) || !isIntegerInRange(bank, 0, maxBank)) {
      diagnostics.push(error(bankPath, `Bank key must be an integer from 0 to ${maxBank}.`));
      continue;
    }
    if (loadedBankSet && !loadedBankSet.has(bank)) {
      diagnostics.push(warning(bankPath, "Bank is not present in the loaded NEX file."));
    }
    const bankAnnotation = readBankAnnotation(
      bankValue,
      bank,
      bankPath,
      globalLabels,
      machine,
      diagnostics
    );
    if (bankAnnotation) {
      banks[bankKey] = bankAnnotation;
    }
  }
  return banks;
}

function readBankAnnotation(
  value: unknown,
  _bank: number,
  path: string,
  globalLabels: AnnotationLabel[],
  machine: AnnotationMachine,
  diagnostics: AnnotationDiagnostic[]
): BankAnnotation | undefined {
  if (!isRecord(value)) {
    diagnostics.push(error(path, "Bank annotation must be an object."));
    return undefined;
  }

  const offsetIndex = readOffsetIndex(value.offsetIndex, `${path}.offsetIndex`, diagnostics);
  const lastView = readLastView(value.lastView, `${path}.lastView`, diagnostics);
  const decimalView = readOptionalBoolean(value.decimalView, `${path}.decimalView`, diagnostics);
  const localLabels = readLabels(value.localLabels, `${path}.localLabels`, ANNOTATION_BANK_LAST_OFFSET, diagnostics);
  const regions = normalizeRegions(value.regions, `${path}.regions`, diagnostics, machine);
  const lineAnnotations = readLineAnnotations(value.lineAnnotations, `${path}.lineAnnotations`, diagnostics);
  const comment = readBankComment(value.comment, `${path}.comment`, diagnostics);
  const sprites = readBankSprites(value.sprites, `${path}.sprites`, diagnostics);
  const graphics = readBankGraphics(value.graphics, `${path}.graphics`, diagnostics);
  const interop = readBankInterop(value.interop, `${path}.interop`, diagnostics);
  const operandReferences = readOperandReferences(
    value.operandReferences,
    `${path}.operandReferences`,
    globalLabels,
    localLabels,
    diagnostics
  );

  if (offsetIndex === undefined) {
    return undefined;
  }

  const annotation: BankAnnotation = {
    offsetIndex,
    regions
  };
  if (lastView) {
    annotation.lastView = lastView;
  }
  if (decimalView !== undefined) {
    annotation.decimalView = decimalView;
  }
  if (localLabels.length > 0 || Array.isArray(value.localLabels)) {
    annotation.localLabels = localLabels;
  }
  if (lineAnnotations && Object.keys(lineAnnotations).length > 0) {
    annotation.lineAnnotations = lineAnnotations;
  }
  if (operandReferences && Object.keys(operandReferences).length > 0) {
    annotation.operandReferences = operandReferences;
  }
  if (comment !== undefined) {
    annotation.comment = comment;
  }
  if (sprites !== undefined) {
    annotation.sprites = sprites;
  }
  if (graphics !== undefined) {
    annotation.graphics = graphics;
  }
  if (interop !== undefined) {
    annotation.interop = interop;
  }
  return annotation;
}

/**
 * A bank's named graphics. Every problem is a warning and drops only the bad entry, as with
 * `sprites`: losing a bank's labels over one graphic's description would be absurd.
 */
function readBankGraphics(
  value: unknown,
  path: string,
  diagnostics: AnnotationDiagnostic[]
): BankGraphic[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    diagnostics.push(warning(path, "graphics must be an array; it is ignored."));
    return undefined;
  }
  const graphics: BankGraphic[] = [];
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (
      !isRecord(item) ||
      !isBankOffset(item.offset) ||
      !isIntegerInRange(item.width, 1, 32) ||
      !isIntegerInRange(item.height, 1, 256) ||
      !isIntegerInRange(item.count, 1, ANNOTATION_BANK_SIZE) ||
      !GRAPHIC_LAYOUTS.has(item.layout as BankGraphicLayout)
    ) {
      diagnostics.push(warning(itemPath, "A graphic needs offset, width 1..32, height 1..256, count and layout; it is ignored."));
      return;
    }
    const graphic: BankGraphic = {
      offset: item.offset,
      width: item.width,
      height: item.height,
      count: item.count,
      layout: item.layout as BankGraphicLayout
    };
    if (item.mask !== undefined) {
      if (GRAPHIC_MASKS.has(item.mask as BankGraphicMask)) {
        if (item.mask !== "none") graphic.mask = item.mask as BankGraphicMask;
      } else {
        diagnostics.push(warning(`${itemPath}.mask`, "Graphic mask is not supported; it is ignored."));
      }
    }
    if (item.label !== undefined) {
      if (typeof item.label === "string" && isValidLabelName(item.label)) graphic.label = item.label;
      else diagnostics.push(warning(`${itemPath}.label`, "Graphic label must be a label name; it is ignored."));
    }
    graphics.push(graphic);
  });
  return graphics.length > 0 ? graphics.sort((a, b) => a.offset - b.offset) : undefined;
}

/**
 * Another tool's passthrough, kept as it was written. Only its shape is checked: it is data Klive
 * writes back, never data it acts on.
 */
function readBankInterop(
  value: unknown,
  path: string,
  diagnostics: AnnotationDiagnostic[]
): BankInterop | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    diagnostics.push(warning(path, "interop must be an object; it is ignored."));
    return undefined;
  }
  const interop: BankInterop = {};
  if (value.skool !== undefined) {
    if (isRecord(value.skool)) interop.skool = JSON.parse(JSON.stringify(value.skool)) as SkoolInterop;
    else diagnostics.push(warning(`${path}.skool`, "interop.skool must be an object; it is ignored."));
  }
  return Object.keys(interop).length > 0 ? interop : undefined;
}

/**
 * A bank's sprite settings, with every problem reported as a **warning** and the bad value dropped.
 *
 * Never an error: an error makes this build refuse the whole sidecar, and losing every label,
 * region and breakpoint over how a view reads the bytes would be absurd. A value this build does not
 * understand — a format a later build adds, say — simply falls back to the default.
 */
function readBankSprites(
  value: unknown,
  path: string,
  diagnostics: AnnotationDiagnostic[]
): BankSprites | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    diagnostics.push(warning(path, "Bank sprites must be an object; it is ignored."));
    return undefined;
  }

  const sprites: BankSprites = {};
  if (value.format !== undefined) {
    if (value.format === "8bit" || value.format === "4bit") {
      sprites.format = value.format;
    } else {
      diagnostics.push(warning(`${path}.format`, "Sprite format must be 8bit or 4bit; it is ignored."));
    }
  }
  if (value.offset !== undefined) {
    if (isBankOffset(value.offset)) {
      sprites.offset = value.offset;
    } else {
      diagnostics.push(
        warning(`${path}.offset`, "Sprite offset must be a bank offset ($0000-$3FFF); it is ignored.")
      );
    }
  }
  if (value.active !== undefined) {
    if (typeof value.active === "boolean") {
      if (value.active) sprites.active = true;
    } else {
      diagnostics.push(warning(`${path}.active`, "Sprites active flag must be a boolean; it is ignored."));
    }
  }
  return Object.keys(sprites).length > 0 ? sprites : undefined;
}

/**
 * A bank's comment, normalized the way the dialog normalizes it.
 *
 * A hand-edited sidecar can carry CRLF line breaks or a comment of nothing but spaces; reading it
 * through the same normalization as an edit means the model never holds a form the UI would not
 * have written.
 */
function readBankComment(
  value: unknown,
  path: string,
  diagnostics: AnnotationDiagnostic[]
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    diagnostics.push(error(path, "Bank comment must be a string."));
    return undefined;
  }
  const normalized = normalizeMultilineComment(value);
  if (normalized && normalized.length > BANK_COMMENT_SOFT_LIMIT) {
    diagnostics.push(
      warning(path, `Bank comment is longer than ${BANK_COMMENT_SOFT_LIMIT} characters.`)
    );
  }
  return normalized;
}

/**
 * Normalize a multi-line comment as the annotation dialogs store it.
 *
 * CRLF and CR become LF, trailing spaces and tabs are trimmed from every line, and a comment with
 * no visible characters becomes `undefined`. Leading indentation and blank lines in the middle are
 * kept: both are deliberate in a note someone laid out by hand.
 */
export function normalizeMultilineComment(comment: string): string | undefined {
  const normalized = comment
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");

  return normalized.trim().length > 0 ? normalized : undefined;
}

function readOffsetIndex(
  value: unknown,
  path: string,
  diagnostics: AnnotationDiagnostic[]
): AnnotationOffsetIndex | undefined {
  if (value === undefined) {
    return 0;
  }
  if (!isIntegerInRange(value, 0, 3)) {
    diagnostics.push(error(path, "offsetIndex must be 0, 1, 2, or 3."));
    return undefined;
  }
  return value as AnnotationOffsetIndex;
}

function readLastView(
  value: unknown,
  path: string,
  diagnostics: AnnotationDiagnostic[]
): AnnotationBankView | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!BANK_VIEWS.has(value as AnnotationBankView)) {
    diagnostics.push(error(path, "lastView must be memory or disassembly."));
    return undefined;
  }
  return value as AnnotationBankView;
}

function readOptionalBoolean(
  value: unknown,
  path: string,
  diagnostics: AnnotationDiagnostic[]
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    diagnostics.push(error(path, "decimalView must be a boolean."));
    return undefined;
  }
  return value;
}

function normalizeRegions(
  value: unknown,
  path: string,
  diagnostics: AnnotationDiagnostic[],
  machine: AnnotationMachine = "next"
): AnnotationRegion[] {
  const decodable = new Set<DecodedRegionType>(decodedRegionTypesFor(machine));
  if (value === undefined) {
    return [{ ...DEFAULT_REGION }];
  }
  if (!Array.isArray(value)) {
    diagnostics.push(error(path, "regions must be an array."));
    return [{ ...DEFAULT_REGION }];
  }
  if (value.length === 0) {
    return [{ ...DEFAULT_REGION }];
  }

  const regions: AnnotationRegion[] = [];
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      diagnostics.push(error(itemPath, "Region must be an object."));
      return;
    }
    if (!isIntegerInRange(item.start, 0, ANNOTATION_BANK_LAST_OFFSET)) {
      diagnostics.push(error(`${itemPath}.start`, "Region start must be in the range 0..0x3fff."));
      return;
    }
    if (!isIntegerInRange(item.end, 0, ANNOTATION_BANK_LAST_OFFSET)) {
      diagnostics.push(error(`${itemPath}.end`, "Region end must be in the range 0..0x3fff."));
      return;
    }
    if (item.start > item.end) {
      diagnostics.push(error(itemPath, "Region start must be less than or equal to end."));
      return;
    }
    if (!REGION_TYPES.has(item.type as AnnotationRegionType)) {
      diagnostics.push(error(`${itemPath}.type`, "Region type is not supported."));
      return;
    }
    if (item.type === "words" && (item.end - item.start + 1) % 2 !== 0) {
      diagnostics.push(error(itemPath, "Word regions must contain an even number of bytes."));
      return;
    }
    if (item.rowBytes !== undefined) {
      if (item.type !== "bytes") {
        diagnostics.push(error(`${itemPath}.rowBytes`, "rowBytes applies only to bytes regions."));
        return;
      }
      if (!isIntegerInRange(item.rowBytes, 1, MAX_ROW_BYTES)) {
        diagnostics.push(
          error(`${itemPath}.rowBytes`, `rowBytes must be in the range 1..${MAX_ROW_BYTES}.`)
        );
        return;
      }
    }
    // --- `decode` refines a `bytes` region into a Copper list or a DMA program (D3). An unknown or
    // --- unusable value is a warning, not an error: the region stays `bytes`, and the file loads.
    let type = item.type as AnnotationRegionType;
    if (item.decode !== undefined) {
      if (item.type !== "bytes") {
        diagnostics.push(warning(`${itemPath}.decode`, "decode applies only to bytes regions."));
      } else if (!DECODED_REGION_TYPES.has(item.decode as DecodedRegionType)) {
        diagnostics.push(warning(`${itemPath}.decode`, "decode is not supported; listed as bytes."));
      } else if (!decodable.has(item.decode as DecodedRegionType)) {
        diagnostics.push(
          warning(`${itemPath}.decode`, `decode ${item.decode} does not apply to this machine; listed as bytes.`)
        );
      } else {
        // --- An odd Copper region (a neighbouring edit can trim one) still loads: its last byte is
        // --- listed as `.defb`. The region dialog is what keeps new ones even.
        if (item.decode === "copper" && (item.end - item.start + 1) % 2 !== 0) {
          diagnostics.push(
            warning(itemPath, "Copper regions should contain an even number of bytes.")
          );
        }
        type = item.decode as DecodedRegionType;
      }
    }
    let origin: AnnotationRegionOrigin | undefined;
    if (item.origin !== undefined) {
      if (REGION_ORIGINS.has(item.origin as AnnotationRegionOrigin)) {
        origin = item.origin as AnnotationRegionOrigin;
      } else {
        diagnostics.push(warning(`${itemPath}.origin`, "Region origin is not supported; it is ignored."));
      }
    }
    regions.push({
      start: item.start,
      end: item.end,
      type,
      // --- Only when it says something: the default row size is written as no field at all. A
      // --- decoded region lays out its own rows, so the stored `rowBytes` is not carried over —
      // --- except a graphic's, which is written back as it was so the file round-trips.
      ...((type === "bytes" || type === "graphic") &&
      item.rowBytes !== undefined &&
      item.rowBytes !== MAX_ROW_BYTES
        ? { rowBytes: item.rowBytes as number }
        : {}),
      ...(origin ? { origin } : {})
    });
  });

  if (regions.length === 0) {
    return [{ ...DEFAULT_REGION }];
  }

  const sortedRegions = regions.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < sortedRegions.length; i++) {
    if (sortedRegions[i].start <= sortedRegions[i - 1].end) {
      diagnostics.push(error(path, "Regions must not overlap."));
      return sortedRegions;
    }
  }

  const normalized: AnnotationRegion[] = [];
  let cursor = 0;
  for (const region of sortedRegions) {
    if (region.start > cursor) {
      normalized.push({
        start: cursor,
        end: region.start - 1,
        type: "disassemble"
      });
    }
    normalized.push(region);
    cursor = region.end + 1;
  }
  if (cursor <= ANNOTATION_BANK_LAST_OFFSET) {
    normalized.push({
      start: cursor,
      end: ANNOTATION_BANK_LAST_OFFSET,
      type: "disassemble"
    });
  }

  return mergeAdjacentRegions(normalized);
}

function mergeAdjacentRegions(regions: AnnotationRegion[]): AnnotationRegion[] {
  const merged: AnnotationRegion[] = [];
  for (const region of regions) {
    const previous = merged[merged.length - 1];
    if (previous && previous.end + 1 === region.start && sameRegionLayout(previous, region)) {
      previous.end = region.end;
    } else {
      merged.push({ ...region });
    }
  }
  return merged;
}

function readLabels(
  value: unknown,
  path: string,
  maxValue: number,
  diagnostics: AnnotationDiagnostic[]
): AnnotationLabel[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    diagnostics.push(error(path, "Labels must be an array."));
    return [];
  }

  const labels: AnnotationLabel[] = [];
  const names = new Set<string>();
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      diagnostics.push(error(itemPath, "Label must be an object."));
      return;
    }
    if (typeof item.name !== "string" || !isValidLabelName(item.name)) {
      diagnostics.push(
        error(
          `${itemPath}.name`,
          `Label name must be a valid identifier up to ${ANNOTATION_LABEL_MAX_LENGTH} characters.`
        )
      );
      return;
    }
    if (names.has(item.name)) {
      diagnostics.push(error(`${itemPath}.name`, "Duplicate label name in the same scope."));
      return;
    }
    if (!isIntegerInRange(item.value, 0, maxValue)) {
      diagnostics.push(error(`${itemPath}.value`, `Label value must be in the range 0..0x${maxValue.toString(16)}.`));
      return;
    }
    names.add(item.name);
    labels.push({
      name: item.name,
      value: item.value
    });
  });
  return labels;
}

function readLineAnnotations(
  value: unknown,
  path: string,
  diagnostics: AnnotationDiagnostic[]
): Record<string, LineAnnotation> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    diagnostics.push(error(path, "lineAnnotations must be an object."));
    return undefined;
  }

  const annotations: Record<string, LineAnnotation> = {};
  for (const [offsetKey, annotationValue] of Object.entries(value)) {
    const itemPath = `${path}.${offsetKey}`;
    if (!isBankOffsetKey(offsetKey)) {
      diagnostics.push(error(itemPath, "Line annotation key must be a bank-relative offset."));
      continue;
    }
    if (!isRecord(annotationValue)) {
      diagnostics.push(error(itemPath, "Line annotation must be an object."));
      continue;
    }

    const annotation: LineAnnotation = {};
    if (annotationValue.synopsis !== undefined) {
      if (typeof annotationValue.synopsis !== "string") {
        diagnostics.push(error(`${itemPath}.synopsis`, "Synopsis comment must be a string."));
      } else if (annotationValue.synopsis.length > 0) {
        annotation.synopsis = annotationValue.synopsis;
      }
    }
    if (annotationValue.comment !== undefined) {
      if (typeof annotationValue.comment !== "string") {
        diagnostics.push(error(`${itemPath}.comment`, "End-of-line comment must be a string."));
      } else if (annotationValue.comment.length > 0) {
        annotation.comment = annotationValue.comment;
      }
    }
    if (annotationValue.endComment !== undefined) {
      if (typeof annotationValue.endComment !== "string") {
        diagnostics.push(warning(`${itemPath}.endComment`, "End comment must be a string; it is ignored."));
      } else if (annotationValue.endComment.length > 0) {
        annotation.endComment = annotationValue.endComment;
      }
    }
    if (
      annotation.synopsis !== undefined ||
      annotation.comment !== undefined ||
      annotation.endComment !== undefined
    ) {
      annotations[offsetKey] = annotation;
    }
  }
  return annotations;
}

function readOperandReferences(
  value: unknown,
  path: string,
  globalLabels: AnnotationLabel[],
  localLabels: AnnotationLabel[],
  diagnostics: AnnotationDiagnostic[]
): Record<string, OperandReference[]> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    diagnostics.push(error(path, "operandReferences must be an object."));
    return undefined;
  }

  const references: Record<string, OperandReference[]> = {};
  for (const [offsetKey, referenceValue] of Object.entries(value)) {
    const itemPath = `${path}.${offsetKey}`;
    if (!isBankOffsetKey(offsetKey)) {
      diagnostics.push(error(itemPath, "Operand reference key must be a bank-relative offset."));
      continue;
    }
    if (!Array.isArray(referenceValue)) {
      diagnostics.push(error(itemPath, "Operand references must be an array."));
      continue;
    }

    const normalizedReferences: OperandReference[] = [];
    referenceValue.forEach((item, index) => {
      const referencePath = `${itemPath}[${index}]`;
      if (!isRecord(item)) {
        diagnostics.push(error(referencePath, "Operand reference must be an object."));
        return;
      }
      if (!isIntegerInRange(item.operandIndex, 0, Number.MAX_SAFE_INTEGER)) {
        diagnostics.push(error(`${referencePath}.operandIndex`, "operandIndex must be a non-negative integer."));
        return;
      }
      if (!LABEL_SCOPES.has(item.scope as AnnotationLabelScope)) {
        diagnostics.push(error(`${referencePath}.scope`, "scope must be global or local."));
        return;
      }
      if (typeof item.name !== "string" || !isValidLabelName(item.name)) {
        diagnostics.push(error(`${referencePath}.name`, "name must be a valid label name."));
        return;
      }
      if (!labelExists(item.scope as AnnotationLabelScope, item.name, globalLabels, localLabels)) {
        diagnostics.push(error(referencePath, "Referenced label does not exist."));
        return;
      }
      normalizedReferences.push({
        operandIndex: item.operandIndex,
        scope: item.scope as AnnotationLabelScope,
        name: item.name
      });
    });

    if (normalizedReferences.length > 0) {
      references[offsetKey] = normalizedReferences;
    }
  }
  return references;
}

function labelExists(
  scope: AnnotationLabelScope,
  name: string,
  globalLabels: AnnotationLabel[],
  localLabels: AnnotationLabel[]
): boolean {
  const labels = scope === "global" ? globalLabels : localLabels;
  return labels.some((label) => label.name === name);
}

function isBankOffsetKey(value: string): boolean {
  return /^(0|[1-9][0-9]*)$/.test(value) && isIntegerInRange(Number(value), 0, ANNOTATION_BANK_LAST_OFFSET);
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function error(path: string, message: string): AnnotationDiagnostic {
  return { severity: "error", path, message };
}

function warning(path: string, message: string): AnnotationDiagnostic {
  return { severity: "warning", path, message };
}
