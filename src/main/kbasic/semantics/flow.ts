import type { DiagnosticBag } from "../diagnostics";
import type { BoundProgram, BoundStatement } from "./bound";
import type { Scope, Symbol } from "./symbols";

/**
 * Warnings that need the whole bound program: unreachable code (W180), a FUNCTION that can end
 * without RETURN (W190), unused variables and routines (W150, W170; reported, like upstream, only
 * when optimising, where the code is removed), and ASM blocks that leave a bank switched (E454).
 */
export function checkFlow(program: BoundProgram, globals: Scope, optimize: number, diagnostics: DiagnosticBag): void {
  checkBlock(program.statements, diagnostics);
  for (const s of walk(program.statements)) {
    if (s.kind !== "routine") continue;
    const r = s.routine;
    if (r.kind === "function" && completes(s.body)) {
      diagnostics.warning("W190", `FUNCTION ${r.name} can reach its end without RETURN`, r.span);
    }
  }
  if (optimize > 0) {
    for (const r of program.routines) {
      if (r.definedAt && !r.called && r.uses.length === 0) diagnostics.warning("W170", `${r.kind === "sub" ? "SUB" : "FUNCTION"} ${r.name} is never called; it is left out`, r.span);
    }
    const scopes = [globals, ...program.routines.map((r) => r.scope).filter((s): s is Scope => !!s)];
    for (const scope of scopes) {
      for (const symbol of scope.symbols) if (unused(symbol)) diagnostics.warning("W150", `${describe(symbol)} '${symbol.name}' is never used`, symbol.span);
    }
  }
  checkBanks(program.statements, diagnostics);
}

function unused(s: Symbol): boolean {
  if (s.kind === "variable") return s.uses.length === 0 && !s.read && !s.at && !(s.storage === "param" && s.byref);
  if (s.kind === "array") return s.uses.length === 0 && !s.read && !s.at;
  return false;
}

function describe(s: Symbol): string {
  if (s.kind === "variable" && s.storage === "param") return "Parameter";
  return s.kind === "array" ? "Array" : "Variable";
}

// =================================================================================================
// Reachability

/** Statements that never continue with the next one. */
function ends(s: BoundStatement): boolean {
  return (
    s.kind === "goto" ||
    s.kind === "return" ||
    s.kind === "end" ||
    s.kind === "stop" ||
    s.kind === "error" ||
    s.kind === "exit" ||
    s.kind === "continue"
  );
}

/** W180 once per run of dead code: the first statement after one that never continues, before any label. */
function checkBlock(block: BoundStatement[], diagnostics: DiagnosticBag): void {
  let dead = false;
  for (const s of block) {
    for (const inner of children(s)) checkBlock(inner, diagnostics);
    if (s.kind === "label") {
      dead = false;
      continue;
    }
    // --- Definitions and DATA do not run where they stand
    if (s.kind === "routine" || s.kind === "codebank" || s.kind === "data") continue;
    if (dead) diagnostics.warning("W180", "This code is never reached", s.span);
    dead = ends(s);
  }
}

/** Whether running a block can reach its end (and so fall off the end of a FUNCTION). */
function completes(block: BoundStatement[]): boolean {
  let reachable = true;
  for (const s of block) {
    if (s.kind === "label") reachable = true;
    if (!reachable) continue;
    if (ends(s) && s.kind !== "exit" && s.kind !== "continue") reachable = false;
    else if (s.kind === "if" && s.else && s.branches.every((b) => !completes(b.body)) && !completes(s.else)) reachable = false;
    else if (s.kind === "do" && s.test === "none" && !exits(s.body, "DO")) reachable = false;
  }
  return reachable;
}

/** Whether a loop body has an EXIT for that loop kind (not inside a nested loop of the same kind). */
function exits(block: BoundStatement[], loop: "DO" | "FOR" | "WHILE"): boolean {
  for (const s of block) {
    if (s.kind === "exit" && s.loop === loop) return true;
    if ((s.kind === "do" && loop === "DO") || (s.kind === "for" && loop === "FOR") || (s.kind === "while" && loop === "WHILE")) continue;
    if (children(s).some((c) => exits(c, loop))) return true;
  }
  return false;
}

function children(s: BoundStatement): BoundStatement[][] {
  switch (s.kind) {
    case "if":
      return [...s.branches.map((b) => b.body), ...(s.else ? [s.else] : [])];
    case "for":
    case "while":
    case "do":
    case "routine":
    case "codebank":
      return [s.body];
    default:
      return [];
  }
}

function* walk(block: BoundStatement[]): Generator<BoundStatement> {
  for (const s of block) {
    yield s;
    for (const c of children(s)) yield* walk(c);
  }
}

// =================================================================================================
// Banks

/**
 * E454: an ASM block that switches bank
 * with the `CODEBANK n` pseudo-op and does not switch back to the bank it started in.
 */
function checkBanks(block: BoundStatement[], diagnostics: DiagnosticBag, bank = 0): void {
  for (const s of block) {
    if (s.kind === "codebank") {
      checkBanks(s.body, diagnostics, s.bank);
      continue;
    }
    if (s.kind === "asm") {
      let current = bank;
      for (const line of s.lines) {
        const m = /^\s*codebank\s+(\$[0-9a-f]+|\d+)\s*(;.*)?$/i.exec(line.text);
        if (m) current = m[1].startsWith("$") ? parseInt(m[1].slice(1), 16) : Number(m[1]);
      }
      if (current !== bank) {
        diagnostics.error("E454", `The ASM block ends in bank ${current}: it must switch back to bank ${bank}, where it started`, s.span);
      }
    }
    for (const c of children(s)) checkBanks(c, diagnostics, bank);
  }
}
