import { instr } from "../../backend/lir";
import { instrAt, lineAt, liveAfter, sidAt, type Rule } from "../engine";

/**
 * Load and store rules (`.docs/kbasic-optimiser.md` §4.2): values the code writes and reads back at
 * once, instructions whose results nobody reads, register operands that can be immediates. A rule
 * is kept only while some corpus program fires it (`test/kbasic/opt/rules.test.ts`).
 */
const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** `ld (x),r` then `ld r,(x)`: the value is still in r. */
const storeReload: Rule = {
  name: "store-reload",
  level: 1,
  match(ctx, at) {
    const a = instrAt(ctx, at);
    const b = instrAt(ctx, at + 1);
    if (a?.op !== "ld" || b?.op !== "ld" || a.args.length !== 2 || b.args.length !== 2) return undefined;
    if (!a.args[0].startsWith("(") || norm(a.args[0]) !== norm(b.args[1]) || norm(a.args[1]) !== norm(b.args[0])) return undefined;
    if (a.sideEffects || b.sideEffects) return undefined;
    return { length: 2, replace: [lineAt(ctx, at)!] };
  }
};

/**
 * A 16-bit value stored byte by byte through IX and read back the same way:
 * `ld (ix+n),l ; ld (ix+n+1),h ; ld l,(ix+n) ; ld h,(ix+n+1)` keeps the stores.
 */
const storeReloadPair: Rule = {
  name: "store-reload-pair",
  level: 1,
  match(ctx, at) {
    const s1 = instrAt(ctx, at);
    const s2 = instrAt(ctx, at + 1);
    const l1 = instrAt(ctx, at + 2);
    const l2 = instrAt(ctx, at + 3);
    if (![s1, s2, l1, l2].every((x) => x?.op === "ld" && x.args.length === 2)) return undefined;
    const same = (x: string, y: string) => norm(x) === norm(y);
    if (!same(s1!.args[0], l1!.args[1]) || !same(s1!.args[1], l1!.args[0])) return undefined;
    if (!same(s2!.args[0], l2!.args[1]) || !same(s2!.args[1], l2!.args[0])) return undefined;
    if (!/^\(\s*i[xy]/i.test(s1!.args[0]) || !/^\(\s*i[xy]/i.test(s2!.args[0])) return undefined;
    // --- The first reload must not clobber the register the second store wrote
    if (same(l1!.args[0], s2!.args[1])) return undefined;
    return { length: 4, replace: [lineAt(ctx, at)!, lineAt(ctx, at + 1)!] };
  }
};

/**
 * An instruction without side effects that writes only registers nobody reads afterwards:
 * `ld a,0` before a flag test that is gone, `or a` whose flags are dead, an unused `ex de,hl`.
 */
const deadInstruction: Rule = {
  name: "dead-instruction",
  level: 1,
  match(ctx, at) {
    const p = instrAt(ctx, at);
    if (!p || p.sideEffects || p.writesMemory || p.branch || p.defs.size === 0) return undefined;
    const live = liveAfter(ctx, at);
    for (const r of p.defs) if (live.has(r)) return undefined;
    return { length: 1, replace: [] };
  }
};

/** `ld r,n ; op a,r` with r dead afterwards: `op a,n` (add, adc, sub, sbc, and, or, xor, cp). */
const immediateOperand: Rule = {
  name: "immediate-operand",
  level: 1,
  match(ctx, at) {
    const a = instrAt(ctx, at);
    const b = instrAt(ctx, at + 1);
    if (a?.op !== "ld" || a.args.length !== 2 || !b) return undefined;
    const r = a.args[0].toLowerCase();
    if (!/^[bcdehl]$/.test(r) || a.args[1].startsWith("(") || /^[abcdehl]$|^i[xy]/i.test(a.args[1].trim())) return undefined;
    if (!["add", "adc", "sub", "sbc", "and", "or", "xor", "cp"].includes(b.op)) return undefined;
    const operand = b.args.length === 2 ? b.args[1] : b.args[0];
    if (b.args.length === 2 && b.args[0].toLowerCase() !== "a") return undefined;
    if (operand?.toLowerCase() !== r || liveAfter(ctx, at + 1).has(r as never)) return undefined;
    const text = b.args.length === 2 ? `${b.op} a,${a.args[1]}` : `${b.op} ${a.args[1]}`;
    return { length: 2, replace: [instr(text, sidAt(ctx, at + 1))] };
  }
};

export const LOAD_RULES: readonly Rule[] = [storeReload, storeReloadPair, immediateOperand, deadInstruction];
