import type { Instr, MModule } from "../ir/mir";

/**
 * Unused routines (level 2, plan §7.2 step 10, `.docs/kbasic-optimiser.md` §15): a SUB or FUNCTION
 * nothing can reach from the main program gets no code (the binder has already warned, W170).
 *
 * Reached: the main program and the DATA table's code; then every routine a reached one calls, names
 * by address (`@routine`, `USR @routine`: an address constant), or names in its inline asm; and every
 * routine the program's data names (a CODEBANK trampoline, an asm block placed as data). Banked
 * routines always stay (their trampolines name their bodies).
 *
 * A removed routine is marked, not deleted — function and statement indices stay as the debug info
 * uses them: it gets no code, and its statements (marked too) no entry, so a breakpoint on one of its
 * lines is reported unresolved like one on any line without code.
 */
export function removeUnusedRoutines(mir: MModule): boolean {
  const byLabel = new Map(mir.functions.map((fn, i) => [fn.label, i]));
  const reached = new Set<number>();
  const work: number[] = [];
  const reach = (i: number | undefined) => {
    if (i === undefined || reached.has(i)) return;
    reached.add(i);
    work.push(i);
  };
  const reachNames = (text: string) => {
    for (const m of text.matchAll(/[A-Za-z_][\w.]*/g)) reach(byLabel.get(m[0]));
  };
  mir.functions.forEach((fn, i) => {
    if (fn.kind === "main" || fn.kind === "data" || fn.bank) reach(i);
  });
  for (const d of mir.data) {
    if (d.kind === "raw") d.lines.forEach(reachNames);
    else if (d.kind === "equ") reachNames(d.value);
  }
  while (work.length) {
    const fn = mir.functions[work.pop()!];
    for (const b of fn.blocks) {
      for (const i of b.instrs) referencesOf(i).forEach(reachNames);
    }
  }
  let changed = false;
  mir.functions.forEach((fn, i) => {
    if (reached.has(i) || fn.removed) return;
    fn.removed = true;
    changed = true;
  });
  if (changed) for (const s of mir.statements) if (mir.functions[s.functionIndex]?.removed) s.removed = true;
  return changed;
}

/** The names an instruction refers to: call targets, address constants, symbols, inline asm text. */
function referencesOf(i: Instr): string[] {
  const out: string[] = [];
  const value = (v: { kind: string; name?: string }) => {
    if (v.kind === "sym" && v.name) out.push(v.name);
  };
  switch (i.op) {
    case "call":
      out.push(i.target);
      i.args.forEach(value);
      break;
    case "const":
      value(i.value);
      break;
    case "asm":
      out.push(...i.lines);
      break;
    case "load":
    case "store":
    case "addr":
      if (i.slot.kind === "global") out.push(i.slot.name);
      if (i.slot.kind === "deref") value(i.slot.ptr);
      if (i.op === "store") value(i.src);
      break;
    case "bin":
      value(i.a);
      value(i.b);
      break;
    case "rtcall":
      i.args.forEach(value);
      break;
    default:
      break;
  }
  return out;
}
