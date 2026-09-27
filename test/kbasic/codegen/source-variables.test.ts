import { describe, expect, it } from "vitest";

import { innermostUserStatement, locateActivations, SourceDebugIndex } from "@emu/machines/SourceStepDecision";
import { buildSourceCallStack } from "@renderer/appIde/debugger/source/call-stack-model";
import { decodeRegisters, memoryView, spectrumText, type MemoryView } from "@renderer/appIde/debugger/source/value-decoder";
import { buildVariableSections, type VariableNode } from "@renderer/appIde/debugger/source/variables-model";
import { evaluateWatch, parseWatch } from "@renderer/appIde/debugger/source/watch-expression";

import { startBasic } from "./run-kit";

/**
 * The symbolic call stack, the Variables panel and BASIC watches (plan §10.6–§10.8) on the 48K:
 * a program stops at a breakpoint, and what the panels would show is read from the real machine.
 */
const PROGRAM = [
  "DIM b AS Byte = -5", // 1
  "DIM u AS UInteger = 60000", // 2
  "DIM i AS Integer = -1234", // 3
  "DIM l AS Long = -100000", // 4
  "DIM fx AS Fixed = 1.5", // 5
  "DIM fl AS Float = 3.25", // 6
  "DIM s$ AS String", // 7
  "DIM grid(1 TO 2, 3) AS UByte", // 8
  "DIM big(250) AS UInteger", // 9
  "CONST limit AS UByte = 7", // 10
  "SUB Show(n AS UByte, t$ AS String, BYREF r AS Integer)", // 11
  "  DIM k AS UInteger", // 12
  "  k = 1000 + n", // 13
  "  r = r + 1", // 14
  "  PRINT t$; k", // 15
  "END SUB", // 16
  "FUNCTION Fact(n AS UInteger) AS UInteger", // 17
  "  IF n < 2 THEN RETURN 1", // 18
  "  RETURN n * Fact(n - 1)", // 19
  "END FUNCTION", // 20
  's$ = "Hi" + CHR$(96) + CHR$(13)', // 21
  "grid(2, 1) = 42", // 22
  "big(200) = 9", // 23
  'Show 3, "ab", i', // 24
  "u = Fact(3)", // 25
  "PRINT u", // 26
  ""
].join("\n");

async function stopAt(line: number) {
  const started = await startBasic(PROGRAM);
  const { session, generated, done } = started;
  const info = generated.debug.sourceLevel;
  const index = new SourceDebugIndex(info);
  const debugSupport = session.attachDebugSupport();
  const s = info.statements.find((x) => x.startLine === line)!;
  debugSupport.addBreakpoint({ address: s.startAddress, exec: true });
  session.continueToBreakpoint({ returnTo: done });
  const mem: MemoryView = { byte: (a) => session.peek(a & 0xffff), word: (a) => session.peekWord(a & 0xffff) };
  const view = () => ({ pc: session.machine.pc, sp: session.machine.sp, ix: session.machine.ix, readWord: (a: number) => session.peekWord(a) });
  const chain = () => locateActivations(index, view());
  const stop = () => ({ kind: "statement" as const, pc: session.machine.pc, statementIndex: index.statementAt(session.machine.pc), returned: [] });
  return { session, info, index, mem, chain, stop, view, debugSupport, done };
}

const row = (nodes: VariableNode[] | undefined, name: string) => nodes?.find((n) => n.name === name);
const values = (nodes: VariableNode[] | undefined) => Object.fromEntries((nodes ?? []).map((n) => [n.name, n.value]));

describe("the Variables panel (§10.7)", () => {
  it("decodes globals of every type from memory", async () => {
    const d = await stopAt(24);
    const { globals, locals } = buildVariableSections(d.info, d.chain(), 0, d.stop(), d.mem);
    expect(locals).toBeUndefined();
    expect(values(globals)).toMatchObject({
      b: "-5",
      u: "60000",
      i: "-1234",
      l: "-100000",
      fx: "1.5",
      fl: "3.25",
      s$: '"Hi£\\#013"',
      limit: "7"
    });
    expect(row(globals, "limit")?.type).toBe("CONST UByte");
    expect(row(globals, "grid")?.type).toBe("UByte(1 TO 2, 0 TO 3)");
  });

  it("expands arrays by dimension, and pages a long one", async () => {
    const d = await stopAt(24);
    const { globals } = buildVariableSections(d.info, d.chain(), 0, d.stop(), d.mem);
    const rows = row(globals, "grid")!.expand!();
    expect(rows.map((r) => r.name)).toEqual(["grid(1, …)", "grid(2, …)"]);
    const second = rows[1].expand!();
    expect(second.map((r) => `${r.name}=${r.value}`)).toEqual(["grid(2, 0)=0", "grid(2, 1)=42", "grid(2, 2)=0", "grid(2, 3)=0"]);
    const pages = row(globals, "big")!.expand!();
    expect(pages.map((p) => p.name)).toEqual(["[0 … 99]", "[100 … 199]", "[200 … 250]"]);
    expect(pages[2].expand!()[0]).toMatchObject({ name: "big(200)", value: "9" });
  });

  it("shows a routine's parameters and locals, a BYREF through its address", async () => {
    const d = await stopAt(15);
    const chain = d.chain();
    const sections = buildVariableSections(d.info, chain, 0, d.stop(), d.mem);
    expect(values(sections.locals)).toEqual({ n: "3", t$: '"ab"', r: "-1233", k: "1003" });
    // --- The BYREF parameter's address is the global's
    const i = d.info.extensions!.variables.find((v) => v.name === "i")!;
    expect(row(sections.locals, "r")?.address).toBe(i.location.at === "absolute" ? i.location.address : -1);
    // --- The outer frame is the main program: no locals
    expect(buildVariableSections(d.info, chain, 1, d.stop(), d.mem).locals).toBeUndefined();
  });

  it("shows each recursive activation's own locals", async () => {
    const d = await stopAt(18);
    // --- Fact(3), then Fact(2), then Fact(1): the third hit is the deepest
    d.session.continueToBreakpoint({ returnTo: d.done });
    d.session.continueToBreakpoint({ returnTo: d.done });
    const chain = d.chain();
    expect(chain.map((a) => a.kind)).toEqual(["routine", "routine", "routine", "main"]);
    const n = (frame: number) => row(buildVariableSections(d.info, chain, frame, d.stop(), d.mem).locals, "n")?.value;
    expect([n(0), n(1), n(2)]).toEqual(["1", "2", "3"]);
  });

  it("decodes a FUNCTION result from its return registers", () => {
    const mem = memoryView(new Uint8Array(0x10000));
    const regs = { af: 0x8200, bc: 0x0000, de: 0x0020, hl: 0x0000 };
    // --- 2.5 = exponent $82, mantissa $20 00 00 00 (sign bit clear)
    expect(decodeRegisters("float", regs, mem).text).toBe("2.5");
    expect(decodeRegisters("integer", { af: 0, bc: 0, de: 0, hl: 0xfffe }, mem).text).toBe("-2");
    expect(decodeRegisters("long", { af: 0, bc: 0, de: 0x0001, hl: 0x0000 }, mem).text).toBe("65536");
    expect(decodeRegisters("fixed", { af: 0, bc: 0, de: 0xffff, hl: 0x8000 }, mem).text).toBe("-0.5");
    expect(decodeRegisters("ubyte", { af: 0xc800, bc: 0, de: 0, hl: 0 }, mem).text).toBe("200");
  });

  it("writes Strings in the source's escape form", () => {
    expect(spectrumText([72, 34, 92, 96, 127, 144, 7])).toBe('"H""\\\\£©\\A\\#007"');
  });
});

describe("the symbolic call stack (§10.6)", () => {
  it("names each activation with the statement it stands at", async () => {
    const d = await stopAt(18);
    d.session.continueToBreakpoint({ returnTo: d.done });
    const rows = buildSourceCallStack(d.info, d.chain(), d.stop());
    expect(rows.map((r) => ("runtime" in r ? "runtime" : `${r.frame}:${r.name}:${r.line}`))).toEqual([
      "0:Fact:18",
      "1:Fact:19",
      "2:main:25"
    ]);
  });

  it("puts a runtime row first when PC is in runtime code, and finds the user statement", async () => {
    const d = await stopAt(21);
    // --- Step by instruction into the runtime (the concatenation's call)
    const start = d.index.statementAt(d.session.machine.pc);
    let guard = 0;
    while (d.index.statementAt(d.session.machine.pc) >= 0 && guard++ < 200) d.session.step();
    expect(d.index.statementAt(d.session.machine.pc)).toBe(-1);
    expect(innermostUserStatement(d.index, d.view())).toBe(start);
    const stop = { kind: "other" as const, pc: d.session.machine.pc, statementIndex: -1, userStatementIndex: start, returned: [] };
    const rows = buildSourceCallStack(d.info, d.chain(), stop);
    expect("runtime" in rows[0]).toBe(true);
    expect(rows[1]).toMatchObject({ frame: 0, name: "main", line: 21 });
  });
});

describe("BASIC watch expressions (§10.8)", () => {
  it("evaluates variables, elements, addresses, PEEK and operators", async () => {
    const d = await stopAt(24);
    const ctx = { info: d.info, chain: d.chain(), frame: 0, mem: d.mem };
    const w = (text: string) => {
      const r = evaluateWatch(text, ctx);
      return "error" in r ? `error: ${r.error}` : r.text;
    };
    expect(w("i")).toBe("-1234");
    expect(w("i * 2 + 1")).toBe("-2467");
    expect(w("grid(2, 1)")).toBe("42");
    expect(w("grid(2, 1) = 42 AND u > 1")).toBe("1");
    expect(w("fl / 2")).toBe("1.625");
    expect(w("s$ + \"!\"")).toBe('"Hi£\\#013!"');
    expect(w("LEN(s$)")).toBe("4");
    expect(w("limit + 1")).toBe("8");
    const at = Number(w("@u"));
    expect(d.mem.word(at)).toBe(60000);
    expect(w(`PEEK(UInteger, ${at})`)).toBe("60000");
    expect(w(`PEEK ${at}`)).toBe(String(60000 & 0xff));
    expect(w("@grid(2, 1) - @grid(1, 0)")).toBe("5");
    expect(w("big(251)")).toBe("error: Subscript out of range");
    expect(w("nope")).toBe("error: Unknown variable 'nope'");
    expect(w("grid")).toBe("error: 'grid' is an array: give its subscripts");
  });

  it("sees the selected frame's locals before the globals", async () => {
    const d = await stopAt(15);
    const ctx = { info: d.info, chain: d.chain(), frame: 0, mem: d.mem };
    const r = evaluateWatch("k + n", ctx);
    expect("error" in r ? r.error : r.text).toBe("1006");
    expect(evaluateWatch("k", { ...ctx, frame: 1 })).toEqual({ error: "Unknown variable 'k'" });
  });

  it("reports a syntax error from the compiler's parser", () => {
    expect(parseWatch("a +")).toHaveProperty("error");
    expect(parseWatch("a )")).toHaveProperty("error");
    expect(parseWatch("a(1) + @b")).toHaveProperty("expression");
  });
});

describe("the BASIC watch list (§10.8)", () => {
  it("adds trimmed, distinct expressions, removes by position and restores a project's list", async () => {
    const { basicWatchReducer } = await import("@common/state/watch-reducer");
    const { addBasicWatchAction, removeBasicWatchAction, setBasicWatchesAction } = await import("@common/state/actions");
    let state = basicWatchReducer([], addBasicWatchAction("  a + 1 "));
    state = basicWatchReducer(state, addBasicWatchAction("a + 1"));
    state = basicWatchReducer(state, addBasicWatchAction("grid(1, 2)"));
    state = basicWatchReducer(state, addBasicWatchAction("   "));
    expect(state).toEqual(["a + 1", "grid(1, 2)"]);
    expect(basicWatchReducer(state, removeBasicWatchAction(0))).toEqual(["grid(1, 2)"]);
    expect(basicWatchReducer(state, setBasicWatchesAction(undefined))).toEqual([]);
  });
});
