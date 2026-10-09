/*
 * What a unit-test run reports (`.plans/Z80_UNIT_TESTS_PLAN.md` D8, §4.2): shared by the runner, the
 * worker, the main process and the IDE. Plain data, so it crosses threads and IPC unchanged.
 */

/** A test's outcome, as JUnit later needs it (D8) */
export type UnitTestStatus = "passed" | "failed" | "error";

/** Why a test ended in an error rather than an assertion (D8) */
export type UnitTestErrorKind =
  /** A stack guard fired (D9) */
  | "stack"
  /** The test returned with RET instead of ending with TC_END */
  | "returned"
  /** A WPMEM watchpoint fired */
  | "breakpoint"
  /** The CPU halted with interrupts disabled */
  | "halt"
  /** The T-state budget ran out (D10) */
  | "timeout"
  /** The initialisation code did not return, or the test frame is unusable */
  | "setup";

/** A place in the sources */
export type UnitTestLocation = { file: string; line: number };

/** One test's result */
export type UnitTestResult = {
  /** The test's id: `Module1.UT_test2` */
  id: string;
  status: UnitTestStatus;
  errorKind?: UnitTestErrorKind;
  /** The T-states from the wrapper's first instruction to the stop (DeZog cannot measure this) */
  tstates: number;
  /** What went wrong: `ASSERTION failed at test.asm:12: A == B  (A=$07, B=$05)` */
  message?: string;
  /** The failing line: the assertion's invocation, the watchpoint's comment */
  location?: UnitTestLocation;
  /** The LOGPOINT lines the test produced (JUnit `system-out`, D11) */
  log?: string[];
};

/** A run's summary */
export type UnitTestSummary = {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  /** Stopped before every test ran */
  cancelled?: boolean;
  /**
   * The machine's clock in Hz (base clock times multiplier): emulated seconds are T-states divided
   * by it, the JUnit `time` of `.plans/UNIT_TESTS_CLI_PLAN.md` D7/T2
   */
  clockHz?: number;
};

/**
 * The tests' merged coverage (D17): every byte any test touched, flags OR-ed and counters summed, in
 * the core's profile offsets - what `coverage load` merges into the emulator's profile.
 */
export type UnitTestCoverage = {
  /** Names the offsets' layout (`profileLayoutOf`) */
  profileMachineId: string;
  bytes: { offset: number; flags: number; exec?: number; read?: number; write?: number; time?: number }[];
  instructions: number;
  timeTotal: number;
};

/** The events a run streams */
export type UnitTestEvent =
  | { kind: "started"; id: string }
  | { kind: "log"; id: string; text: string }
  | { kind: "result"; result: UnitTestResult }
  /** The run cannot start or continue: no test frame, an unsupported machine, ... */
  | { kind: "problem"; message: string }
  | { kind: "finished"; summary: UnitTestSummary; coverage?: UnitTestCoverage };

/** How a run behaves (D10, D19) */
export type UnitTestRunOptions = {
  /** Per-test budget in emulated seconds at the machine's clock (D10); default 1 */
  timeoutSeconds?: number;
  /** `rom`: boot to the ROM's main loop first (D7); `none`: reset only */
  boot?: "rom" | "none";
  /** Only the tests whose id matches one of these patterns (`*` is a wildcard) */
  include?: string[];
  /** Only these test ids (Run Failed) */
  ids?: string[];
  /** Collect and merge the tests' coverage (D17) */
  coverage?: boolean;
};

/** The `unitTests` section of `klive.project` (D19); every field optional */
export type UnitTestProjectSettings = {
  timeout?: number;
  boot?: "rom" | "none";
  stopAtStart?: boolean;
  machine?: string;
  model?: string;
  include?: string[];
};

/** Does a test id match a pattern? `*` matches any run of characters, case-sensitive */
export function testIdMatches(id: string, pattern: string): boolean {
  const regex = new RegExp(
    "^" + pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$"
  );
  return regex.test(id);
}

/** The tests a run selects (`include` patterns, then `ids`) */
export function selectTests<T extends { id: string }>(tests: T[], options: Pick<UnitTestRunOptions, "include" | "ids">): T[] {
  let selected = tests;
  if (options.include?.length) {
    selected = selected.filter((t) => options.include!.some((p) => testIdMatches(t.id, p)));
  }
  if (options.ids) {
    const wanted = new Set(options.ids);
    selected = selected.filter((t) => wanted.has(t.id));
  }
  return selected;
}

/** What the IDE asks the main process to run */
export type UnitTestRunRequest = {
  options?: UnitTestRunOptions;
};

/** What a run returned to the IDE */
export type UnitTestRunResponse = {
  summary: UnitTestSummary;
  results: UnitTestResult[];
  problems: string[];
  /** The machine the tests ran on */
  machineId?: string;
  coverage?: UnitTestCoverage;
};
