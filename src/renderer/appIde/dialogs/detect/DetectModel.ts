import type { UiReducer } from "@mvc/core/types";
import type { DetectionRequest, DetectionRun, DetectionTarget } from "@renderer/appIde/reverse/detection";

/*
 * The *Detect code and data* dialog's model (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §4.6): the
 * options, the per-bank proposals with an *Include* switch each, and where the run stands.
 */

export type DetectScopeChoice = "paged" | "all" | "rom";

export type DetectOptionsState = {
  scope: DetectScopeChoice;
  mode: DetectionRequest["mode"];
  reach: boolean;
  text: boolean;
  words: boolean;
  unknownAsData: boolean;
  screen: boolean;
};

export type DetectBusy = "detect" | "apply" | "undo" | "coverage" | undefined;

export type DetectRow = { target: DetectionTarget; include: boolean };

export type DetectEnvironment = {
  /** Why detection cannot run here at all (no coverage feature, advanced debugging off). */
  unavailable?: string;
  /** Whether the machine is paused, so the paging and the bytes hold still. */
  paused: boolean;
  /** Whether there is a detection this session can undo. */
  canUndo: boolean;
  /** Importing a SkoolKit file rather than detecting: the file (§6.4 reuses this dialog). */
  skoolPath?: string;
};

export type DetectState = {
  env: DetectEnvironment;
  options: DetectOptionsState;
  busy: DetectBusy;
  rows: DetectRow[];
  /** The last run's problem: no coverage, no active set. */
  problem?: string;
  /** What else the last run said: an import's mismatches and renames. */
  notes: string[];
  /** No coverage to detect from: the dialog offers to turn it on or load a run. */
  coverageMissing: boolean;
  /** What the last apply, undo or coverage action did. */
  message?: string;
  error?: string;
  /** Rows whose warning list is expanded. */
  expanded: number[];
};

export type DetectEvent =
  | { type: "envReplaced"; env: DetectEnvironment }
  | { type: "optionsChanged"; patch: Partial<DetectOptionsState> }
  | { type: "busyStarted"; busy: Exclude<DetectBusy, undefined> }
  | { type: "detectionSettled"; run: DetectionRun }
  | { type: "includeToggled"; index: number }
  | { type: "expandToggled"; index: number }
  | { type: "applied"; message: string }
  | { type: "undone"; message: string }
  | { type: "coverageChanged"; message: string }
  | { type: "failed"; message: string };

export const NO_COVERAGE_PREFIX = "There is no coverage";

export function initialState(env: DetectEnvironment): DetectState {
  return {
    env,
    options: { scope: "paged", mode: "fill", reach: true, text: false, words: false, unknownAsData: false, screen: true },
    busy: undefined,
    rows: [],
    notes: [],
    coverageMissing: false,
    expanded: []
  };
}

/** The request the options describe. */
export function requestOf(options: DetectOptionsState): DetectionRequest {
  return {
    scope: options.scope === "paged" ? { kind: "paged" } : options.scope === "all" ? { kind: "all" } : { kind: "rom" },
    mode: options.mode,
    reach: options.reach,
    text: options.text,
    words: options.words,
    unknown: options.unknownAsData ? "bytes" : "keep",
    screen: options.screen
  };
}

export const reduce: UiReducer<DetectState, DetectEvent> = (state, event) => {
  switch (event.type) {
    case "envReplaced":
      return { ...state, env: event.env };
    case "optionsChanged": {
      const options = { ...state.options, ...event.patch };
      // --- A proposal belongs to the options it was made with: changing them drops it
      return { ...state, options, rows: [], problem: undefined, message: undefined, error: undefined, expanded: [] };
    }
    case "busyStarted":
      return { ...state, busy: event.busy, error: undefined, message: undefined };
    case "detectionSettled":
      return {
        ...state,
        busy: undefined,
        rows: event.run.targets.map((target) => ({
          target,
          include: target.proposal.changes.length > 0
        })),
        problem: event.run.problem,
        notes: event.run.notes ?? [],
        coverageMissing: !!event.run.problem?.startsWith(NO_COVERAGE_PREFIX),
        expanded: []
      };
    case "includeToggled":
      if (!state.rows[event.index]) return state;
      return {
        ...state,
        rows: state.rows.map((row, i) => (i === event.index ? { ...row, include: !row.include } : row))
      };
    case "expandToggled":
      return {
        ...state,
        expanded: state.expanded.includes(event.index)
          ? state.expanded.filter((i) => i !== event.index)
          : [...state.expanded, event.index]
      };
    case "applied":
      return { ...state, busy: undefined, rows: [], message: event.message, env: { ...state.env, canUndo: true } };
    case "undone":
      return { ...state, busy: undefined, rows: [], message: event.message, env: { ...state.env, canUndo: false } };
    case "coverageChanged":
      return { ...state, busy: undefined, message: event.message, coverageMissing: false, problem: undefined };
    case "failed":
      return { ...state, busy: undefined, error: event.message };
  }
};
