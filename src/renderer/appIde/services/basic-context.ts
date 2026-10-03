import { scanBasicLines } from "./basic-structure";

/**
 * What is being typed where in a `.zxbas` file (`.plans/BASIC_EDITOR_INTELLIGENCE_PLAN.md` §4.7):
 * read from the text alone, so completion knows its context while the file does not parse.
 * Pure and table-driven; lines are 1-based, columns 1-based (Monaco's).
 */
export type BasicCompletionContext =
  /** In a string, a comment or an ASM block: no BASIC completion. */
  | { kind: "none" }
  /** A `'@name value` header line before the first code line. */
  | { kind: "header-option"; part: "name" | "value"; option?: string; prefix: string }
  /** After `#`. */
  | { kind: "directive"; prefix: string }
  /** After `#pragma` (or inside `push(` / `pop(`), or after `#pragma name =`. */
  | { kind: "pragma"; part: "name" | "value"; option?: string; prefix: string }
  /** Inside `#include <` or `#include "`. */
  | { kind: "include-path"; system: boolean; prefix: string }
  /** After `AS`. */
  | { kind: "type"; prefix: string }
  /** After `GOTO`, `GOSUB`, `GO TO`, `GO SUB`, `RESTORE` or in `ON ... GOTO` targets. */
  | { kind: "label"; prefix: string }
  /** The start of a statement. */
  | { kind: "statement-start"; prefix: string }
  /** Anywhere a value goes. */
  | { kind: "expression"; prefix: string };

/** A call being typed: the routine or keyword, and which argument the cursor is in (0-based). */
export type BasicCallContext = {
  name: string;
  argIndex: number;
  /** The call has parentheses (`f(a, b)`), or is a paren-less statement call (`mySub a, b`). */
  parens: boolean;
};

/** The text of a line before the cursor with string contents blanked, and the comment/string state. */
function codeBefore(lines: readonly string[], line: number, column: number): { code: string; inString: boolean; inComment: boolean; inAsm: boolean } {
  const text = (lines[line - 1] ?? "").slice(0, column - 1);
  const infos = scanBasicLines([...lines.slice(0, line - 1), text]);
  const info = infos[infos.length - 1];
  if (info.asm) return { code: "", inString: false, inComment: false, inAsm: true };
  // --- Inside a block comment that started on an earlier line and ends at or after this one
  const inBlock = infos.slice(0, -1).some((i, k) => i.blockCommentEnd !== undefined && k + 1 < line && i.blockCommentEnd >= line);
  const statements = info.statements;
  const last = statements[statements.length - 1];
  const masked = last ? " ".repeat(last.column - 1) + last.text : "";
  const quotes = (masked.match(/"/g) ?? []).length;
  // --- The scanner stops at a comment: then the code is shorter than the text
  const codeEnd = last ? last.column - 1 + last.text.length : 0;
  const rest = text.slice(codeEnd);
  const inComment = (inBlock && !last) || /^\s*('|rem(\s|$))/i.test(rest) || (info.commentOnly && !inBlock) || /\/'/.test(rest);
  const separatorAfter = /^\s*:/.test(rest);
  return {
    code: separatorAfter ? "" : masked,
    inString: quotes % 2 === 1,
    inComment,
    inAsm: false
  };
}

/** Whether `line` is in the header: every line before it is blank or a comment. */
function inHeader(lines: readonly string[], line: number): boolean {
  for (let i = 0; i < line - 1; i++) {
    const t = lines[i].trim();
    if (t !== "" && !/^('|rem(\s|$))/i.test(t)) return false;
  }
  return true;
}

const LABEL_AFTER = /(?:\bGO\s*TO|\bGO\s*SUB|\bRESTORE)\s+$/i;

/** The completion context at a position. */
export function scanBasicContext(lines: readonly string[], line: number, column: number): BasicCompletionContext {
  const lineText = lines[line - 1] ?? "";
  const before = lineText.slice(0, column - 1);

  // --- Header option lines
  const header = /^\s*(?:'|rem\s)\s*@([\w-]*)(?:(\s*=?\s*)([^\s]*))?$/i.exec(before);
  if (header && inHeader(lines, line)) {
    if (header[2] === undefined) return { kind: "header-option", part: "name", prefix: header[1] };
    return { kind: "header-option", part: "value", option: header[1].toLowerCase(), prefix: header[3] ?? "" };
  }

  // --- Directives
  if (/^\s*#/.test(before)) {
    let m = /^\s*#\s*include\s+(?:once\s+)?([<"])([^>"]*)$/i.exec(before);
    if (m) return { kind: "include-path", system: m[1] === "<", prefix: m[2] };
    m = /^\s*#\s*pragma\s+(?:(?:push|pop)\s*\(\s*)?([A-Za-z_]\w*)?$/i.exec(before);
    if (m) return { kind: "pragma", part: "name", prefix: m[1] ?? "" };
    m = /^\s*#\s*pragma\s+([A-Za-z_]\w*)\s*(?:=\s*|\s)\s*([\w$]*)$/i.exec(before);
    if (m) return { kind: "pragma", part: "value", option: m[1].toLowerCase(), prefix: m[2] };
    m = /^\s*#\s*([A-Za-z_]\w*)?$/.exec(before);
    if (m) return { kind: "directive", prefix: m[1] ?? "" };
    return { kind: "none" };
  }

  const state = codeBefore(lines, line, column);
  if (state.inAsm || state.inString || state.inComment) return { kind: "none" };
  const code = state.code;
  const prefixMatch = /[A-Za-z_][A-Za-z0-9_]*$/.exec(code);
  const prefix = prefixMatch ? prefixMatch[0] : "";
  // --- The statement before the word being typed; a line number or label in front does not count
  let head = code.slice(0, code.length - prefix.length).replace(/^\s*\d+\s+/, "");
  head = head.replace(/^\s*[A-Za-z_]\w*\s*:\s*/, (m) => (/^\s*(?:ELSE|THEN)\b/i.test(m) ? m : ""));
  const trimmed = head.trim();

  if (trimmed === "") return /^\d+$/.test(prefix) ? { kind: "none" } : { kind: "statement-start", prefix };
  if (/\bAS\s*$/i.test(head)) return { kind: "type", prefix };
  if (LABEL_AFTER.test(head)) return { kind: "label", prefix };
  if (/^ON\b.*\b(?:GO\s*TO|GO\s*SUB)\b[\s\w,]*,\s*$/i.test(trimmed + " ") || /^ON\b.*\b(?:GO\s*TO|GO\s*SUB)\s+$/i.test(head)) return { kind: "label", prefix };
  // --- After THEN / ELSE (a single-line IF's statements), a new statement starts
  if (/(?:\bTHEN|\bELSE)\s+$/i.test(head)) return { kind: "statement-start", prefix };
  return { kind: "expression", prefix };
}

/**
 * The call the cursor is in, for signature help: the innermost unclosed `(` of the statement and
 * the name before it, or a paren-less statement call (`mySub a, b`; `BEEP 1, 2`) when `isStatementCall`
 * accepts its first word. Commas inside nested parentheses do not count.
 */
export function scanBasicCall(
  lines: readonly string[],
  line: number,
  column: number,
  isStatementCall: (name: string) => boolean
): BasicCallContext | undefined {
  const state = codeBefore(lines, line, column);
  if (state.inAsm || state.inString || state.inComment) return undefined;
  const code = state.code;
  let depth = 0;
  let commas = 0;
  for (let i = code.length - 1; i >= 0; i--) {
    const c = code[i];
    if (c === ")") depth++;
    else if (c === "(") {
      if (depth === 0) {
        const name = /([A-Za-z_][A-Za-z0-9_]*\$?)\s*$/.exec(code.slice(0, i));
        if (name) return { name: name[1], argIndex: commas, parens: true };
        // --- A bracket that is not a call: keep looking outward, its commas are not ours
        commas = 0;
        continue;
      }
      depth--;
    } else if (c === "," && depth === 0) commas++;
  }
  // --- A paren-less call at the start of the statement
  const statement = code.replace(/^\s*\d+\s+/, "");
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*\$?)\s+(.*)$/.exec(statement);
  if (m && isStatementCall(m[1])) {
    let d = 0;
    let n = 0;
    for (const c of m[2]) {
      if (c === "(") d++;
      else if (c === ")") d--;
      else if (c === "," && d === 0) n++;
    }
    return { name: m[1], argIndex: n, parens: false };
  }
  return undefined;
}
