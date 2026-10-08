import { csvCell, csvRow } from "./csv";
import { HistoryKind, type HistoryRecord, type HistoryRegisters } from "./historyRecord";
import { historyRowCells, type HistoryRowCells, type HistoryRowInput } from "./historyRow";
import { formatRegisterDiff, registerDiff } from "./registerDiff";
import type { HistoryServiceSpan } from "./serviceSpans";

/*
 * The execution history as a text or CSV trace (`.plans/TRACE_EXPORT_PLAN.md`, G4.5). One pure
 * exporter turns decoded records into lines; the renderer supplies what it owns (the disassembly,
 * source locations, partition labels) through resolvers. The `history` command, "Copy rows as text"
 * and `history-export` all write their lines with it (D14), so there is one formatter.
 *
 * The defaults are made for diffing two runs (§1, T1-T3): time is relative to the range's first
 * record, the counts that depend on how long the machine waited are masked, and nothing in the
 * header changes between two exports of the same run.
 */

/** The columns, in the order a row writes them whatever order they were chosen in (D2) */
export const TRACE_COLUMNS = [
  "seq",
  "step",
  "frame",
  "tact",
  "addr",
  "bytes",
  "instr",
  "source",
  "changes",
  "regs",
  "flags",
  "ctx"
] as const;
export type TraceColumn = (typeof TRACE_COLUMNS)[number];

/** The diff-friendly default (D2) */
export const DEFAULT_TRACE_COLUMNS: readonly TraceColumn[] = ["frame", "tact", "addr", "bytes", "instr", "changes"];
/** The Execution History document's columns (`-columns viewer`, the `history` command) */
export const VIEWER_TRACE_COLUMNS: readonly TraceColumn[] = ["step", "tact", "addr", "bytes", "instr", "source", "changes"];

export type TraceFormat = "text" | "csv";

export type TraceExportOptions = {
  format: TraceFormat;
  columns: readonly TraceColumn[];
  /** Absolute frame and sequence numbers instead of relative ones (D3) */
  absolute: boolean;
  /** Write the HALT, display-run and DMA-hold counts instead of masking them (D6) */
  repeats: boolean;
  /** Interrupt service: kept, dropped, or dropped with a one-line marker per span (D7) */
  interrupts: "keep" | "drop" | "dropWithMarkers";
  /** The `;` comment header of a text trace (D9) */
  header: boolean;
  /** A UTF-8 byte order mark (T7: Excel on Windows needs one) */
  bom: boolean;
};

/** The defaults of `history-export` */
export function defaultTraceOptions(format: TraceFormat = "text"): TraceExportOptions {
  return {
    format,
    columns: DEFAULT_TRACE_COLUMNS,
    absolute: false,
    repeats: false,
    interrupts: "keep",
    header: true,
    bom: false
  };
}

/** What the renderer knows about a record */
export type TraceResolvers = {
  /** The disassembled instruction (`HistoryDisassemblyCache`) */
  instruction(record: HistoryRecord): Promise<{ text: string; length: number } | undefined>;
  /** `file.asm:123`, when the address maps to source */
  source?(record: HistoryRecord): string | undefined;
  /** The partition label of PC (`R0`, `0A`), when the machine has partitions */
  partitionLabel?(record: HistoryRecord): string | undefined;
  /** The memory map at the record (`historyContextDecoder().describe`) */
  describeContext?(record: HistoryRecord): string;
  /**
   * The filter (D8): whether a record's row is written; `text` is its instruction, or its event
   * text. Records left out still give the row before them its "after" state.
   */
  include?(record: HistoryRecord, text: string): boolean;
};

/** What the header says, and what the rows need beyond the records */
export type TraceMeta = {
  /** The machine whose context decoder reads the records (`historyMachineId`) */
  machineId?: string;
  /** The ring's newest record: the `step` column counts back from it */
  newestSequence: number;
  /** The registers after the range's last record: the next record's, or the live CPU (T4) */
  afterLast?: HistoryRegisters;
  appVersion?: string;
  machineName?: string;
  /** The range, for the header */
  range?: { first: number; last: number; firstFrame: number; lastFrame: number };
  /** What the frame tact counts in (`historyContextDecoder().frameTactUnit`) */
  tactUnit?: string;
  /** The compilation's main file (labels and source come from the current one, D12) */
  mainFile?: string;
  /** Where the history cursor is (G4.4 D17: the export still covers the present's ring) */
  cursorStep?: number;
  /** The filter's text, for the header */
  filter?: string;
};

// ------------------------------------------------------------------------------------------------
// Parsing

/** The settings key of the folder the last trace was exported to */
export const HISTORY_EXPORT_FOLDER = "historyExport";

/** The save dialog's file types */
export const TRACE_FILE_FILTERS = [
  { name: "Text trace", extensions: ["txt", "log", "trace"] },
  { name: "CSV trace", extensions: ["csv"] }
];

/** The format a file name asks for (D1), or undefined */
export function traceFormatOfName(file: string): TraceFormat | undefined {
  if (/\.csv$/i.test(file)) return "csv";
  if (/\.(txt|log|trace)$/i.test(file)) return "text";
  return undefined;
}

/**
 * `-columns`: `default`, `viewer`, `all`, or a comma-separated list of column ids
 * @returns The columns in their canonical order, or the error's text
 */
export function parseTraceColumns(text: string): readonly TraceColumn[] | string {
  const t = text.trim().toLowerCase();
  if (t === "default") return DEFAULT_TRACE_COLUMNS;
  if (t === "viewer") return VIEWER_TRACE_COLUMNS;
  if (t === "all") return TRACE_COLUMNS;
  const ids = t.split(/[,\s]+/).filter((id) => id);
  if (!ids.length) return "No columns given";
  for (const id of ids) {
    if (!(TRACE_COLUMNS as readonly string[]).includes(id)) {
      return `Unknown column '${id}'; use default, viewer, all, or some of ${TRACE_COLUMNS.join(",")}`;
    }
  }
  return TRACE_COLUMNS.filter((c) => ids.includes(c));
}

/**
 * The `history-export` command line (§4.3): Debug › Export Execution History… and the document's
 * Export button build theirs with it
 */
export function historyExportCommandText(
  file: string,
  options: { from?: number; filter?: string; noInterrupts?: boolean; overwrite?: boolean } = {}
): string {
  const parts = ["history-export", `"${file.replace(/"/g, "")}"`];
  if (options.from !== undefined) parts.push("-from", `#${options.from}`);
  const filter = options.filter?.replace(/"/g, "").trim();
  if (filter) parts.push("-filter", `"${filter}"`);
  if (options.noInterrupts) parts.push("-nointerrupts");
  if (options.overwrite) parts.push("-f");
  return parts.join(" ");
}

// ------------------------------------------------------------------------------------------------
// The header (D9)

/** The register order of the `regs` column (D4) */
const REGS_TEXT = "AF BC DE HL AF' BC' DE' HL' IX IY SP I R WZ";
const REGS_CSV = ["AF", "BC", "DE", "HL", "AF'", "BC'", "DE'", "HL'", "IX", "IY", "SP", "I", "R", "WZ"];

/**
 * The header's lines, without the comment character: a text trace writes them as `;` lines, a CSV
 * trace's command prints them to the output pane (Q6). Never the export time, so two exports of the
 * same run are identical.
 */
export function traceHeaderLines(meta: TraceMeta, options: TraceExportOptions): string[] {
  const n = (v: number) => v.toLocaleString("en-US");
  const lines = [`Klive IDE${meta.appVersion ? ` ${meta.appVersion}` : ""} execution trace`];
  if (meta.machineName) lines.push(`Machine: ${meta.machineName}`);
  const r = meta.range;
  if (r) {
    const count = r.last - r.first + 1;
    const frames = options.absolute ? `${r.firstFrame}–${r.lastFrame}` : `0–${r.lastFrame - r.firstFrame}`;
    lines.push(`Range: #${r.first}..#${r.last}, ${n(count)} record${count === 1 ? "" : "s"}, frames ${frames}`);
  }
  lines.push(`Columns: ${options.columns.join(" ")}`);
  const time: string[] = [];
  if (options.columns.includes("frame") || options.columns.includes("seq")) {
    time.push(
      options.absolute
        ? "frame and seq absolute"
        : `frame and seq relative to the range's first record${r ? ` (frame ${r.firstFrame}, #${r.first})` : ""}`
    );
  }
  if (options.columns.includes("step")) time.push("step counts back from the newest record (−1)");
  if (options.columns.includes("tact")) time.push(`tact is the position in the frame${meta.tactUnit ? `, in ${meta.tactUnit}` : ""}`);
  if (time.length) lines.push(`Time: ${time.join("; ")}`);
  lines.push(
    `Options: repeat counts ${options.repeats ? "written" : "masked (×*)"}; interrupt service ${
      options.interrupts === "keep" ? "kept" : options.interrupts === "drop" ? "dropped" : "dropped, with markers"
    }`
  );
  if (meta.filter) lines.push(`Filter: ${meta.filter}`);
  if (meta.mainFile) lines.push(`Main file: ${meta.mainFile} (labels and source lines from its current compilation)`);
  if (meta.cursorStep !== undefined) {
    lines.push(`History cursor: step ${signed(meta.cursorStep, "−")} (the trace covers the present's history)`);
  }
  if (options.format === "text" && options.columns.includes("regs")) {
    lines.push(`regs: ${REGS_TEXT}, before the instruction`);
  }
  if (options.format === "text" && options.columns.includes("flags")) lines.push("flags: IFF1 IFF2 IM");
  return lines;
}

// ------------------------------------------------------------------------------------------------
// Rows

/** A row's cells: the viewer's, and the columns only a trace has */
type TraceCells = HistoryRowCells & {
  record: HistoryRecord;
  seq: number;
  stepNumber: number;
  frame: number;
  partition: string;
  ctx: string;
  /** The count of an event that repeats (HALT, display NOPs, DMA hold) */
  repeat?: number;
};

type TraceBase = { frame: number; sequence: number };

function traceCells(input: HistoryRowInput, base: TraceBase | undefined, ctx = ""): TraceCells {
  const r = input.record;
  return {
    ...historyRowCells(input),
    record: r,
    seq: base ? r.sequence - base.sequence : r.sequence,
    stepNumber: input.step,
    frame: base ? r.frame - base.frame : r.frame,
    partition: input.partitionLabel ?? "",
    ctx,
    repeat:
      r.kind === HistoryKind.Halt || r.kind === HistoryKind.ForcedNop || r.kind === HistoryKind.DmaHold
        ? r.repeat
        : undefined
  };
}

/** The text layout: width and alignment of each column */
const TEXT_LAYOUT: Record<TraceColumn, [number, "start" | "end"]> = {
  seq: [8, "start"],
  step: [7, "start"],
  frame: [6, "start"],
  tact: [6, "start"],
  addr: [7, "end"],
  bytes: [11, "end"],
  instr: [22, "end"],
  source: [18, "end"],
  changes: [24, "end"],
  regs: [0, "end"],
  flags: [0, "end"],
  ctx: [0, "end"]
};

/** The columns a separator or marker line keeps before its text */
const PREFIX_COLUMNS: readonly TraceColumn[] = ["seq", "step", "frame", "tact"];

function textCell(c: TraceCells, column: TraceColumn): string {
  const regs = c.record.regs;
  switch (column) {
    case "seq":
      return String(c.seq);
    case "step":
      return c.step;
    case "frame":
      return String(c.frame);
    case "tact":
      return c.time;
    case "addr":
      return c.address;
    case "bytes":
      return c.bytes;
    case "instr":
      return c.instruction;
    case "source":
      return c.source;
    case "changes":
      return c.changes;
    case "regs":
      return registerValues(regs).join(" ");
    case "flags":
      return `${regs.iff1 ? 1 : 0} ${regs.iff2 ? 1 : 0} ${regs.interruptMode}`;
    case "ctx":
      return c.ctx;
  }
}

function pad(text: string, column: TraceColumn): string {
  const [width, align] = TEXT_LAYOUT[column];
  return align === "start" ? text.padStart(width) : text.padEnd(width);
}

/** A text line: fixed-width columns two spaces apart; a separator keeps its time columns */
function textLine(c: TraceCells, columns: readonly TraceColumn[], separatorText?: string): string {
  if (separatorText !== undefined) {
    const prefix = columns.filter((col) => PREFIX_COLUMNS.includes(col)).map((col) => pad(textCell(c, col), col));
    return [...prefix, separatorText].join("  ").trimEnd();
  }
  return columns
    .map((col) => pad(textCell(c, col), col))
    .join("  ")
    .trimEnd();
}

/** The CSV column names (T5: `part` beside `addr`; D6: `repeat` beside `instr`; D4: a column per register) */
export function traceCsvColumnNames(columns: readonly TraceColumn[]): string[] {
  return columns.flatMap((col) => {
    switch (col) {
      case "addr":
        return ["part", "addr"];
      case "instr":
        return ["instr", "repeat"];
      case "regs":
        return REGS_CSV;
      case "flags":
        return ["IFF1", "IFF2", "IM"];
      default:
        return [col];
    }
  });
}

function csvLine(
  c: TraceCells,
  columns: readonly TraceColumn[],
  options: TraceExportOptions,
  markerText?: string
): string {
  const regs = c.record.regs;
  const event = c.separator || markerText !== undefined;
  const cells = columns.flatMap((col): string[] => {
    switch (col) {
      case "seq":
        return [csvCell(c.seq, true)];
      case "step":
        return [csvCell(c.stepNumber, true)];
      case "frame":
        return [csvCell(c.frame, true)];
      case "tact":
        return [csvCell(c.record.frameTact, true)];
      case "addr":
        return event ? ["", ""] : [csvCell(c.partition), csvCell(hex(regs.pc, 4))];
      case "bytes":
        return [event ? "" : csvCell(c.bytes)];
      case "instr":
        return [
          csvCell(markerText ?? c.instruction),
          markerText === undefined && options.repeats && c.repeat !== undefined ? csvCell(c.repeat, true) : ""
        ];
      case "source":
        return [csvCell(c.source)];
      case "changes":
        return [csvCell(c.changes)];
      case "regs":
        return registerValues(regs).map((v) => csvCell(v));
      case "flags":
        return [csvCell(regs.iff1 ? 1 : 0, true), csvCell(regs.iff2 ? 1 : 0, true), csvCell(regs.interruptMode, true)];
      case "ctx":
        return [csvCell(c.ctx)];
    }
  });
  return csvRow(cells);
}

function registerValues(regs: HistoryRegisters): string[] {
  return [
    hex(regs.af, 4),
    hex(regs.bc, 4),
    hex(regs.de, 4),
    hex(regs.hl, 4),
    hex(regs.af_, 4),
    hex(regs.bc_, 4),
    hex(regs.de_, 4),
    hex(regs.hl_, 4),
    hex(regs.ix, 4),
    hex(regs.iy, 4),
    hex(regs.sp, 4),
    hex(regs.ir >> 8, 2),
    hex(regs.ir & 0xff, 2),
    hex(regs.wz, 4)
  ];
}

/** One line of text with the viewer's columns: the `history` command's, "Copy row" */
export function formatHistoryRow(input: HistoryRowInput): string {
  const c = traceCells(input, undefined);
  return textLine(c, VIEWER_TRACE_COLUMNS, c.separator ? c.instruction : undefined);
}

// ------------------------------------------------------------------------------------------------
// The exporter

/** An interrupt service being left out (D7) */
type DroppedSpan = {
  /** Its last sequence; Infinity for a service still running at the range's end */
  until: number;
  /** Its first record in the range */
  first: HistoryRecord;
  kind: HistoryKind;
  instructions: number;
};

/**
 * The trace's lines, header first, without line ends
 * @param pages The range's records, oldest first, in pages (§1.2: a later timeline option streams
 * more pages than the ring holds)
 * @param meta What the header says and the rows need
 * @param spans The ring's outermost interrupt service spans (`findServiceSpans`), for D7
 * @param options The export's options
 * @param resolvers The disassembly, source, partition and context of a record
 */
export async function* exportTrace(
  pages: AsyncIterable<readonly HistoryRecord[]> | Iterable<readonly HistoryRecord[]>,
  meta: TraceMeta,
  spans: readonly HistoryServiceSpan[],
  options: TraceExportOptions,
  resolvers: TraceResolvers
): AsyncGenerator<string> {
  const csv = options.format === "csv";
  if (csv) {
    yield csvRow(traceCsvColumnNames(options.columns).map((name) => csvCell(name)));
  } else if (options.header) {
    for (const line of traceHeaderLines(meta, options)) yield `; ${line}`;
  }

  const sortedSpans = [...spans].sort((a, b) => a.first - b.first);
  let spanIndex = 0;
  let base: TraceBase | undefined;
  let dropped: DroppedSpan | undefined;
  // --- Markers mark a gap in a trace that otherwise has every row; a filter's trace has gaps anyway
  const markers = options.interrupts === "dropWithMarkers" && !resolvers.include;

  const inputOf = async (record: HistoryRecord, after: HistoryRegisters | undefined): Promise<HistoryRowInput> => {
    const isInstruction = record.kind === HistoryKind.Instruction;
    // --- T8: a record whose bytes the core could not all read is not decoded
    const instruction = isInstruction
      ? record.bytesTruncated
        ? { text: "?", length: undefined }
        : await resolvers.instruction(record)
      : undefined;
    return {
      record,
      step: record.sequence - meta.newestSequence - 1,
      machineId: meta.machineId,
      instruction: instruction?.text,
      length: instruction?.length,
      source: isInstruction ? resolvers.source?.(record) : undefined,
      changes: after && isInstruction ? formatRegisterDiff(registerDiff(record.regs, after)) : undefined,
      partitionLabel: resolvers.partitionLabel?.(record),
      repeats: csv ? "omit" : options.repeats ? "show" : "mask"
    };
  };

  const markerLine = (span: DroppedSpan, last: boolean): string | undefined => {
    if (!markers) return undefined;
    const what = span.kind === HistoryKind.Nmi ? "NMI service" : "interrupt service";
    const count = `${span.instructions.toLocaleString("en-US")} instruction${span.instructions === 1 ? "" : "s"}`;
    const text = `${what}, ${count}${last && span.until === Infinity ? ", unfinished" : ""}`;
    const c = traceCells({ record: span.first, step: span.first.sequence - meta.newestSequence - 1 }, base);
    return csv ? csvLine(c, options.columns, options, `… ${text} …`) : textLine(c, options.columns, `… ${text} …`);
  };

  /** The lines of one record (none, when it is dropped or filtered out) */
  const rowLines = async (record: HistoryRecord, after: HistoryRegisters | undefined): Promise<string[]> => {
    const out: string[] = [];
    // --- D3: relative to the range's first record, unless -absolute
    if (!options.absolute) base ??= { frame: record.frame, sequence: record.sequence };
    if (options.interrupts !== "keep") {
      if (dropped && record.sequence > dropped.until) {
        const marker = markerLine(dropped, false);
        if (marker !== undefined) out.push(marker);
        dropped = undefined;
      }
      if (!dropped) {
        while (spanIndex < sortedSpans.length && sortedSpans[spanIndex].last < record.sequence) spanIndex++;
        const span = sortedSpans[spanIndex];
        if (span && span.first <= record.sequence) {
          dropped = { until: span.last, first: record, kind: span.kind, instructions: 0 };
        } else if (record.kind === HistoryKind.Int || record.kind === HistoryKind.Nmi) {
          // --- A service with no span is still running at the ring's end: dropped from its INT on
          dropped = { until: Infinity, first: record, kind: record.kind, instructions: 0 };
        }
      }
      if (dropped) {
        if (record.kind === HistoryKind.Instruction) dropped.instructions++;
        return out;
      }
    }
    const input = await inputOf(record, after);
    const c = traceCells(input, base, record.kind === HistoryKind.Instruction ? (resolvers.describeContext?.(record) ?? "") : "");
    if (resolvers.include && !resolvers.include(record, c.instruction)) return out;
    out.push(csv ? csvLine(c, options.columns, options) : textLine(c, options.columns, c.separator ? c.instruction : undefined));
    return out;
  };

  // --- A record's "after" is the next record's state, so each row waits for the next record
  let pending: HistoryRecord | undefined;
  for await (const page of pages as AsyncIterable<readonly HistoryRecord[]>) {
    for (const record of page) {
      if (pending) yield* await rowLines(pending, record.regs);
      pending = record;
    }
  }
  if (pending) yield* await rowLines(pending, meta.afterLast);
  if (dropped) {
    const marker = markerLine(dropped, true);
    if (marker !== undefined) yield marker;
  }
}

/** The file's text: the lines joined with the format's line end (CRLF for CSV), and the BOM when asked */
export async function collectTrace(
  lines: AsyncIterable<string>,
  options: Pick<TraceExportOptions, "format" | "bom">
): Promise<{ text: string; lines: number }> {
  const all: string[] = [];
  for await (const line of lines) all.push(line);
  const eol = options.format === "csv" ? "\r\n" : "\n";
  const body = all.length ? all.join(eol) + eol : "";
  return { text: (options.bom ? "﻿" : "") + body, lines: all.length };
}

function signed(value: number, minus: string): string {
  return String(value).replace("-", minus);
}

function hex(value: number, digits: number): string {
  return value.toString(16).toUpperCase().padStart(digits, "0");
}
