import {
  DIRECTIVE_HELP,
  KEYWORD_HELP,
  LIBRARY_HELP,
  LIBRARY_ROUTINE_HELP,
  PRAGMA_HELP
} from "./help-data.generated";
import type { BasicHelpEntry, BasicLibraryRoutineHelp, BasicPragmaHelp } from "./help-types";

export { HELP_ATTRIBUTION } from "./help-data.generated";

const keywordsByName = new Map(KEYWORD_HELP.map((e) => [e.name, e]));
const directivesByName = new Map(DIRECTIVE_HELP.map((e) => [e.name.slice(1).toLowerCase(), e]));
const pragmasByName = new Map(PRAGMA_HELP.map((p) => [p.name.toLowerCase(), p]));
const routinesByName = new Map(LIBRARY_ROUTINE_HELP.map((r) => [r.name.replace(/\$$/, "").toLowerCase(), r]));

/** A keyword's help by any spelling (`print`, `CHR$`, `chr`). */
export function keywordHelp(word: string): BasicHelpEntry | undefined {
  const upper = word.toUpperCase();
  return keywordsByName.get(upper) ?? keywordsByName.get(upper.replace(/\$$/, ""));
}

/** A directive's help by its name without the `#`. */
export function directiveHelp(name: string): BasicHelpEntry | undefined {
  return directivesByName.get(name.toLowerCase());
}

export function pragmaHelp(name: string): BasicPragmaHelp | undefined {
  return pragmasByName.get(name.toLowerCase());
}

/** A documented library routine by name (any case, `$` optional). */
export function libraryRoutineHelp(name: string): BasicLibraryRoutineHelp | undefined {
  return routinesByName.get(name.replace(/\$$/, "").toLowerCase());
}

/** The library routines Klive BASIC's standard library has. */
export function availableLibraryRoutines(): BasicLibraryRoutineHelp[] {
  return LIBRARY_ROUTINE_HELP.filter((r) => r.available);
}

/** The library files `#include <...>` can name in Klive BASIC (the documented ones it has). */
export function availableLibraryFiles(): { name: string; summary: string }[] {
  const documented = new Map(LIBRARY_HELP.map((l) => [l.name.toLowerCase(), l.summary]));
  const files = new Set(availableLibraryRoutines().map((r) => r.library));
  for (const l of LIBRARY_HELP) if (l.available) files.add(l.name);
  const byLower = new Map<string, string>();
  for (const f of files) if (!byLower.has(f.toLowerCase())) byLower.set(f.toLowerCase(), f);
  // --- Prefer the spelling Klive's own file uses (routines name the file as it is on disk)
  for (const r of availableLibraryRoutines()) byLower.set(r.library.toLowerCase(), r.library);
  return [...byLower.values()].sort().map((name) => ({ name, summary: documented.get(name.toLowerCase()) ?? "" }));
}

export { DIRECTIVE_HELP, KEYWORD_HELP, LIBRARY_HELP, LIBRARY_ROUTINE_HELP, PRAGMA_HELP };

/**
 * The word lists the `.zxbas` Monarch grammar colours, built from the help data (plan E8), so the
 * grammar, the help and the compiler's keyword table cannot drift apart. Library routines Klive
 * BASIC has are coloured as functions.
 */
export function monarchWordLists(): { statements: string[]; operators: string[]; functions: string[]; types: string[]; directives: string[] } {
  const of = (...kinds: string[]) => KEYWORD_HELP.filter((e) => kinds.includes(e.kind)).map((e) => e.name);
  return {
    statements: of("statement", "declaration", "modifier", "misc"),
    operators: of("operator"),
    functions: [...of("function"), ...availableLibraryRoutines().map((r) => r.name)],
    types: of("type"),
    directives: DIRECTIVE_HELP.map((d) => d.name)
  };
}
