import { describe, expect, it } from "vitest";

import {
  canStepOut,
  locateActivations,
  SourceDebugIndex,
  type SourceStepKind
} from "@emu/machines/SourceStepDecision";

import { startBasic } from "./run-kit";

/**
 * Source-level stepping (plan §10.2, §10.3) on the 48K: every row of the plan's scenario tables,
 * stepped through a compiled program on the real machine. A stop is written as the statement's
 * source text, with `↩` in front for a return point (the middle of the calling statement).
 */
async function debug(source: string, optimize = 0) {
  const { session, generated, done } = await startBasic(source, { optimize });
  const info = generated.debug.sourceLevel;
  const index = new SourceDebugIndex(info);
  const debugSupport = session.attachDebugSupport();
  const lines = source.split("\n");
  const text = (i: number) => {
    const s = info.statements[i];
    return lines[s.startLine - 1].slice(
      s.startColumn,
      s.startLine === s.endLine ? s.endColumn : undefined
    );
  };
  const where = () => {
    const i = index.statementAt(session.machine.pc);
    return i < 0 ? "<runtime>" : text(i);
  };
  const view = () => ({
    pc: session.machine.pc,
    sp: session.machine.sp,
    ix: session.machine.ix,
    readWord: (a: number) => session.peekWord(a)
  });
  const step = (
    kind: SourceStepKind,
    options: { targetFrame?: number; targetCallable?: number } = {}
  ) => {
    const st = session.sourceStep(index, kind, { returnTo: done, ...options });
    if (!st) return "<end>";
    return `${st.stoppedAt === "returnPoint" ? "↩ " : ""}${st.stopStatement !== undefined && st.stopStatement >= 0 ? text(st.stopStatement) : where()}`;
  };
  const steps = (kind: SourceStepKind, count: number) =>
    Array.from({ length: count }, () => step(kind));
  /** A breakpoint on the statement whose text starts at this line and column (1-based line). */
  const breakAt = (line: number, column = -1) => {
    const s = info.statements.find(
      (x) => x.startLine === line && (column < 0 || x.startColumn === column)
    )!;
    debugSupport.addBreakpoint({ address: s.startAddress, exec: true });
    return s.startAddress;
  };
  const callable = (name: string) => info.callables.findIndex((c) => c.name === name);
  // --- The program starts at the harness's stub: the first Step Into reaches its first statement
  const first = step("into");
  return { session, info, index, step, steps, where, view, breakAt, callable, first, debugSupport };
}

const CALLS = [
  "SUB DrawBox(a AS UByte, b AS UByte)", // 1
  "  PRINT a;", // 2
  "  PRINT b", // 3
  "END SUB", // 4
  "FUNCTION f(n AS UByte) AS UByte", // 5
  "  RETURN n + 1", // 6
  "END FUNCTION", // 7
  "FUNCTION g(n AS UByte) AS UByte", // 8
  "  RETURN n * 2", // 9
  "END FUNCTION", // 10
  "FUNCTION Fact(n AS UInteger) AS UInteger", // 11
  "  IF n < 2 THEN RETURN 1", // 12
  "  n = n * Fact(n - 1)", // 13
  "  RETURN n", // 14
  "END FUNCTION", // 15
  "FUNCTION FASTCALL h(n AS UByte) AS UByte", // 16
  "  RETURN n + 10", // 17
  "END FUNCTION", // 18
  "SUB quit()", // 19
  "  END", // 20
  "END SUB", // 21
  "DIM x, k AS UByte", // 22
  "DIM r AS UInteger", // 23
  "DrawBox 1, 2", // 24
  "x = f(1) + g(2)", // 25
  "GOSUB bump", // 26
  "k = 1", // 27
  "ON k GOSUB bump, bump", // 28
  "r = Fact(3)", // 29
  "x = f(g(1))", // 30
  "x = h(5)", // 31
  "PRINT x; r", // 32
  "quit()", // 33
  'PRINT "after"', // 34
  "END", // 35
  "bump:", // 36
  '  PRINT "sub";', // 37
  "  RETURN", // 38
  ""
].join("\n");

/** Every scenario, at a level: level 1 must stop exactly where level 0 does (plan §7.1, §10.3). */
function scenarios(level: number) {
  const dbg = (source: string) => debug(source, level);

  describe("Step Over (§10.2.3)", () => {
    it("runs SUB and FUNCTION calls, GOSUB and ON GOSUB completely", async () => {
      const d = await dbg(CALLS);
      expect(d.first).toBe("DrawBox 1, 2");
      expect(d.steps("over", 9)).toEqual([
        "x = f(1) + g(2)",
        "GOSUB bump",
        "k = 1",
        "ON k GOSUB bump, bump",
        "r = Fact(3)",
        "x = f(g(1))",
        "x = h(5)",
        "PRINT x; r",
        "quit()"
      ]);
    });

    it("steps over a recursive call without stopping in the deeper activations", async () => {
      const d = await dbg(CALLS);
      d.breakAt(13);
      d.session.continueToBreakpoint();
      d.debugSupport.eraseAllBreakpoints();
      const depth = locateActivations(d.index, d.view()).length;
      expect(depth).toBe(2);
      expect(d.step("over")).toBe("RETURN n");
      // --- The same activation of Fact: n is 3 * Fact(2) = 6 there
      expect(locateActivations(d.index, d.view()).length).toBe(2);
      expect(d.session.peekWord(d.session.machine.ix + 4)).toBe(6);
    });

    it("from a routine's last statement, goes to the caller's next statement or its return point", async () => {
      const d = await dbg(CALLS);
      expect(d.step("into")).toBe("PRINT a;");
      expect(d.steps("over", 3)).toEqual(["PRINT b", "END SUB", "x = f(1) + g(2)"]);
      // --- f's caller calls g after it: the return point, then the rest of the statement
      expect(d.steps("into", 1)).toEqual(["RETURN n + 1"]);
      expect(d.steps("over", 3)).toEqual(["END FUNCTION", "↩ x = f(1) + g(2)", "GOSUB bump"]);
    });

    it("stops at a breakpoint inside the called routine", async () => {
      const d = await dbg(CALLS);
      d.breakAt(3);
      expect(d.step("over")).toBe("PRINT b");
    });

    it("runs on when the call never returns (END inside the callee)", async () => {
      const d = await dbg(CALLS);
      d.breakAt(33);
      d.session.continueToBreakpoint();
      expect(d.step("over")).toBe("<end>");
    });
  });

  describe("Step Into (§10.2.4)", () => {
    it("stops at the first statement of a SUB, a GOSUB subroutine and an ON GOSUB target", async () => {
      const d = await dbg(CALLS);
      expect(d.step("into")).toBe("PRINT a;");
      const gosub = await dbg(CALLS);
      gosub.breakAt(26);
      gosub.session.continueToBreakpoint();
      expect(gosub.step("into")).toBe('PRINT "sub";');
      const on = await dbg(CALLS);
      on.breakAt(28);
      on.session.continueToBreakpoint();
      expect(on.step("into")).toBe('PRINT "sub";');
    });

    it("runs the runtime through: a PRINT is one step", async () => {
      const d = await dbg(CALLS);
      d.breakAt(32);
      d.session.continueToBreakpoint();
      expect(d.step("into")).toBe("quit()");
    });

    it("enters f(g(1)) at g, stops at the return point, then enters f", async () => {
      const d = await dbg(CALLS);
      d.breakAt(30);
      d.session.continueToBreakpoint();
      expect(d.steps("into", 5)).toEqual([
        "RETURN n * 2",
        "END FUNCTION",
        "↩ x = f(g(1))",
        "RETURN n + 1",
        "END FUNCTION"
      ]);
      expect(d.step("into")).toBe("x = h(5)");
    });

    it("stops in a SUB whose body is an ASM block, at the block", async () => {
      const source =
        "SUB poke7()\n  ASM\n    ld a,7\n    ld (40000),a\n  END ASM\nEND SUB\npoke7()\nPRINT PEEK 40000\n";
      const d = await dbg(source);
      expect(d.first).toBe("poke7()");
      expect(d.step("into")).toBe("ASM\n    ld a,7\n    ld (40000),a\n  END ASM".split("\n")[0]);
      expect(d.steps("into", 2)).toEqual(["END SUB", "PRINT PEEK 40000"]);
    });

    it("Step Into Target runs the other calls through and enters the chosen one", async () => {
      const d = await dbg(CALLS);
      d.breakAt(25);
      d.session.continueToBreakpoint();
      expect(d.step("intoTarget", { targetCallable: d.callable("g") })).toBe("RETURN n * 2");
      // --- f ran completely first: it is not on the stack
      expect(
        locateActivations(d.index, d.view()).map((a) => d.info.callables[a.callableIndex].name)
      ).toEqual(["g", "main"]);
    });
  });

  describe("Step Out (§10.2.5)", () => {
    it("stops at the return point of a SUB, a FASTCALL FUNCTION and a GOSUB", async () => {
      const d = await dbg(CALLS);
      expect(d.step("into")).toBe("PRINT a;");
      expect(d.step("out")).toBe("↩ DrawBox 1, 2");
      const fast = await dbg(CALLS);
      fast.breakAt(17);
      fast.session.continueToBreakpoint();
      expect(fast.step("out")).toBe("↩ x = h(5)");
      const gosub = await dbg(CALLS);
      gosub.breakAt(37);
      gosub.session.continueToBreakpoint();
      expect(gosub.step("out")).toBe("↩ GOSUB bump");
    });

    it("returns one level of recursion: to the calling activation of Fact", async () => {
      const d = await dbg(CALLS);
      d.breakAt(29);
      d.session.continueToBreakpoint();
      expect(d.steps("into", 3)).toEqual(["IF n < 2", "n = n * Fact(n - 1)", "IF n < 2"]);
      expect(locateActivations(d.index, d.view()).length).toBe(3);
      expect(d.step("out")).toBe("↩ n = n * Fact(n - 1)");
      expect(locateActivations(d.index, d.view()).length).toBe(2);
    });

    it("has nothing to return to in the main program", async () => {
      const d = await dbg(CALLS);
      expect(canStepOut(locateActivations(d.index, d.view()))).toBe(false);
      d.step("into");
      expect(canStepOut(locateActivations(d.index, d.view()))).toBe(true);
    });

    it("from runtime code (after Z80 steps), returns to the innermost user activation's caller", async () => {
      const d = await dbg(CALLS);
      expect(d.step("into")).toBe("PRINT a;");
      // --- Into the runtime's PRINT: instruction steps until PC leaves the statement
      for (let i = 0; i < 40 && d.index.statementAt(d.session.machine.pc) >= 0; i++)
        d.session.step();
      expect(d.where()).toBe("<runtime>");
      expect(
        locateActivations(d.index, d.view()).map((a) => d.info.callables[a.callableIndex].name)
      ).toEqual(["DrawBox", "main"]);
      expect(d.step("out")).toBe("↩ DrawBox 1, 2");
    });

    it("Run to Frame returns through several activations at once", async () => {
      const d = await dbg(CALLS);
      d.breakAt(12);
      d.session.continueToBreakpoint();
      d.session.continueToBreakpoint();
      d.session.continueToBreakpoint();
      // --- Fact(1), Fact(2), Fact(3), main: run to the main program's frame
      expect(locateActivations(d.index, d.view()).length).toBe(4);
      d.debugSupport.eraseAllBreakpoints();
      expect(d.step("runToFrame", { targetFrame: 3 })).toBe("↩ r = Fact(3)");
      expect(locateActivations(d.index, d.view()).length).toBe(1);
    });

    it("records the returned values: a FUNCTION's result is in the ABI registers (§10.2.6)", async () => {
      const d = await dbg(CALLS);
      d.breakAt(6);
      d.session.continueToBreakpoint();
      d.session.sourceStep(d.index, "out");
      const step = d.debugSupport.sourceStep!;
      expect(
        step.returned.map((r) => [d.info.callables[r.callableIndex].name, r.registers.af >> 8])
      ).toEqual([["f", 2]]);
      d.debugSupport.eraseAllBreakpoints();
      d.breakAt(9);
      d.session.continueToBreakpoint();
      d.session.sourceStep(d.index, "out");
      expect(d.debugSupport.sourceStep!.returned.map((r) => r.registers.af >> 8)).toEqual([4]);
    });
  });

  describe("statements sharing a line (§10.3)", () => {
    const LINES = [
      "FUNCTION f(n AS UByte) AS UByte", // 1
      "  RETURN n + 1", // 2
      "END FUNCTION", // 3
      "DIM a, b, c, i, x AS UByte", // 4
      "DIM k$ AS String", // 5
      "a = 1 : b = 2 : PRINT a + b", // 6
      "FOR i = 1 TO 3 : PRINT i : NEXT i", // 7
      "IF a > 0 THEN a = 1 : b = 2 ELSE c = 3", // 8
      'IF k$ = "" THEN GOTO there : REM wait', // 9
      'PRINT "skipped"', // 10
      "there:", // 11
      "x = f(1) : x = f(2)", // 12
      "PRINT AT 0, 0; a; b; c", // 13
      "PRINT x", // 14
      ""
    ].join("\n");

    it("steps each statement of a line, and each pass of a loop on one line", async () => {
      const d = await dbg(LINES);
      expect(d.first).toBe("a = 1");
      expect(d.steps("into", 16)).toEqual([
        "b = 2",
        "PRINT a + b",
        "FOR i = 1 TO 3",
        "PRINT i",
        "NEXT i",
        "PRINT i",
        "NEXT i",
        "PRINT i",
        "NEXT i",
        "IF a > 0",
        "a = 1",
        "b = 2",
        'IF k$ = ""',
        "GOTO there",
        "x = f(1)",
        "RETURN n + 1"
      ]);
    });

    it("steps over calls statement by statement on one line; into lands back at the next statement", async () => {
      const d = await dbg(LINES);
      d.breakAt(12);
      d.session.continueToBreakpoint();
      expect(d.steps("over", 3)).toEqual(["x = f(2)", "PRINT AT 0, 0; a; b; c", "PRINT x"]);
      const into = await dbg(LINES);
      into.breakAt(12);
      into.session.continueToBreakpoint();
      expect(into.steps("into", 3)).toEqual(["RETURN n + 1", "END FUNCTION", "x = f(2)"]);
    });

    it("stops again at a statement that restarts itself", async () => {
      const d = await dbg("10 GOTO 10\n");
      expect(d.first).toBe("GOTO 10");
      expect(d.steps("into", 3)).toEqual(["GOTO 10", "GOTO 10", "GOTO 10"]);
      // --- DO : ... : LOOP on one line: every pass stops at each statement again
      const loop = await dbg("DIM n AS UByte\nDO : n = n + 1 : LOOP\n");
      const pass = loop.steps("over", 2);
      expect(loop.steps("over", 6)).toEqual([...pass, ...pass, ...pass]);
      expect(loop.session.peek(loop.session.program.symbol("_n"))).toBe(4);
    });

    it("Step Over Line runs the rest of the line, loops on it included", async () => {
      const d = await dbg(LINES);
      expect(d.steps("overLine", 4)).toEqual([
        "FOR i = 1 TO 3",
        "IF a > 0",
        'IF k$ = ""',
        "x = f(1)"
      ]);
    });
  });

  describe("interrupts (§10.2.7)", () => {
    // --- An IM2 handler in BASIC: a vector table at $FE00 pointing at $FDFD, where asm saves the
    // --- registers and calls the SUB. The main program counts in a loop while the handler ticks.
    const IM2 = [
      "DIM ticks, n AS UInteger", // 1
      "SUB tick()", // 2
      "  ticks = ticks + 1", // 3
      "END SUB", // 4
      "ASM", // 5
      "    ld hl,$fe00", // 6
      "    ld de,$fe01", // 7
      "    ld bc,256", // 8
      "    ld (hl),$fd", // 9
      "    ldir", // 10
      "    ld a,$c3", // 11
      "    ld ($fdfd),a", // 12
      "    ld hl,isr", // 13
      "    ld ($fdfe),hl", // 14
      "    ld a,$fe", // 15
      "    ld i,a", // 16
      "    im 2", // 17
      "    jr done", // 18
      "isr:", // 19
      "    push af", // 20
      "    push bc", // 21
      "    push de", // 22
      "    push hl", // 23
      "    push ix", // 24
      "    call _tick", // 25
      "    pop ix", // 26
      "    pop hl", // 27
      "    pop de", // 28
      "    pop bc", // 29
      "    pop af", // 30
      "    ei", // 31
      "    reti", // 32
      "done:", // 33
      "END ASM", // 34
      "DO", // 35
      "  n = n + 1", // 36
      "  PAUSE 1", // 37: a HALT: the next interrupt comes during this statement
      "LOOP", // 38
      ""
    ].join("\n");

    it("runs an interrupt handler outside the step", async () => {
      const d = await dbg(IM2);
      const ticks = () => d.session.peekWord(d.session.program.symbol("_ticks"));
      const seen = new Set<string>();
      for (let i = 0; i < 60 && ticks() < 3; i++) seen.add(d.step("into"));
      expect(ticks()).toBeGreaterThanOrEqual(3);
      expect(seen.has("ticks = ticks + 1")).toBe(false);
    });

    it("stops in the handler with the setting on", async () => {
      const d = await dbg(IM2);
      let stops = "";
      for (let i = 0; i < 60 && stops !== "ticks = ticks + 1"; i++) {
        const st = d.session.sourceStep(d.index, "into", { stopInInterrupts: true });
        stops =
          st?.stopStatement !== undefined
            ? d.info.statements[st.stopStatement].startLine === 3
              ? "ticks = ticks + 1"
              : ""
            : "";
      }
      expect(stops).toBe("ticks = ticks + 1");
      expect(d.session.interruptDepth()).toBe(1);
    });
  });
}

for (const level of [0, 1, 2]) describe(`optimize ${level}`, () => scenarios(level));
