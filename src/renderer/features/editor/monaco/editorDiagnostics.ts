/**
 * The editor's view of a build's errors and warnings: grouping them by line for the inline hint,
 * counting them for the problem counter, and the "did you mean" candidate for an undefined symbol.
 *
 * Pure functions, no Monaco: `MonacoEditor.tsx` turns the results into markers and decorations.
 */

import { get } from "lodash";
import { KliveGlobalSettings } from "@common/settings/setting-definitions";
import { SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE } from "@common/settings/setting-const";

/** The Klive assembler's "Identifier '{0}' is not defined yet." */
export const UNDEFINED_SYMBOL_CODE = "Z0605";

/** Where an undefined symbol stands in the source: 1-based Monaco columns, end exclusive */
export type UndefinedSymbolRange = {
  lineNo: number;
  startColumn: number;
  endColumn: number;
};

// --- By editor model: the last build's undefined symbols in that model, for the quick fix. The
// --- markers carry only the whole line for languages without exact columns; these keep the name's
// --- own range, which the assembler reports exactly for this error.
const undefinedSymbolRanges = new WeakMap<object, UndefinedSymbolRange[]>();

/** Records the last build's undefined symbols of an editor model */
export function setUndefinedSymbolRanges(model: object, ranges: UndefinedSymbolRange[]): void {
  undefinedSymbolRanges.set(model, ranges);
}

/** The last build's undefined symbols of an editor model on the given line */
export function undefinedSymbolsOnLine(model: object, lineNo: number): UndefinedSymbolRange[] {
  return (undefinedSymbolRanges.get(model) ?? []).filter((r) => r.lineNo === lineNo);
}

/** One message on a line of the open file */
export type LineMessage = {
  message: string;
  /** The compiler's code for it (`Z0605`), when it has one */
  code?: string;
  isWarning: boolean;
};

/** Every message on one line, the errors first */
export type LineHint = {
  lineNo: number;
  /** True when every message on the line is a warning */
  isWarning: boolean;
  messages: LineMessage[];
};

/**
 * Groups the messages by line: one hint per line, its errors before its warnings, each message
 * once. The line's severity is its worst message's.
 */
export function groupLineHints(items: ReadonlyArray<LineMessage & { lineNo: number }>): LineHint[] {
  const byLine = new Map<number, LineMessage[]>();
  for (const { lineNo, ...msg } of items) {
    const list = byLine.get(lineNo) ?? [];
    if (!list.some((m) => m.message === msg.message && m.isWarning === msg.isWarning)) list.push(msg);
    byLine.set(lineNo, list);
  }
  return [...byLine.entries()]
    .sort(([a], [b]) => a - b)
    .map(([lineNo, list]) => {
      // --- A stable sort: errors first, each severity in the compiler's order
      const messages = [...list].sort((a, b) => Number(a.isWarning) - Number(b.isWarning));
      return { lineNo, isWarning: messages.every((m) => m.isWarning), messages };
    });
}

/**
 * The two pieces of a line's inline hint: the first message, and the quiet detail after it - the
 * message's code and, when the line has more messages, how many more (`Z0402  +1`). The hover and
 * the problem peek show all of them.
 */
export function hintParts(hint: LineHint): { message: string; detail: string } {
  const [first] = hint.messages;
  const more = hint.messages.length - 1;
  const detail = [first?.code, more > 0 ? `+${more}` : undefined].filter(Boolean).join("  ");
  return { message: first?.message ?? "", detail };
}

/** The number of errors and warnings in a list of messages */
export function countProblems(items: ReadonlyArray<{ isWarning?: boolean }>): {
  errors: number;
  warnings: number;
} {
  let warnings = 0;
  for (const item of items) if (item.isWarning) warnings++;
  return { errors: items.length - warnings, warnings };
}

/** A build message as the tabs count it */
export type BuildMessage = { filename: string; isWarning?: boolean };

/**
 * The last background build's messages, or undefined while **Compile in the background** is off
 * (the editor shows none then either). A store selector, so a component reads it with the
 * `useSelector` it already has rather than another hook.
 */
export function backgroundBuildMessages(state: {
  globalSettings?: unknown;
  compilation?: { backgroundResult?: { errors?: ReadonlyArray<BuildMessage> } };
}): ReadonlyArray<BuildMessage> | undefined {
  const def = KliveGlobalSettings[SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE];
  const enabled = get(state?.globalSettings ?? {}, SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE, def?.defaultValue);
  return enabled ? state?.compilation?.backgroundResult?.errors : undefined;
}

/**
 * The number of errors (not warnings) a build reported in a project file. A message belongs to the
 * file when its filename ends with the file's project path, as the editor matches them.
 */
export function fileErrorCount(
  errors: ReadonlyArray<{ filename: string; isWarning?: boolean }> | undefined,
  projectPath: string | undefined
): number {
  if (!errors || !projectPath) return 0;
  let count = 0;
  for (const e of errors) if (!e.isWarning && e.filename.endsWith(projectPath)) count++;
  return count;
}

/**
 * The known symbol an undefined name most likely meant, or undefined. Case-insensitive; the
 * distance allowed grows with the name (one edit up to five characters, two up to eight, then
 * three), so a short name is never "corrected" to an unrelated one. Ties go to the first candidate.
 */
export function closestSymbol(name: string, candidates: Iterable<string>): string | undefined {
  const target = name.toLowerCase();
  if (!target) return undefined;
  const allowed = target.length <= 5 ? 1 : target.length <= 8 ? 2 : 3;
  let best: string | undefined;
  let bestDistance = allowed + 1;
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    if (lower === target) return undefined;
    if (Math.abs(lower.length - target.length) >= bestDistance) continue;
    const distance = editDistance(target, lower, bestDistance);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Edit distance in which swapping two neighbouring characters is one edit (`Dleay` is one from
 * `Delay`), the commonest typo; gives up (returning `limit`) once it cannot be below `limit`.
 */
function editDistance(a: string, b: string, limit: number): number {
  let prevPrev: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j], prevPrev[j - 2] + 1);
      }
      rowMin = Math.min(rowMin, row[j]);
    }
    if (rowMin >= limit) return limit;
    prevPrev = prev;
    prev = row;
  }
  return prev[b.length];
}
