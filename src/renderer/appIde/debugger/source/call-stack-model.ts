import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import type { SourceActivationInfo, SourceStopInfo } from "@abstractions/SourceDebugInfo";

/**
 * One row of the symbolic call stack (plan §10.6): an activation and where it stands — for the
 * innermost one the statement about to run, for an outer one the statement that made the call.
 */
export type SourceFrameRow = {
  /** The frame index: 0 is the innermost activation; Run to Frame and the Variables panel use it. */
  frame: number;
  /** A routine's name, `main`, or `GOSUB` for a GOSUB subroutine. */
  name: string;
  kind: "main" | "routine" | "gosub";
  filename?: string;
  line?: number;
  startColumn?: number;
  endColumn?: number;
  /** Library code (not the user's source). */
  library?: boolean;
};

/** A row for runtime code above the innermost user activation (PC in the runtime or the ROM). */
export type RuntimeRow = { runtime: true; pc: number; /** An error stop's report. */ error?: string };

export function buildSourceCallStack(
  info: SourceLevelDebugInfo,
  chain: SourceActivationInfo[],
  stop: SourceStopInfo | undefined
): (SourceFrameRow | RuntimeRow)[] {
  const rows: (SourceFrameRow | RuntimeRow)[] = [];
  const inRuntime = !!stop && stop.statementIndex < 0;
  if (inRuntime) rows.push({ runtime: true, pc: stop!.pc, ...(stop?.error ? { error: stop.error.report } : {}) });
  const frames = info.extensions?.frames ?? [];
  chain.forEach((activation, frame) => {
    const statementIndex =
      frame === 0
        ? inRuntime
          ? (stop?.userStatementIndex ?? -1)
          : (stop?.statementIndex ?? -1)
        : (chain[frame - 1].callSite?.statementIndex ?? -1);
    const s = statementIndex >= 0 ? info.statements[statementIndex] : undefined;
    const callable = info.callables[activation.callableIndex];
    rows.push({
      frame,
      name: activation.kind === "gosub" ? "GOSUB" : (callable?.name ?? "?"),
      kind: activation.kind,
      ...(s
        ? {
            filename: info.files[s.fileIndex]?.filename,
            line: s.startLine,
            startColumn: s.startColumn,
            endColumn: s.endColumn
          }
        : {}),
      ...(frames[activation.callableIndex]?.library ? { library: true } : {})
    });
  });
  return rows;
}
