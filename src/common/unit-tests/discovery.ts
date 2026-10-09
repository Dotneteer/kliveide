import { flattenSymbolEntries, type SymbolTables } from "@common/utils/flatten-symbols";
import { resolvedPartitionFor } from "@common/utils/source-breakpoint-partition";

/*
 * Unit-test discovery (`.plans/Z80_UNIT_TESTS_PLAN.md` §4.1, D1, T3, T4).
 *
 * DeZog's conventions, exactly: a test is a code label whose last segment starts with `UT_` - on
 * the source spelling, so `ut_x` is not a test - and its suite is the label's module (or dotted)
 * path. A program can run tests only when it defines the four `UNITTEST_*` labels the runner drives
 * (D2: the runner relies on labels, never on macro internals).
 *
 * Pure: reads a compilation (live or serialized) and returns plain data.
 */

/** The labels a DeZog-style unit-test include lays down (D1) */
export const UNITTEST_LABELS = {
  start: "UNITTEST_START",
  wrapper: "UNITTEST_TEST_WRAPPER",
  callAddr: "UNITTEST_CALL_ADDR",
  success: "UNITTEST_TEST_READY_SUCCESS",
  stackBottom: "UNITTEST_STACK_BOTTOM",
  stackTop: "UNITTEST_STACK"
} as const;

/** The prefix of a test label's last segment */
export const UNIT_TEST_PREFIX = "UT_";

/** The actionable message of a program that cannot run tests (D1) */
export const MISSING_LABELS_MESSAGE =
  "Include the unit-test macros and invoke UNITTEST_INITIALIZE (Testing → Add unit-test support).";

/** An address in the program, with the memory partition it lives in when the build knows it */
export type UnitTestAddress = { address: number; partition?: number };

/** One discovered test */
export type UnitTestCase = {
  /** Suite path and label joined with dots: `Module1.UT_test2` */
  id: string;
  /** The label's last segment, as written (T3) */
  label: string;
  /** The suite path: modules, or the dotted prefix of an sjasmplus label; `[]` at the root */
  suitePath: string[];
  /** The test's first instruction */
  address: number;
  /** Its memory partition, when banked */
  partition?: number;
  /** Where the label is defined */
  file?: string;
  line?: number;
};

/** The runner's labels (D1) */
export type UnitTestLabels = {
  start: UnitTestAddress;
  wrapper: UnitTestAddress;
  callAddr: UnitTestAddress;
  success: UnitTestAddress;
  stackBottom?: UnitTestAddress;
  stackTop?: UnitTestAddress;
};

/** What discovery found in a compilation */
export type UnitTestProgram = {
  tests: UnitTestCase[];
  /** Absent when the program lacks a required label; `problems` then says so */
  labels?: UnitTestLabels;
  /** Why the tests cannot run (D1), each actionable */
  problems: string[];
  /** Things worth knowing that do not stop a run (the stack guards skipped, ...) */
  notes: string[];
};

/** The parts of a compilation discovery reads */
export type DiscoverableOutput = SymbolTables & {
  sourceFileList?: { filename: string }[];
  listFileItems?: { fileIndex: number; lineNumber: number; segmentIndex?: number; address: number }[];
  segments?: { bank?: number; bankOffset?: number; startAddress: number }[];
};

/** `SymbolType.Label` (`@abstractions/CompilerInfo`), without importing the enum */
const SYMBOL_LABEL = 1;
/** `ExpressionValueType.Integer` */
const INTEGER = 2;

type SymbolInfoShape = {
  name?: string;
  writtenName?: string;
  type?: number;
  value?: { _type?: number; _value?: unknown };
  partition?: number;
  definitionFileIndex?: number;
  definitionLine?: number;
};

/**
 * Finds the tests and the runner's labels of a compilation
 * @param output The compilation (Klive assembler or sjasmplus)
 * @param machineId The machine, which decides how a bank maps to a partition (the Next's 8K pages)
 */
export function discoverUnitTests(output: DiscoverableOutput | undefined, machineId?: string): UnitTestProgram {
  const tests: UnitTestCase[] = [];
  const problems: string[] = [];
  const notes: string[] = [];
  const entries = flattenSymbolEntries(output);

  const fileOf = (info: SymbolInfoShape) =>
    info.definitionFileIndex === undefined ? undefined : output?.sourceFileList?.[info.definitionFileIndex]?.filename;

  // --- A Klive symbol's partition comes from the segment its defining line was assembled into
  const partitionOf = (info: SymbolInfoShape, address: number): number | undefined => {
    if (info.partition !== undefined) return info.partition;
    if (info.definitionFileIndex === undefined || info.definitionLine === undefined) return undefined;
    // --- A label-only line emits nothing: the next line of the file that does names the segment
    let item: { segmentIndex?: number; lineNumber: number } | undefined;
    for (const li of output?.listFileItems ?? []) {
      if (li.fileIndex !== info.definitionFileIndex || li.lineNumber < info.definitionLine) continue;
      if (li.segmentIndex === undefined || (li.address & 0xffff) !== address) continue;
      if (!item || li.lineNumber < item.lineNumber) item = li;
    }
    if (item?.segmentIndex === undefined) return undefined;
    return resolvedPartitionFor(output?.segments?.[item.segmentIndex], address, machineId);
  };

  const addressOf = (info: SymbolInfoShape): number | undefined => {
    const value = info?.value;
    return value?._type === INTEGER && typeof value._value === "number" ? value._value & 0xffff : undefined;
  };

  // --- The runner's labels: global, looked up case-insensitively
  const labelAt = (name: string): UnitTestAddress | undefined => {
    const entry = entries.get(name.toLowerCase()) ?? entries.get(name);
    if (!entry) return undefined;
    const info = entry.info as SymbolInfoShape;
    const address = addressOf(info);
    if (address === undefined) return undefined;
    const partition = partitionOf(info, address);
    return partition === undefined ? { address } : { address, partition };
  };

  for (const [, entry] of entries) {
    const info = entry.info as SymbolInfoShape;
    if (info?.type !== undefined && info.type !== SYMBOL_LABEL) continue;
    const address = addressOf(info);
    if (address === undefined) continue;

    // --- The source spelling (T3): sjasmplus keeps the dotted name as written in `name`; the Klive
    // --- assembler keeps a lower-cased key and the written name beside it
    const segments = spelledSegments(output, entry, info);
    const label = segments[segments.length - 1];
    if (!label.startsWith(UNIT_TEST_PREFIX)) continue;
    const suitePath = segments.slice(0, -1);
    const partition = partitionOf(info, address);
    const file = fileOf(info);
    tests.push({
      id: segments.join("."),
      label,
      suitePath,
      address,
      ...(partition !== undefined ? { partition } : {}),
      ...(file ? { file } : {}),
      ...(info.definitionLine !== undefined ? { line: info.definitionLine } : {})
    });
  }

  // --- Source order: by file, then line; address for what has no position
  const fileRank = (t: UnitTestCase) => {
    const index = output?.sourceFileList?.findIndex((f) => f.filename === t.file) ?? -1;
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  tests.sort((a, b) => fileRank(a) - fileRank(b) || (a.line ?? 0) - (b.line ?? 0) || a.address - b.address);

  const start = labelAt(UNITTEST_LABELS.start);
  const wrapper = labelAt(UNITTEST_LABELS.wrapper);
  const callAddr = labelAt(UNITTEST_LABELS.callAddr);
  const success = labelAt(UNITTEST_LABELS.success);
  let labels: UnitTestLabels | undefined;
  if (start && wrapper && callAddr && success) {
    const stackBottom = labelAt(UNITTEST_LABELS.stackBottom);
    const stackTop = labelAt(UNITTEST_LABELS.stackTop);
    labels = {
      start,
      wrapper,
      callAddr,
      success,
      ...(stackBottom ? { stackBottom } : {}),
      ...(stackTop ? { stackTop } : {})
    };
    if (!stackBottom || !stackTop) {
      notes.push(
        `No ${UNITTEST_LABELS.stackBottom}/${UNITTEST_LABELS.stackTop} labels: the stack overflow and underflow guards are skipped.`
      );
    }
  } else if (tests.length) {
    const missing = Object.entries({ start, wrapper, callAddr, success })
      .filter(([, value]) => !value)
      .map(([key]) => UNITTEST_LABELS[key as keyof typeof UNITTEST_LABELS]);
    problems.push(`${MISSING_LABELS_MESSAGE} Missing: ${missing.join(", ")}.`);
  }

  return { tests, ...(labels ? { labels } : {}), problems, notes };
}

/** A flattened symbol's dotted name, each segment as the source wrote it (T3) */
function spelledSegments(
  output: SymbolTables | undefined,
  entry: { modulePath: string[]; key: string; info: unknown },
  info: SymbolInfoShape
): string[] {
  // --- sjasmplus: the SLD name, dotted and as written, whatever the key
  if (!entry.modulePath.length && info.name && info.name.toLowerCase() === entry.key.toLowerCase() && info.name.includes(".")) {
    return info.name.split(".");
  }
  const last = info.writtenName ?? (info.name && info.name.toLowerCase() === entry.key.toLowerCase() ? info.name : entry.key);
  return [...spellModulePath(output, entry.modulePath), last];
}

/**
 * The module path as written: the Klive assembler records each module's written name
 * (`AssemblyModule.writtenName`); `flattenSymbolEntries` reports keys, so this walks the modules
 * again to spell them.
 */
export function spellModulePath(output: SymbolTables | undefined, path: string[]): string[] {
  const spelled: string[] = [];
  let tables: (SymbolTables & { writtenName?: string }) | undefined = output;
  for (const key of path) {
    const module = tables?.nestedModules?.[key] as (SymbolTables & { writtenName?: string }) | undefined;
    spelled.push(module?.writtenName ?? key);
    tables = module;
  }
  return spelled;
}
