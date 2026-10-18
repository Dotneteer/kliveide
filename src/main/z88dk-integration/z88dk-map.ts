import fs from "fs";
import path from "path";

import { ExpressionValueType, type FileLine, type ListFileItem } from "@abstractions/CompilerInfo";
import type { ISourceFileItem } from "@main/compiler-common/abstractions";

/*
 * The z88dk linker map (`zcc -m -debug`) as Klive's debug tables (`.plans/Z88DK_INTEGRATION_PLAN.md`
 * §6, decision C8). The format is recorded in `.ai/z88dk/map-format.md`; everything here is a pure
 * function of the map's text, tested against the committed fixtures.
 */

export type Z88dkMapSymbol = {
  /** The name as the map writes it (escaped). */
  name: string;
  /** The full value: an address, a constant, or `bank << 16 | address` for banked code. */
  value: number;
  kind: string;
  scope: string;
  /** The linker defined it (`__head`, `__BANK_1_size`, ...). */
  linkerDefined: boolean;
  module: string;
  section: string;
  /** `file:line` or `file::function::level::block:line`, or empty. */
  location: string;
};

const LINE = /^(\S+)\s*= \$([0-9A-Fa-f]+) ; ([^,]*), ([^,]*), ([^,]*), ([^,]*), ([^,]*), ?(.*)$/;

export function parseZ88dkMap(text: string): Z88dkMapSymbol[] {
  const symbols: Z88dkMapSymbol[] = [];
  for (const raw of (text ?? "").split(/\r?\n/)) {
    const match = LINE.exec(raw.trimEnd());
    if (!match) continue;
    symbols.push({
      name: match[1],
      value: parseInt(match[2], 16),
      kind: match[3].trim(),
      scope: match[4].trim(),
      linkerDefined: match[5].trim() === "def",
      module: match[6].trim(),
      section: match[7].trim(),
      location: match[8].trim()
    });
  }
  return symbols;
}

/** Undoes the map's name escaping: `_xx` is the character with hex code xx (a `_` always starts one). */
export function unescapeMapName(name: string): string {
  return name.replace(/_([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

export type Z88dkLocation = {
  file: string;
  /** The C function the line belongs to (C records only). */
  func?: string;
  level?: number;
  block?: number;
  line: number;
};

/** Reads a map location; the line is the digits after the last `:` (paths may hold `:` and `::`). */
export function parseZ88dkLocation(location: string): Z88dkLocation | undefined {
  const match = /^(.*):(\d+)$/.exec(location ?? "");
  if (!match) return undefined;
  const line = Number(match[2]);
  const c = /^(.*?)::([^:]*)::(\d+)::(\d+)$/.exec(match[1]);
  if (c) return { file: c[1], func: c[2], level: Number(c[3]), block: Number(c[4]), line };
  return { file: match[1], line };
}

/** A symbol's value by its (escaped) name. */
export function mapValue(symbols: Z88dkMapSymbol[], name: string): number | undefined {
  return symbols.find((symbol) => symbol.name === name)?.value;
}

/**
 * The program's load address: `CRT_ORG_CODE` (the classic library's crt0); the new library's image
 * (`<name>_CODE.bin`) starts at `__CODE_head` instead, where `__head` is 0.
 */
export function loadAddressOf(symbols: Z88dkMapSymbol[], newLibraryImage = false): number | undefined {
  const org = mapValue(symbols, "CRT_ORG_CODE");
  if (org !== undefined) return org;
  return newLibraryImage ? mapValue(symbols, "__CODE_head") : mapValue(symbols, "__head");
}

/** One source line the map gives an address for. */
export type Z88dkLineRecord = {
  file: string;
  line: number;
  /** The 16-bit address. */
  address: number;
  /** The bank of banked code (`BANK_n` sections), else undefined. */
  bank?: number;
  func?: string;
  kind: "c" | "asm";
};

/**
 * The line records of the files `isProjectFile` accepts (resolved against `cwd`). Library and header
 * lines, and C lines outside functions (all at one address, no section), are left out.
 */
export function z88dkLineRecords(
  symbols: Z88dkMapSymbol[],
  cwd: string,
  isProjectFile: (absolutePath: string) => boolean
): Z88dkLineRecord[] {
  const records: Z88dkLineRecord[] = [];
  for (const symbol of symbols) {
    const kind = symbol.name.startsWith("__C_LINE_") ? "c" : symbol.name.startsWith("__ASM_LINE_") ? "asm" : undefined;
    if (!kind || !symbol.section) continue;
    const location = parseZ88dkLocation(symbol.location);
    if (!location || location.line <= 0) continue;
    if (kind === "c" && !location.func) continue;
    const file = normalizeFile(path.isAbsolute(location.file) ? location.file : path.resolve(cwd, location.file));
    if (!isProjectFile(file)) continue;
    const bank = symbol.value > 0xffff ? symbol.value >>> 16 : undefined;
    records.push({ file, line: location.line, address: symbol.value & 0xffff, bank, func: location.func, kind });
  }
  // --- Address order, then line order: the lowest line at an address comes first
  return records.sort((a, b) => (a.bank ?? -1) - (b.bank ?? -1) || a.address - b.address || a.line - b.line);
}

export type Z88dkLineDebug = {
  sourceFileList: ISourceFileItem[];
  sourceMap: Record<number, FileLine>;
  listFileItems: ListFileItem[];
};

/**
 * Klive's line tables from the line records. sccz80 reads one line ahead, so two lines can share an
 * address whose code is the lower line's (`.ai/z88dk/map-format.md`): the address maps to the
 * **lowest** line, while every recorded line still gets its list item, so a breakpoint on the higher
 * line binds.
 * @param partitionOf the memory partition of an address in a bank (the 128K's bank, the Next's 8K page)
 * @param segmentOf the output segment that holds a bank, so the IDE resolves the line's partition
 */
export function z88dkLineDebug(
  records: Z88dkLineRecord[],
  partitionOf: (bank: number, address: number) => number = (bank) => bank,
  segmentOf?: (bank: number) => number | undefined
): Z88dkLineDebug {
  const sourceFileList: ISourceFileItem[] = [];
  const fileIndex = new Map<string, number>();
  const indexOf = (file: string) => {
    let index = fileIndex.get(file);
    if (index === undefined) {
      index = sourceFileList.length;
      sourceFileList.push({ filename: file, includes: [] } as unknown as ISourceFileItem);
      fileIndex.set(file, index);
    }
    return index;
  };
  const sourceMap: Record<number, FileLine> = {};
  const listFileItems: ListFileItem[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const index = indexOf(record.file);
    const key = `${index}:${record.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // --- Banked addresses repeat across banks: the flat map keeps the resident code's
    if (record.bank === undefined && sourceMap[record.address] === undefined) {
      sourceMap[record.address] = { fileIndex: index, line: record.line };
    }
    listFileItems.push({
      fileIndex: index,
      address: record.address,
      lineNumber: record.line,
      ...(record.bank !== undefined ? { partition: partitionOf(record.bank, record.address) } : {}),
      ...(record.bank !== undefined && segmentOf?.(record.bank) !== undefined ? { segmentIndex: segmentOf(record.bank) } : {})
    });
  }
  return { sourceFileList, sourceMap, listFileItems };
}

/** The names a C program's symbols are known by in Watch, the memory views and the disassembly. */
export type Z88dkSymbolTable = Record<
  string,
  {
    name: string;
    type: number;
    value: { _type: ExpressionValueType; _value: number };
    partition?: number;
    definitionFileIndex?: number;
    definitionLine?: number;
  }
>;

const SYMBOL_LABEL = 1;
const SYMBOL_VAR = 2;

/**
 * The map's symbols for Watch: a C symbol `_name` from a project module is `name`; library and crt0
 * symbols keep their own names; the line and CDB records and linker bookkeeping are left out.
 */
export function z88dkSymbols(
  symbols: Z88dkMapSymbol[],
  cwd: string,
  isProjectFile: (absolutePath: string) => boolean,
  fileIndexOf?: (absolutePath: string) => number | undefined,
  partitionOf: (bank: number, address: number) => number = (bank) => bank
): Z88dkSymbolTable {
  const table: Z88dkSymbolTable = {};
  for (const symbol of symbols) {
    if (symbol.kind !== "addr" || symbol.linkerDefined) continue;
    if (/^__(C_LINE|ASM_LINE|CDBINFO)_/.test(symbol.name)) continue;
    const location = parseZ88dkLocation(symbol.location);
    const file = location
      ? normalizeFile(path.isAbsolute(location.file) ? location.file : path.resolve(cwd, location.file))
      : undefined;
    const ofProject = !!file && isProjectFile(file);
    const isC = ofProject && /^_[A-Za-z]/.test(symbol.name) && !!location?.func;
    const name = isC ? symbol.name.slice(1) : symbol.name;
    const key = name.toLowerCase();
    // --- A project's own symbol wins over a library one of the same name
    if (table[key] && !ofProject) continue;
    const bank = symbol.value > 0xffff ? symbol.value >>> 16 : undefined;
    const fileIndex = ofProject && file ? fileIndexOf?.(file) : undefined;
    table[key] = {
      name,
      type: /^(bss|data)_/.test(symbol.section) ? SYMBOL_VAR : SYMBOL_LABEL,
      value: { _type: ExpressionValueType.Integer, _value: symbol.value & 0xffff },
      ...(bank !== undefined ? { partition: partitionOf(bank, symbol.value & 0xffff) } : {}),
      ...(fileIndex !== undefined && location ? { definitionFileIndex: fileIndex, definitionLine: location.line } : {})
    };
  }
  return table;
}

/** The banks a banked build fills: `__BANK_n_head` with a non-zero `__BANK_n_size`. */
export function z88dkBanks(symbols: Z88dkMapSymbol[]): { bank: number; address: number; size: number }[] {
  const banks: { bank: number; address: number; size: number }[] = [];
  for (const symbol of symbols) {
    const match = /^__BANK_(\d+)_size$/.exec(symbol.name);
    if (!match || symbol.value === 0) continue;
    const head = mapValue(symbols, `__BANK_${match[1]}_head`);
    if (head === undefined) continue;
    banks.push({ bank: Number(match[1]), address: head & 0xffff, size: symbol.value });
  }
  return banks.sort((a, b) => a.bank - b.bank);
}

function normalizeFile(file: string): string {
  return file.replaceAll("\\", "/");
}

/**
 * A project-file test: the file exists, is under the project folder (or the build root's folder), and
 * is not in the z88dk install or a temp folder. Library modules name their sources relative to the
 * library's own tree (`stdio/fputc_callee.c`), which resolves into the project folder but is not there.
 */
export function projectFileTest(
  projectFolders: string[],
  z88dkRoot?: string,
  exists: (file: string) => boolean = fs.existsSync
): (file: string) => boolean {
  const folders = projectFolders.filter(Boolean).map((f) => normalizeFile(path.resolve(f)).replace(/\/?$/, "/"));
  const root = z88dkRoot ? normalizeFile(path.resolve(z88dkRoot)).replace(/\/?$/, "/") : undefined;
  const caseless = process.platform === "win32" || process.platform === "darwin";
  const fold = (s: string) => (caseless ? s.toLowerCase() : s);
  const known = new Map<string, boolean>();
  return (file: string) => {
    const normalized = fold(normalizeFile(file));
    if (root && normalized.startsWith(fold(root))) return false;
    if (!folders.some((folder) => normalized.startsWith(fold(folder)))) return false;
    let found = known.get(normalized);
    if (found === undefined) {
      found = exists(file);
      known.set(normalized, found);
    }
    return found;
  };
}
