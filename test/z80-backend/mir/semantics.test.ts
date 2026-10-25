import { describe, expect, it } from "vitest";

import { imm, MirBuilder } from "@main/z80-backend/mir/builder";
import { mirText } from "@main/z80-backend/mir/print";
import { optimizeMir } from "@main/z80-backend/opt/mir-passes";
import { moduleSemanticProblems, verifyModule } from "@main/z80-backend/opt/verify";
import { selectFunction } from "@main/z80-backend/select/select0";

/**
 * Operation meanings in the shared back end (`.plans/SHARED_Z80_BACKEND_PLAN.md` §3.4), built with
 * the MIR builder — no front end involved: an operation whose meaning differs between languages must
 * state it, and state one the back end implements; the folder and the selector follow what it states.
 */
const SPAN = { file: 0, start: 0, end: 1 };

function program(build: (b: ReturnType<MirBuilder["fn"]>, sid: number) => void) {
  const m = new MirBuilder();
  const main = m.fn({ label: "_main", name: "main", kind: "entry" });
  const sid = m.statement(main, SPAN, "assignment");
  main.block("_main").stmt(sid);
  build(main, sid);
  main.end({ op: "ret", sid });
  return m.build();
}

const x = { kind: "global" as const, name: "_x" };

describe("operation meanings", () => {
  it("asks every operation that needs a meaning to state it", () => {
    const mir = program((f, sid) => {
      const a = f.load(sid, "i16", x);
      f.store(sid, "i16", x, f.bin(sid, "div", a, imm("i16", 3)));
      f.store(sid, "i16", x, f.bin(sid, "add", a, imm("i16", 1)));
      f.store(sid, "i8", x, f.conv(sid, "i8", a));
      f.store(sid, "i16", x, f.conv(sid, "i16", f.load(sid, "flt", x)));
    });
    const problems = moduleSemanticProblems(mir);
    expect(problems).toEqual([
      expect.stringContaining("'bin div' of statement 0 does not say its rounding"),
      expect.stringContaining("'bin add' of statement 0 does not say its overflow"),
      expect.stringContaining("'conv' of statement 0 does not say its overflow"),
      expect.stringContaining("'conv' of statement 0 does not say its toInt"),
      expect.stringContaining("'conv' of statement 0 does not say its overflow")
    ]);
    expect(verifyModule(mir, 1)).toEqual(expect.arrayContaining(problems));
  });

  it("names a meaning the back end does not implement yet, rather than using another", () => {
    const mir = program((f, sid) => {
      const a = f.load(sid, "i16", x);
      f.store(sid, "i16", x, f.bin(sid, "div", a, imm("i16", 3), { rounding: "floor" }));
      f.store(sid, "i16", x, f.bin(sid, "mod", a, imm("i16", 3), { rounding: "trunc" }));
      f.store(sid, "i16", x, f.bin(sid, "mul", a, a, { overflow: "check" }));
      f.store(sid, "i16", x, f.conv(sid, "i16", f.load(sid, "flt", x), { toInt: "round-half-even", overflow: "wrap" }));
      f.store(sid, "u8", x, f.conv(sid, "u8", f.load(sid, "bool", x), { truth: "0ff" }));
      f.store(sid, "i16", x, f.bin(sid, "shr", a, imm("u8", 1), { shift: "logical" }));
    });
    expect(moduleSemanticProblems(mir).map((p) => /asks for (\w+) '([\w-]+)'/.exec(p)?.slice(1).join(" "))).toEqual([
      "rounding floor",
      "rounding trunc",
      "overflow check",
      "toInt round-half-even",
      "truth 0ff",
      "shift logical"
    ]);
  });

  it("accepts the meanings the back end implements, and shows them in the MIR text", () => {
    const mir = program((f, sid) => {
      const a = f.load(sid, "i16", x);
      f.store(sid, "i16", x, f.bin(sid, "div", a, imm("i16", 3), { rounding: "trunc" }));
      f.store(sid, "i16", x, f.bin(sid, "mod", a, imm("i16", 3), { rounding: "magnitude" }));
      f.store(sid, "i16", x, f.bin(sid, "shr", a, imm("u8", 1), { shift: "arith" }));
      f.store(sid, "i16", x, f.conv(sid, "i16", f.load(sid, "flt", x), { toInt: "floor", overflow: "wrap" }));
    });
    expect(moduleSemanticProblems(mir)).toEqual([]);
    expect(mirText(mir)).toMatch(/div %\d+, 3 \{trunc\}/);
    expect(mirText(mir)).toMatch(/conv %\d+ \{toInt floor, wrap\}/);
  });

  it("folds a wrapping operation and keeps a checked one for its run-time check", () => {
    const fold = (overflow: "wrap" | "check") => {
      const mir = program((f, sid) => {
        const a = f.const(sid, imm("u8", 200));
        f.store(sid, "u8", x, f.bin(sid, "add", a, imm("u8", 100), { overflow }));
      });
      optimizeMir(mir, 1);
      return mir.functions[0].blocks[0].instrs.map((i) => (i.op === "const" ? `const ${i.value.kind === "imm" ? i.value.value : "?"}` : i.op));
    };
    expect(fold("wrap")).toEqual(["stmt", "const 44", "store"]);
    expect(fold("check")).toContain("bin");
  });

  it("selects the runtime's truncating division and its magnitude remainder", () => {
    const mir = program((f, sid) => {
      const a = f.load(sid, "i16", x);
      f.store(sid, "i16", x, f.bin(sid, "mod", a, imm("i16", 3), { rounding: "magnitude" }));
    });
    const runtime = new Set<string>();
    const lines = selectFunction(mir.functions[0], runtime).flatMap((l) => (l.kind === "instr" ? [l.text.trim()] : []));
    expect(lines).toContain("call core.DivModI16");
    expect(runtime.has("core.DivModI16")).toBe(true);
  });
});
