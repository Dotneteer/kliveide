import { profileLocationOf, type ProfileLayout } from "./layouts/profileLayout";
import {
  PF_CODE,
  PF_EXECUTED,
  PF_INTERRUPT,
  PF_READ,
  PF_SELF_MODIFIED,
  PF_WRITTEN,
  type ProfileTouchedByte
} from "./profileTypes";

/*
 * The coverage exports (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D16): LCOV for Codecov, Coveralls
 * and GitLab (and G5.6's CLI), CSV for a spreadsheet, and Klive's own `.kcov`, which `coverage load`
 * merges back. Pure: the IDE gathers the data, these write the text.
 */

/** One source line's hits, as LCOV's `DA:` records them */
export type LcovLine = { line: number; hits: number };

/** One source file's lines */
export type LcovFile = { path: string; lines: LcovLine[] };

/**
 * An LCOV tracefile: per source file `SF:`, a `DA:` per line that emitted code, `LF:`/`LH:` (lines
 * found and hit), `end_of_record`
 * @param testName The `TN:` record (empty by default)
 */
export function toLcov(files: readonly LcovFile[], testName = ""): string {
  const out: string[] = [];
  for (const file of files) {
    if (file.lines.length === 0) continue;
    out.push(`TN:${testName}`);
    out.push(`SF:${file.path}`);
    const lines = [...file.lines].sort((a, b) => a.line - b.line);
    let hit = 0;
    for (const l of lines) {
      out.push(`DA:${l.line},${l.hits}`);
      if (l.hits > 0) hit++;
    }
    out.push(`LF:${lines.length}`);
    out.push(`LH:${hit}`);
    out.push("end_of_record");
  }
  return out.length ? `${out.join("\n")}\n` : "";
}

/** A parsed LCOV record (the tests read the export back as `genhtml` would) */
export type LcovRecord = { testName: string; path: string; lines: Map<number, number>; found: number; hit: number };

/** Reads an LCOV tracefile; throws on a malformed record */
export function parseLcov(text: string): LcovRecord[] {
  const records: LcovRecord[] = [];
  let current: LcovRecord | undefined;
  let testName = "";
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const colon = line.indexOf(":");
    const key = colon < 0 ? line : line.slice(0, colon);
    const value = colon < 0 ? "" : line.slice(colon + 1);
    const fail = (why: string) => {
      throw new Error(`LCOV line ${index + 1}: ${why}`);
    };
    switch (key) {
      case "TN":
        testName = value;
        break;
      case "SF":
        if (current) fail("SF inside a record");
        current = { testName, path: value, lines: new Map(), found: -1, hit: -1 };
        break;
      case "DA": {
        if (!current) fail("DA outside a record");
        const [l, h] = value.split(",").map((v) => Number(v));
        if (!Number.isInteger(l) || l < 1 || !Number.isInteger(h) || h < 0) fail(`bad DA '${value}'`);
        current!.lines.set(l, h);
        break;
      }
      case "LF":
        if (!current) fail("LF outside a record");
        current!.found = Number(value);
        break;
      case "LH":
        if (!current) fail("LH outside a record");
        current!.hit = Number(value);
        break;
      case "end_of_record":
        if (!current) fail("end_of_record outside a record");
        if (current!.found !== current!.lines.size) fail("LF does not match the DA count");
        if (current!.hit !== [...current!.lines.values()].filter((h) => h > 0).length) fail("LH does not match the hit DA count");
        records.push(current!);
        current = undefined;
        break;
      default:
        // --- FN/FNDA/BRDA... records other tools write; Klive writes none
        break;
    }
  });
  if (current) throw new Error("LCOV: the last record has no end_of_record");
  return records;
}

/** A flag byte as letters: E C R W S X, '-' for a clear bit */
export function flagLetters(flags: number): string {
  return (
    (flags & PF_EXECUTED ? "E" : "-") +
    (flags & PF_CODE ? "C" : "-") +
    (flags & PF_READ ? "R" : "-") +
    (flags & PF_WRITTEN ? "W" : "-") +
    (flags & PF_SELF_MODIFIED ? "S" : "-") +
    (flags & PF_INTERRUPT ? "X" : "-")
  );
}

/**
 * The CSV export: one row per touched physical byte - its profile offset, partition (label),
 * address in the partition, flags, and the counters where kept
 * @param labels The machine's partition labels (`getPartitionLabels`)
 * @param excludeRom Leave ROM bytes out (T11's "Exclude ROM")
 */
export function toCoverageCsv(
  bytes: readonly ProfileTouchedByte[],
  layout: ProfileLayout,
  labels: Record<number, string> = {},
  excludeRom = false
): string {
  const rows = ["offset,partition,address,flags,exec,read,write,time"];
  for (const b of bytes) {
    const location = profileLocationOf(layout, b.offset);
    if (excludeRom && location?.rom) continue;
    const partition = location?.partition === undefined ? "" : (labels[location.partition] ?? String(location.partition));
    const address = location ? hex4(location.address) : "";
    rows.push(
      [
        hex(b.offset, 6),
        partition,
        address,
        flagLetters(b.flags),
        b.exec ?? "",
        b.read ?? "",
        b.write ?? "",
        b.time ?? ""
      ].join(",")
    );
  }
  return `${rows.join("\n")}\n`;
}

/** Klive's own coverage file (`.kcov`): JSON, merged back by `coverage load` */
export type KcovFile = {
  format: "kcov";
  version: 1;
  /** The machine the run was on, and the layout its offsets are in */
  machineId: string;
  layout: { id: string; flagBytes: number; fingerprint: string };
  timeUnit: string;
  instructions: number;
  timeTotal: number;
  /** Per touched byte: offset, flags, then exec, read, write and time when the run kept counters */
  bytes: (number[])[];
};

/** A layout's fingerprint: a run's offsets mean the same only on the same layout */
export function layoutFingerprint(layout: ProfileLayout): string {
  const regions = layout.regions.map((r) => `${r.partition}@${r.start}${r.size ? `+${r.size}` : ""}${r.rom ? "r" : ""}`).join(";");
  return `${layout.id}/${layout.flagBytes}/${layout.partitionSize}/${regions}`;
}

export function toKcov(
  machineId: string,
  layout: ProfileLayout,
  run: { timeUnit: string; instructions: number; timeTotal: number },
  bytes: readonly ProfileTouchedByte[]
): string {
  const file: KcovFile = {
    format: "kcov",
    version: 1,
    machineId,
    layout: { id: layout.id, flagBytes: layout.flagBytes, fingerprint: layoutFingerprint(layout) },
    timeUnit: run.timeUnit,
    instructions: run.instructions,
    timeTotal: run.timeTotal,
    bytes: bytes.map((b) =>
      b.exec === undefined ? [b.offset, b.flags] : [b.offset, b.flags, b.exec, b.read ?? 0, b.write ?? 0, b.time ?? 0]
    )
  };
  return JSON.stringify(file);
}

/**
 * Reads a `.kcov` file for a merge into `layout`
 * @returns The run's bytes and totals, or the reason it cannot be merged
 */
export function parseKcov(
  text: string,
  layout: ProfileLayout
): { bytes: ProfileTouchedByte[]; instructions: number; timeTotal: number; machineId: string } | string {
  let file: Partial<KcovFile>;
  try {
    file = JSON.parse(text);
  } catch {
    return "The file is not a Klive coverage file (it is not JSON)";
  }
  if (file.format !== "kcov" || file.version !== 1 || !Array.isArray(file.bytes)) {
    return "The file is not a Klive coverage file (.kcov version 1)";
  }
  if (file.layout?.fingerprint !== layoutFingerprint(layout)) {
    return `The file was recorded on another machine's memory layout (${file.machineId ?? "unknown"})`;
  }
  const bytes: ProfileTouchedByte[] = [];
  for (const entry of file.bytes) {
    if (!Array.isArray(entry) || entry.length < 2) return "The file's byte list is malformed";
    const [offset, flags, exec, read, write, time] = entry.map((v) => Number(v));
    if (!Number.isInteger(offset) || offset < 0 || offset >= layout.flagBytes) return `Offset ${offset} is outside the layout`;
    bytes.push(entry.length >= 6 ? { offset, flags, exec, read, write, time } : { offset, flags });
  }
  return {
    bytes,
    instructions: Number(file.instructions) || 0,
    timeTotal: Number(file.timeTotal) || 0,
    machineId: String(file.machineId ?? "")
  };
}

function hex(value: number, digits: number): string {
  return value.toString(16).toUpperCase().padStart(digits, "0");
}

function hex4(value: number): string {
  return hex(value & 0xffff, 4);
}
