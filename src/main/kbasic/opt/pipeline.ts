import type { ListFileItem } from "@abstractions/CompilerInfo";
import type { LirLine } from "../backend/lir";
import type { MModule } from "../ir/mir";
import type { EmittedProgram } from "../backend/emit";
import { removeRedundantLoads } from "./available";
import { runRules, type Rule } from "./engine";
import { BRANCH_RULES } from "./rules/branches";
import { LOAD_RULES } from "./rules/loads";

/**
 * The optimiser's pipeline (`.docs/kbasic-optimiser.md` §2, §8). Stage 7a: level 1 is the level-0
 * code with the peephole rules applied inside statements, then branch shaping after assembly.
 * Level 0 is never optimised: it stays the reference every other level is compared with.
 */
export const RULES: readonly Rule[] = [...LOAD_RULES, ...BRANCH_RULES];

export type LirOptions = {
  level: number;
  target: "z80" | "z80n";
  onFire?: (rule: string) => void;
};

/** The rules over every function's LIR (from level 1). The DATA table's code is left as it is. */
export function optimizeLir(mir: MModule, functions: LirLine[][], options: LirOptions): LirLine[][] {
  if (options.level < 1) return functions;
  const asmStatements = new Set(mir.statements.filter((s) => s.asmLines?.length).map((s) => s.sid));
  const onFire = options.onFire ? { onFire: options.onFire } : {};
  return functions.map((fn, i) => {
    if (mir.functions[i].kind === "data") return fn;
    // --- Level-1 rules first: the code is still level-1 shaped (no value crosses a statement)
    let lines = runRules(fn, RULES, { level: 1, target: options.target, asmStatements, ...onFire });
    if (options.level < 2) return lines;
    // --- Level 2: values may now cross statements, so the rules run again without the barriers
    lines = removeRedundantLoads(lines, asmStatements);
    return runRules(lines, RULES, { level: options.level, target: options.target, asmStatements, ...onFire });
  });
}

const JP = /^(\s+)jp(\s+)((?:nz|z|nc|c)\s*,\s*)?([A-Za-z_][\w.]*)\s*$/;

/**
 * Branch shaping (§4.4): after the first assembly every address is known, so a `jp` whose target is
 * a label of the same function within reach becomes `jr` (only nz/z/nc/c conditions exist for jr).
 * Every conversion shortens code, so no distance measured before it grows: one pass over the
 * first assembly's addresses is enough. Lines of inline-asm statements are left alone. Returns
 * the new text, or undefined when nothing changed.
 */
export function shapeBranches(
  emitted: EmittedProgram,
  listFileItems: ListFileItem[],
  programFileIndex: number,
  asmStatements: ReadonlySet<number>
): string | undefined {
  const text = emitted.text.split("\n");
  const byLine = new Map<number, ListFileItem>();
  for (const item of listFileItems) {
    if (item.fileIndex === programFileIndex && (item.codeLength ?? 0) > 0) byLine.set(item.lineNumber, item);
  }
  let changed = false;
  for (const range of emitted.functionLines) {
    if (!range) continue;
    // --- The function's labels and the address of the code each one names
    const labels = new Map<string, number>();
    for (let n = range.start; n < range.end; n++) {
      const m = /^([A-Za-z_][\w.]*):\s*$/.exec(text[n - 1] ?? "");
      if (!m) continue;
      for (let k = n + 1; k < range.end; k++) {
        const item = byLine.get(k);
        if (item) {
          labels.set(m[1], item.address);
          break;
        }
      }
    }
    for (let n = range.start; n < range.end; n++) {
      const m = JP.exec(text[n - 1] ?? "");
      const item = byLine.get(n);
      if (!m || !item || item.codeLength !== 3) continue;
      if (asmStatements.has(emitted.lines[n - 1]?.sid)) continue;
      const target = labels.get(m[4]);
      if (target === undefined) continue;
      const offset = target - (item.address + 2);
      if (offset < -128 || offset > 127) continue;
      text[n - 1] = `${m[1]}jr${m[2]}${m[3] ?? ""}${m[4]}`;
      changed = true;
    }
  }
  return changed ? text.join("\n") : undefined;
}
