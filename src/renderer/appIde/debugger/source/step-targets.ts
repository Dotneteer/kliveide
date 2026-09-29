import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import type { SourceActivationInfo, SourceStopInfo } from "@abstractions/SourceDebugInfo";

/**
 * Step Into Target (plan §10.2.4): the routines the statement at the execution point calls, in
 * evaluation order (the call-site table's `order`), each once; library routines only when Just My
 * Code is off. Empty when the program is not
 * stopped on a statement or the statement calls no SUB or FUNCTION.
 */
export function stepIntoTargets(
  info: SourceLevelDebugInfo,
  stop: SourceStopInfo | undefined,
  justMyCode = true
): { callableIndex: number; name: string }[] {
  if (!stop || stop.statementIndex < 0 || stop.kind === "error") return [];
  const sites = (info.extensions?.callSites ?? [])
    .filter((c) => c.statementIndex === stop.statementIndex && c.calleeIndex !== undefined)
    .sort((a, b) => a.order - b.order);
  const seen = new Set<number>();
  const out: { callableIndex: number; name: string }[] = [];
  for (const site of sites) {
    if (seen.has(site.calleeIndex!)) continue;
    // --- Just My Code steps through library routines, so they are not targets
    if (justMyCode && info.extensions?.frames[site.calleeIndex!]?.library) continue;
    seen.add(site.calleeIndex!);
    out.push({ callableIndex: site.calleeIndex!, name: info.callables[site.calleeIndex!]?.name ?? "?" });
  }
  return out;
}

/**
 * Step Out has somewhere to go: an activation above the main program is on the stack (§10.2.5), the
 * same test the emulator's `canStepOut` makes.
 */
export function canSourceStepOut(chain: SourceActivationInfo[] | undefined): boolean {
  return (chain?.length ?? 0) > 1;
}

/** The toolbar's tooltip when Step Out has nowhere to go. */
export const STEP_OUT_IN_MAIN = "Step Out: the main program has nothing to return to";
