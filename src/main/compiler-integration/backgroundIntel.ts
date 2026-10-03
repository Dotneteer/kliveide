import type { AssemblerErrorInfo, KliveCompilerOutput } from "@abstractions/CompilerInfo";
import type { BasicIntelData } from "@abstractions/BasicIntel";
import type { Action } from "@common/state/Action";
import { setBasicIntelAction, setLanguageIntelAction } from "@common/state/actions";
import { extractLanguageIntelData } from "./extractIntelData";

/** Whether any item is an error (`errors` holds warnings too; they have `isWarning` set). */
export function hasErrorSeverity(errors: readonly AssemblerErrorInfo[] | undefined): boolean {
  return (errors ?? []).some((e) => !e.isWarning);
}

/**
 * The language-intelligence actions a background check's result leads to
 * (`.plans/BASIC_EDITOR_INTELLIGENCE_PLAN.md` E3, E4):
 *
 * - The assembler's intel is published when the result has no error; warnings never block it.
 *   Otherwise the last good snapshot stays, so intel survives a half-typed line.
 * - A BASIC (`zxbas`) check never touches the assembler's intel (it used to overwrite it with an
 *   empty snapshot). Its `basicIntel` snapshots are published as they are: Klive BASIC leaves out
 *   the snapshot of a root that has errors itself, which keeps the last good one in the state.
 *   zxbc mode has none (E13).
 * - Any check may carry `basicIntel` for the open `.zxbas` file when the build root does not include
 *   it (E14).
 */
export function backgroundIntelActions(language: string, output: KliveCompilerOutput): Action[] {
  // --- A worker that failed posts its message as a string
  if (!output || typeof output !== "object") return [];
  const actions: Action[] = [];
  if (language !== "zxbas" && !hasErrorSeverity(output.errors)) {
    actions.push(setLanguageIntelAction(extractLanguageIntelData(output)));
  }
  for (const intel of basicIntelOf(output)) actions.push(setBasicIntelAction(intel));
  return actions;
}

/** The BASIC snapshots a compiler output carries. */
export function basicIntelOf(output: KliveCompilerOutput): BasicIntelData[] {
  return (output as { basicIntel?: BasicIntelData[] }).basicIntel ?? [];
}
