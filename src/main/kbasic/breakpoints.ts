import { DiagnosticBag } from "./diagnostics";
import { lex } from "./syntax/lexer";
import { SourceSet } from "./syntax/source";
import type { Token } from "./syntax/tokens";

/** Statements that close a block and run no code of their own. */
const BLOCK_ENDS = new Set(["IF", "SUB", "FUNCTION", "WHILE", "ASM", "CODEBANK"]);

/**
 * Whether a source line can hold a breakpoint (plan §10.1): it has a statement that runs. Blank and
 * comment-only lines, preprocessor lines, bare labels and line numbers, declarations, and pure block
 * ends (`END IF`, `LOOP`, `NEXT i` ...) cannot. The answer comes from the lexer alone, so it does not
 * know whether the line sits inside an `ASM` block.
 */
export function lineCanHaveBreakpoint(line: string): boolean {
  const file = new SourceSet().add("<line>", line);
  const tokens = lex(file, new DiagnosticBag()).tokens.filter((t) => t.kind !== "newline" && t.kind !== "eof");
  if (tokens.length === 0) return false;
  if (tokens[0].kind === "directive" || tokens[0].kind === "pragma") return false;

  // --- A leading line number or `label:` marks a place; it is not a statement
  let i = 0;
  if (tokens[0].kind === "number") i = 1;
  else if (tokens[0].kind === "identifier" && isOperator(tokens[1], ":")) i = 2;
  const statements = splitStatements(tokens.slice(i));
  return statements.some((s) => runsCode(s));
}

function runsCode(statement: Token[]): boolean {
  const [first, second] = statement;
  switch (first.keyword) {
    case "END":
      return !(statement.length === 2 && second.keyword && BLOCK_ENDS.has(second.keyword));
    case "ENDIF":
    case "WEND":
    case "NEXT":
    case "DECLARE":
      return false;
    case "LOOP": // --- LOOP UNTIL/WHILE tests a condition
    case "ELSE": // --- ELSE PRINT ...
    case "ASM": // --- a one-line ASM ... END ASM
      return statement.length > 1;
    default:
      return true;
  }
}

/** The statements of a line, split at `:` (empty ones dropped). */
function splitStatements(tokens: Token[]): Token[][] {
  const result: Token[][] = [];
  let current: Token[] = [];
  for (const t of tokens) {
    if (isOperator(t, ":")) {
      if (current.length) result.push(current);
      current = [];
    } else current.push(t);
  }
  if (current.length) result.push(current);
  return result;
}

function isOperator(t: Token | undefined, text: string): boolean {
  return t?.kind === "operator" && t.text === text;
}
