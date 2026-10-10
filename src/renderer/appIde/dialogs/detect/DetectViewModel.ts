import type { DetectOptionsState, DetectState } from "./DetectModel";

/*
 * What the Detect dialog shows, derived from its state. Every display rule lives here.
 */

export type DetectRowViewModel = {
  index: number;
  name: string;
  include: boolean;
  includeEnabled: boolean;
  /** Shares of the bank, as whole percentages. */
  code: string;
  data: string;
  unknown: string;
  changes: number;
  conflicts: number;
  warningCount: number;
  expanded: boolean;
  /** The warnings and notes, each with the offset *Go to* jumps to. */
  details: { text: string; offset: number }[];
};

export type DetectViewModel = {
  options: DetectOptionsState;
  /** Importing a SkoolKit file: the dialog shows only the mode, and the file's name. */
  skool?: { fileName: string };
  notes: string[];
  unavailable?: string;
  busy: boolean;
  busyLabel?: string;
  rows: DetectRowViewModel[];
  problem?: string;
  showCoverageHelp: boolean;
  message?: string;
  error?: string;
  /** A replace run overwrites the user's regions: Apply confirms first. */
  replaceWarning?: string;
  notPausedHint?: string;
  buttons: { detectEnabled: boolean; applyEnabled: boolean; undoEnabled: boolean };
  applyLabel: string;
};

const BANK = 0x4000;
const percent = (bytes: number) => `${Math.round((bytes * 100) / BANK)}%`;
const hex = (n: number) => `$${n.toString(16).toUpperCase().padStart(4, "0")}`;

export function selectViewModel(state: DetectState): DetectViewModel {
  const busy = state.busy !== undefined;
  const rows: DetectRowViewModel[] = state.rows.map((row, index) => {
    const { proposal } = row.target;
    const details = [
      ...proposal.conflicts.map((c) => ({
        text: `${hex(c.start)}-${hex(c.end)}: yours is ${c.from}, detected ${c.type}${state.options.mode === "fill" ? " (kept)" : ""}`,
        offset: c.start
      })),
      ...proposal.notedRuns.map((r) => ({ text: `${hex(r.start)}-${hex(r.end)}: ${r.notes!.join(", ")}`, offset: r.start })),
      ...proposal.warnings.map((w) => ({ text: `${hex(w.offset)}: ${w.message}`, offset: w.offset }))
    ];
    return {
      index,
      name: row.target.name,
      include: row.include,
      includeEnabled: !busy && proposal.changes.length > 0,
      code: percent(proposal.counts.code),
      data: percent(proposal.counts.data),
      unknown: percent(proposal.counts.unknown),
      changes: proposal.changes.length,
      conflicts: proposal.conflicts.length,
      warningCount: details.length,
      expanded: state.expanded.includes(index),
      details
    };
  });
  const included = state.rows.filter((row) => row.include && row.target.proposal.changes.length > 0);
  const userChanges = included.reduce((n, row) => n + row.target.proposal.changes.filter((c) => c.user).length, 0);
  return {
    options: state.options,
    ...(state.env.skoolPath ? { skool: { fileName: state.env.skoolPath.split(/[\\/]/).pop() ?? state.env.skoolPath } } : {}),
    notes: state.notes,
    unavailable: state.env.unavailable,
    busy,
    busyLabel:
      state.busy === "detect"
        ? "Reading coverage and classifying..."
        : state.busy === "apply"
          ? "Writing the annotations..."
          : state.busy === "undo"
            ? "Restoring..."
            : state.busy === "coverage"
              ? "Updating coverage..."
              : undefined,
    rows,
    problem: state.problem,
    showCoverageHelp: state.coverageMissing,
    message: state.message,
    error: state.error,
    replaceWarning:
      userChanges > 0 ? `Replace mode overwrites ${userChanges} of your own region(s); Apply asks first.` : undefined,
    notPausedHint: state.env.paused ? undefined : "Pause the machine first: a running program pages and writes while it is read.",
    buttons: {
      detectEnabled: !busy && !state.env.unavailable,
      applyEnabled: !busy && included.length > 0,
      undoEnabled: !busy && state.env.canUndo
    },
    applyLabel: state.env.skoolPath ? "Import" : state.options.mode === "clear" ? "Clear detected" : "Apply"
  };
}
