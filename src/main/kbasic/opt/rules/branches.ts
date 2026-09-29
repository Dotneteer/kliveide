import { instr } from "../../backend/lir";
import { instrAt, lineAt, liveAfter, sidAt, type Rule } from "../engine";
import { invertCondition } from "../lir";

/**
 * Branch rules (`.docs/kbasic-optimiser.md` §4.2): conditions materialised as 0/1 only to be tested
 * again, jumps over jumps, jumps to jumps. Branch *shaping* (`jp` → `jr`) needs addresses and runs
 * after the first assembly (`shape.ts`).
 */

/**
 * `ld a,0 ; jr cc,L ; inc a ; L: ; or a ; jp nz|z,T` — the comparison's flags decide the jump
 * directly: `jp !cc,T` (for `nz`) or `jp cc,T` (for `z`), when A and the flags are dead afterwards
 * and nothing else jumps to L.
 */
const boolBranch: Rule = {
  name: "bool-branch",
  level: 1,
  match(ctx, at) {
    const ld = instrAt(ctx, at);
    const jr = instrAt(ctx, at + 1);
    const inc = instrAt(ctx, at + 2);
    const label = lineAt(ctx, at + 3);
    const or = instrAt(ctx, at + 4);
    const jp = instrAt(ctx, at + 5);
    if (ld?.op !== "ld" || ld.args.join(",").replace(/\s/g, "").toLowerCase() !== "a,0") return undefined;
    if (jr?.op !== "jr" || !jr.branch?.cond || label?.kind !== "label" || jr.branch.target !== label.name) return undefined;
    if (inc?.op !== "inc" || inc.args[0]?.toLowerCase() !== "a") return undefined;
    if (or?.op !== "or" || or.args[0]?.toLowerCase() !== "a" || or.args.length !== 1) return undefined;
    if (jp?.op !== "jp" || !jp.branch?.target || (jp.branch.cond !== "nz" && jp.branch.cond !== "z")) return undefined;
    if ((ctx.labelRefs.get(label.name) ?? 0) !== 1) return undefined;
    const after = liveAfter(ctx, at + 5);
    if (after.has("a") || after.has("f")) return undefined;
    // --- A is 1 exactly when the jr was not taken, i.e. when cc does not hold
    const cond = jp.branch.cond === "nz" ? invertCondition(jr.branch.cond) : jr.branch.cond;
    return { length: 6, replace: [instr(`jp ${cond},${jp.branch.target}`, sidAt(ctx, at + 5))] };
  }
};

/** `jp cc,T ; jp U ; T:` — `jp !cc,U`, falling through to T. */
const jumpOverJump: Rule = {
  name: "jump-over-jump",
  level: 1,
  match(ctx, at) {
    const a = instrAt(ctx, at);
    const b = instrAt(ctx, at + 1);
    const next = lineAt(ctx, at + 2);
    if (a?.op !== "jp" || !a.branch?.cond || b?.op !== "jp" || b.branch?.cond || !b.branch?.target) return undefined;
    if (next?.kind !== "label" || next.name !== a.branch.target) return undefined;
    return { length: 2, replace: [instr(`jp ${invertCondition(a.branch.cond)},${b.branch.target}`, sidAt(ctx, at))] };
  }
};

/**
 * A jump to glue that only jumps on (`L: jp M`, no statement entry in between) goes to M directly.
 * Statement entries are never skipped: the glue block must hold nothing but labels and the jump.
 */
const jumpThread: Rule = {
  name: "jump-thread",
  level: 1,
  match(ctx, at) {
    const p = instrAt(ctx, at);
    if ((p?.op !== "jp" && p?.op !== "jr") || !p.branch?.target || p.branch.kind === "jpind") return undefined;
    const target = p.branch.target;
    const start = ctx.view.findIndex((i) => {
      const l = ctx.lines[i];
      return l.kind === "label" && l.name === target;
    });
    if (start < 0) return undefined;
    let k = start + 1;
    while (lineAt(ctx, k)?.kind === "label") k++;
    const next = instrAt(ctx, k);
    const nextLine = lineAt(ctx, k);
    if (nextLine?.kind !== "instr" || next?.op !== "jp" || next.branch?.cond || !next.branch?.target) return undefined;
    const final = next.branch.target;
    if (final === target) return undefined;
    // --- Only through glue: the forwarding jump belongs to no statement
    if (nextLine.sid >= 0) return undefined;
    const text = p.branch.cond ? `jp ${p.branch.cond},${final}` : `jp ${final}`;
    return { length: 1, replace: [instr(text, sidAt(ctx, at))] };
  }
};

/**
 * Code after an unconditional jump or return, up to the next label something still jumps to, never
 * runs: it goes, and so do the compiler's own labels in it (`__b<n>`, `__k<n>`) that no line of the
 * function names any more. User labels (`_label.x`, routines) and statement entries always stay —
 * the window may not hold a marker, so an unreachable statement keeps its entry (and is elided).
 */
const unreachable: Rule = {
  name: "unreachable",
  level: 1,
  match(ctx, at) {
    const p = instrAt(ctx, at);
    const unconditional = p?.branch && !p.branch.cond && (p.branch.kind === "jp" || p.branch.kind === "jr" || p.branch.kind === "ret" || p.branch.kind === "jpind");
    if (!unconditional) return undefined;
    let k = at + 1;
    for (;;) {
      const line = lineAt(ctx, k);
      if (!line || line.kind === "marker") break;
      if (line.kind === "label") {
        if (!/^__[bk]/.test(line.name) || isNamed(ctx, line.name)) break;
      }
      k++;
    }
    if (k === at + 1) return undefined;
    return { length: k - at, replace: [lineAt(ctx, at)!] };
  }
};

/** Whether any line of the function other than the label's own names it. */
function isNamed(ctx: Parameters<Rule["match"]>[0], name: string): boolean {
  const word = new RegExp(`(^|[^\\w.])${name.replace(/\./g, "\\.")}($|[^\\w.])`);
  return ctx.lines.some((l) => l.kind === "instr" && word.test(l.text));
}

export const BRANCH_RULES: readonly Rule[] = [boolBranch, jumpOverJump, jumpThread, unreachable];
