import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { instr, label, type LirLine } from "@main/kbasic/backend/lir";
import { selectFunction } from "@main/kbasic/backend/select0";
import { DiagnosticBag } from "@main/kbasic/diagnostics";
import { lowerProgram } from "@main/kbasic/ir/lower";
import { runFrontEnd } from "@main/kbasic/KBasicCompiler";
import { runRules } from "@main/kbasic/opt/engine";
import { computeLiveness } from "@main/kbasic/opt/liveness";
import { parseInstr } from "@main/kbasic/opt/lir";
import { optimizeLir, RULES } from "@main/kbasic/opt/pipeline";
import { verifyModule } from "@main/kbasic/opt/verify";
import { defaultOptions } from "@main/kbasic/options/options";
import { isLibraryPath } from "@main/kbasic/stdlib";

import { isNextOnly, programs } from "../corpus/expectations";

/**
 * The level-1 peephole rules (`.docs/kbasic-optimiser.md` §4.2): each rule before and after, and
 * what the engine protects whatever the rule says. The corpus runs every program at level 1 with its
 * expectations, the validator and G4 (the execution checks); the last test here proves every rule
 * fires somewhere in the corpus, so each one is exercised by them.
 */
const stmt = (sid: number): LirLine => ({ kind: "marker", marker: "stmt", sid });
const ins = (text: string, sid = 1) => instr(text, sid);
const run = (lines: LirLine[], asm: number[] = []) =>
  runRules(lines, RULES, { level: 1, target: "z80", asmStatements: new Set(asm) })
    .map((l) => (l.kind === "instr" ? l.text : l.kind === "label" ? `${l.name}:` : `<${l.kind === "marker" ? l.marker : "comment"}>`));

describe("the LIR parser", () => {
  it("knows what an instruction reads and writes", () => {
    const p = parseInstr("ld a,(ix-1)");
    expect([...p.defs]).toEqual(["a"]);
    expect([...p.uses]).toEqual([]);
    expect([...parseInstr("add hl,de").uses].sort()).toEqual(["d", "e", "h", "l"]);
    expect([...parseInstr("cp h").defs]).toEqual(["f"]);
    expect(parseInstr("jp nz,__b2").branch).toEqual({ kind: "jp", cond: "nz", target: "__b2" });
    expect(parseInstr("ld (_b),hl").writesMemory).toBe(true);
    expect(parseInstr("out (c),a").sideEffects).toBe(true);
    expect(parseInstr("call core.Mul8").defs.size).toBe(8);
  });

  it("gives no live register at a statement entry at level 1, but keeps a FUNCTION's result into the epilogue", () => {
    const lines: LirLine[] = [ins("ld hl,5"), stmt(2), ins("ld a,1", 2), ins("ld (_x),a", 2)];
    expect(computeLiveness(lines, true).liveOut[0].size).toBe(0);
    const epilogue: LirLine[] = [ins("ld hl,5"), stmt(2), { kind: "marker", marker: "epilogue.begin", sid: 2 }, ins("ret", 2)];
    expect(computeLiveness(epilogue, true).liveOut[0].has("h")).toBe(true);
  });
});

describe("load and store rules", () => {
  it("drops a reload of what was just stored", () => {
    expect(run([stmt(1), ins("ld (_a),a"), ins("ld a,(_a)"), ins("ld (_c),a")])).toEqual(["<stmt>", "ld (_a),a", "ld (_c),a"]);
    expect(run([stmt(1), ins("ld (ix-2),l"), ins("ld (ix-1),h"), ins("ld l,(ix-2)"), ins("ld h,(ix-1)"), ins("ld (_b),hl")])).toEqual([
      "<stmt>",
      "ld (ix-2),l",
      "ld (ix-1),h",
      "ld (_b),hl"
    ]);
  });

  it("drops instructions whose results nobody reads", () => {
    expect(run([stmt(1), ins("ld b,7"), ins("ld a,1"), ins("ld (_a),a"), stmt(9), ins("ret", 9)])).toEqual(["<stmt>", "ld a,1", "ld (_a),a", "<stmt>", "ret"]);
  });

  it("uses an immediate operand instead of a register loaded with the constant", () => {
    expect(run([stmt(1), ins("ld a,(_a)"), ins("ld h,1"), ins("add a,h"), ins("ld (_a),a"), stmt(9), ins("ret", 9)])).toEqual([
      "<stmt>",
      "ld a,(_a)",
      "add a,1",
      "ld (_a),a",
      "<stmt>",
      "ret"
    ]);
  });
});

describe("branch rules", () => {
  it("branches on the comparison instead of a 0/1 in A", () => {
    const lines = [stmt(1), ins("cp h"), ins("ld a,0"), ins("jr nc,__k0"), ins("inc a"), label("__k0", 1), ins("or a"), ins("jp nz,__b2"), label("__b2", 2), stmt(2), ins("ret", 2)];
    expect(run(lines).slice(0, 3)).toEqual(["<stmt>", "cp h", "jp c,__b2"]);
  });

  it("turns a jump over a jump into one jump, and threads jumps through glue", () => {
    const lines = [stmt(1), ins("cp h"), ins("jp nz,__b5"), ins("jp __b6"), label("__b5", 1), stmt(2), ins("ld a,1", 2), ins("ld (_a),a", 2), label("__b6", -1), instr("jp __b9", -1), label("__b9", 3), stmt(3), ins("ret", 3)];
    expect(run(lines).slice(0, 3)).toEqual(["<stmt>", "cp h", "jp z,__b9"]);
  });

  it("drops code after an unconditional jump up to a label something still jumps to", () => {
    const lines = [stmt(1), ins("jp __b9"), label("__b6", 1), ins("ld a,1"), ins("jp __b9"), label("__b9", 3), stmt(3), ins("ret", 3)];
    expect(run(lines)).toEqual(["<stmt>", "jp __b9", "__b9:", "<stmt>", "ret"]);
  });
});

describe("what the engine protects", () => {
  it("never works across a statement entry at level 1", () => {
    expect(run([stmt(1), ins("ld (_b),hl"), stmt(2), ins("ld hl,(_b)", 2), ins("ld (_c),hl", 2)])).toEqual(["<stmt>", "ld (_b),hl", "<stmt>", "ld hl,(_b)", "ld (_c),hl"]);
  });

  it("never touches a call site, the user's inline asm, or the prologue and epilogue", () => {
    const site = { kind: "sub" as const, callee: "s", moreCallsFollow: false, order: 0 };
    const withSite: LirLine[] = [stmt(1), ins("ld hl,5"), instr("call _s", 1, site), ins("ld b,1"), stmt(9), ins("ret", 9)];
    expect(run(withSite)).toEqual(["<stmt>", "ld hl,5", "call _s", "<stmt>", "ret"]);
    // --- The same dead load is kept when it is the user's inline asm
    expect(run([stmt(1), ins("ld b,7"), stmt(9), ins("ret", 9)], [1])).toEqual(["<stmt>", "ld b,7", "<stmt>", "ret"]);
    expect(run([stmt(1), ins("ld b,7"), stmt(9), ins("ret", 9)])).toEqual(["<stmt>", "<stmt>", "ret"]);
    const frame: LirLine[] = [ins("push ix", 0), ins("ld hl,0", 0), ins("push hl", 0), { kind: "marker", marker: "prologue.end", sid: 0 }, stmt(1), ins("ld b,1")];
    expect(run(frame).slice(0, 3)).toEqual(["push ix", "ld hl,0", "push hl"]);
  });

  it("keeps a value somebody still reads", () => {
    expect(run([stmt(1), ins("ld b,7"), ins("ld a,b"), ins("ld (_a),a")])).toEqual(["<stmt>", "ld b,7", "ld a,b", "ld (_a),a"]);
  });
});

describe("the rules on the corpus", () => {
  it("verify every program's MIR, and fire every rule somewhere", () => {
    const fired = new Map<string, number>();
    const root = join(__dirname, "..", "corpus");
    for (const file of programs(root)) {
      const source = readFileSync(file, "utf8");
      const diagnostics = new DiagnosticBag();
      const options = { ...defaultOptions(), optimize: 1, ...(isNextOnly(source) ? { target: "next" as const } : {}) };
      const front = runFrontEnd("/test/main.bas", source, { read: () => undefined }, options, diagnostics);
      if (!front.bound) continue;
      const mir = lowerProgram(front.bound.program, front.bound.globals, diagnostics, (f) => isLibraryPath(front.sources.get(f).name));
      expect(verifyModule(mir, 1), file).toEqual([]);
      const runtime = new Set(mir.runtime);
      const functions = mir.functions.map((fn) => selectFunction(fn, runtime));
      optimizeLir(mir, functions, { level: 1, target: "z80", onFire: (r) => fired.set(r, (fired.get(r) ?? 0) + 1) });
    }
    expect(RULES.map((r) => r.name).filter((r) => !fired.has(r))).toEqual([]);
  });
});
