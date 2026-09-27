import { describe, expect, it } from "vitest";

import {
  CurrentStatementTracker,
  innermostUserStatement,
  locateActivations,
  SourceDebugIndex,
  type SourceStepKind
} from "@emu/machines/SourceStepDecision";

import {
  bankedMemoryView,
  bankPagesOf,
  memoryView
} from "@renderer/appIde/debugger/source/value-decoder";
import { buildVariableSections } from "@renderer/appIde/debugger/source/variables-model";
import { evaluateWatch } from "@renderer/appIde/debugger/source/watch-expression";

import { startBasicNext } from "./next-kit";

/**
 * Source-level debugging across CODEBANK banks (plan §9.4, §10.2, §10.4, §10.6) on the Next
 * harness. Banks share the window's addresses, so every lookup is by partition (the 8K page); a
 * cross-bank callee's return slot holds the far-return entry, and the frame locator takes the real
 * caller from the far-call runtime's shadow stack. A stop is written as the statement's source text,
 * with `↩` in front for a return point.
 */
const BANKED = [
  "DECLARE FUNCTION Odd(n AS UInteger) AS UByte", // 1
  "DIM result AS UInteger", // 2
  "DIM r AS UByte", // 3
  "CODEBANK 1", // 4
  "FUNCTION Twice(n AS UInteger) AS UInteger", // 5
  "  RETURN n * 2", // 6
  "END FUNCTION", // 7
  "FUNCTION Even(n AS UInteger) AS UByte", // 8
  "  IF n = 0 THEN RETURN 1", // 9
  "  RETURN Odd(n - 1)", // 10
  "END FUNCTION", // 11
  "END CODEBANK", // 12
  "CODEBANK 2", // 13
  "SUB Store(v AS UInteger)", // 14
  "  result = Twice(v) + 1", // 15
  "  PRINT result", // 16
  "END SUB", // 17
  "FUNCTION Odd(n AS UInteger) AS UByte", // 18
  "  IF n = 0 THEN RETURN 0", // 19
  "  RETURN Even(n - 1)", // 20
  "END FUNCTION", // 21
  "END CODEBANK", // 22
  "Store 20", // 23
  "r = Even(3)", // 24
  "PRINT r", // 25
  ""
].join("\n");

async function debug(source: string, optimize = 0) {
  const { session, generated, done } = await startBasicNext(source, { optimize });
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
  const pc = () => session.machine.pc;
  const where = () => {
    const i = index.statementAt(pc(), index.partitionNow(session.machineView(), pc()));
    return i < 0 ? "<runtime>" : text(i);
  };
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
  /** A breakpoint on the first statement of a line (1-based), qualified by its partition as the IDE resolves it. */
  const breakAt = (line: number) => {
    const s = info.statements.find((x) => x.startLine === line)!;
    debugSupport.addBreakpoint({
      address: s.startAddress,
      ...(s.partition !== undefined ? { partition: s.partition } : {}),
      exec: true
    });
    return s;
  };
  const chain = () =>
    locateActivations(index, session.machineView()).map((a) =>
      a.kind === "main"
        ? "main"
        : `${info.callables[a.callableIndex].name}@${a.callSite ? text(a.callSite.statementIndex) : "?"}`
    );
  const first = step("into");
  return { session, info, index, debugSupport, step, steps, where, breakAt, chain, first };
}

/** Every scenario at levels 0 and 1: level 1 must debug across banks exactly as level 0 does. */
function scenarios(level: number) {
  const dbg = (source: string) => debug(source, level);

  describe("CODEBANK debug information", () => {
    it("puts banked statements, callables and call sites in their pages, and describes the far-call runtime", async () => {
      const { info } = await dbg(BANKED);
      const at = (line: number) => info.statements.find((s) => s.startLine === line)!;
      // --- CODEBANK 1 is page 30, CODEBANK 2 page 31; both run at the window, $6000
      expect([at(6).partition, at(15).partition, at(23).partition]).toEqual([30, 31, undefined]);
      expect(at(6).startAddress >> 13).toBe(3);
      expect(at(15).startAddress >> 13).toBe(3);
      expect(info.usesBanking).toBe(true);
      expect(info.partitionedAddressMap!.map((p) => p.partition)).toEqual([30, 31]);
      expect(info.callables.find((c) => c.name === "Odd")!.partition).toBe(31);
      const cb = info.extensions!.codebank!;
      expect(cb).toMatchObject({
        window: 0x6000,
        windowSize: 0x2000,
        banks: [
          { bank: 1, pages: [30] },
          { bank: 2, pages: [31] }
        ]
      });
      expect(cb.farReturn).toBeGreaterThan(0);
    });
  });

  describe("Stepping across banks (§10.2)", () => {
    it("steps into a banked SUB, from there into another bank's FUNCTION, and back", async () => {
      const d = await dbg(BANKED);
      expect(d.first).toBe("Store 20");
      expect(d.steps("into", 5)).toEqual([
        "result = Twice(v) + 1",
        "RETURN n * 2",
        "END FUNCTION",
        "PRINT result",
        "END SUB"
      ]);
      expect(d.step("into")).toBe("r = Even(3)");
    });

    it("steps over calls into banks", async () => {
      const d = await dbg(BANKED);
      expect(d.steps("over", 2)).toEqual(["r = Even(3)", "PRINT r"]);
      expect(d.session.peekWord(d.session.program.symbol("_result"))).toBe(41);
    });

    it("steps out of a cross-bank call to the return point in the caller's bank", async () => {
      const d = await dbg(BANKED);
      d.breakAt(6);
      d.session.continueToBreakpoint();
      d.debugSupport.eraseAllBreakpoints();
      expect(d.where()).toBe("RETURN n * 2");
      expect(d.session.mmuPage(3)).toBe(30);
      expect(d.step("out")).toBe("↩ result = Twice(v) + 1");
      expect(d.session.mmuPage(3)).toBe(31);
      expect(d.step("over")).toBe("PRINT result");
    });

    it("steps over a recursive call that crosses banks without stopping in deeper activations", async () => {
      const d = await dbg(BANKED);
      d.breakAt(19);
      d.session.continueToBreakpoint();
      d.debugSupport.eraseAllBreakpoints();
      // --- Even(3) -> Odd(2): the first stop in Odd
      expect(d.chain()).toEqual(["Odd@RETURN Odd(n - 1)", "Even@r = Even(3)", "main"]);
      expect(d.step("over")).toBe("RETURN Even(n - 1)");
      expect(d.step("over")).toBe("END FUNCTION");
      expect(d.chain()).toEqual(["Odd@RETURN Odd(n - 1)", "Even@r = Even(3)", "main"]);
      expect(d.step("out")).toBe("↩ RETURN Odd(n - 1)");
    });
  });

  describe("Breakpoints and the call stack across banks (§10.4, §10.6)", () => {
    it("stops at a banked breakpoint only when its own page is in the window", async () => {
      const d = await dbg(BANKED);
      // --- Twice's first statement and Store's first share the window's addresses in different pages
      const twice = d.breakAt(6);
      const store = d.info.statements.find((s) => s.startLine === 15)!;
      expect(store.startAddress === twice.startAddress || store.partition !== twice.partition).toBe(
        true
      );
      d.session.continueToBreakpoint();
      expect(d.where()).toBe("RETURN n * 2");
    });

    it("shows the real callers of banked routines, from the shadow stack", async () => {
      const d = await dbg(BANKED);
      d.breakAt(6);
      d.session.continueToBreakpoint();
      expect(d.chain()).toEqual(["Twice@result = Twice(v) + 1", "Store@Store 20", "main"]);
      d.debugSupport.eraseAllBreakpoints();
      d.breakAt(9);
      d.session.continueToBreakpoint(); // Even(3)
      d.session.continueToBreakpoint(); // Even(1), called from Odd(2) in bank 2
      expect(d.chain()).toEqual([
        "Even@RETURN Even(n - 1)",
        "Odd@RETURN Odd(n - 1)",
        "Even@r = Even(3)",
        "main"
      ]);
    });
  });

  describe("Variables and watches across banks (§10.7, §10.8)", () => {
    const DATA = [
      "CODEBANK 1", // 1
      "DIM k AS UInteger = 1234", // 2
      "DIM t(3) AS UByte => {10, 20, 30, 40}", // 3
      'DIM s$ = "bank"', // 4
      "SUB One()", // 5
      "  k = k + 1", // 6
      "END SUB", // 7
      "END CODEBANK", // 8
      "CODEBANK 2", // 9
      "DIM two AS UInteger = 200", // 10
      "SUB Two()", // 11
      "  two = two * 2", // 12
      "END SUB", // 13
      "END CODEBANK", // 14
      "One", // 15
      "Two", // 16
      "PRINT 1", // 17
      ""
    ].join("\n");

    it("reads bank-local data from its bank's pages while resident code runs", async () => {
      const d = await dbg(DATA);
      d.breakAt(17);
      d.session.continueToBreakpoint();
      const info = d.info;
      const codebank = info.extensions!.codebank!;
      // --- The window holds its boot page now: the 64K view does not show the banks' data
      expect(d.session.mmuPage(codebank.window >> 13)).not.toBe(30);
      const flat = memoryView(Uint8Array.from({ length: 0x10000 }, (_, a) => d.session.peek(a)));
      const pages = bankPagesOf(info.extensions!.variables, codebank);
      expect(pages).toEqual([30, 31]);
      const mem = bankedMemoryView(
        flat,
        codebank,
        new Map(pages.map((p) => [p, d.session.machine.getMemoryPartition(p)]))
      );

      const chain = locateActivations(d.index, d.session.machineView());
      const globals = buildVariableSections(info, chain, 0, undefined, mem).globals;
      const row = (name: string) => globals.find((n) => n.name === name)!;
      expect([row("k").value, row("s$").value, row("two").value]).toEqual([
        "1235",
        '"bank"',
        "400"
      ]);
      expect([row("k").bank, row("two").bank]).toEqual([1, 2]);
      // --- Both live at window addresses, each read from its own page
      expect([row("k").address! >> 13, row("two").address! >> 13]).toEqual([3, 3]);
      expect(row("t").expand!().map((n) => [n.value, n.bank])).toEqual([
        ["10", 1],
        ["20", 1],
        ["30", 1],
        ["40", 1]
      ]);

      const watch = (text: string) => {
        const r = evaluateWatch(text, { info, chain, frame: 0, mem });
        return "error" in r ? r.error : r.text;
      };
      expect([watch("t(2) + k"), watch("two / 4"), watch('s$ + "!"')]).toEqual([
        "1265",
        "100",
        '"bank!"'
      ]);
    });
  });

  describe("Runtime-error stops in banked code (§10.10)", () => {
    const FAILS = [
      "DIM a(3) AS UByte", // 1
      "CODEBANK 1", // 2
      "SUB Outer(i AS UByte)", // 3
      "  Inner i", // 4
      "END SUB", // 5
      "END CODEBANK", // 6
      "CODEBANK 2", // 7
      "SUB Inner(i AS UByte)", // 8
      '  PRINT "in"', // 9
      "  ERROR 2", // 10
      "END SUB", // 11
      "END CODEBANK", // 12
      "Outer 9", // 13
      ""
    ].join("\n");

    it("stops at the error routine and names the banked statement and its callers", async () => {
      const d = await dbg(FAILS);
      const errorEntry = d.info.extensions!.errorEntry!;
      d.debugSupport.errorStopAddress = errorEntry;
      d.debugSupport.statementTracker = new CurrentStatementTracker(d.index);
      expect(d.session.continueToBreakpoint()).toBe(errorEntry);
      const tracked = d.debugSupport.statementTracker.current;
      expect(d.info.statements[tracked].startLine).toBe(10);
      const scanned = innermostUserStatement(d.index, d.session.machineView());
      expect(scanned < 0 || d.info.statements[scanned].startLine === 10).toBe(true);
      expect(d.chain()).toEqual(["Inner@Inner i", "Outer@Outer 9", "main"]);
    });
  });

  describe("The call stack inside the far-call runtime (§9.4)", () => {
    it("keeps the outer frames right at every instruction of a cross-bank call and return", async () => {
      const d = await dbg(BANKED);
      d.breakAt(15); // --- Store (bank 2), about to call Twice (bank 1)
      d.session.continueToBreakpoint();
      d.debugSupport.eraseAllBreakpoints();
      const twice = d.info.statements.find((s) => s.startLine === 6)!;
      const back = d.info.statements.find((s) => s.startLine === 16)!;
      const seen = new Set<string>();
      // --- Into Twice through the trampoline and FarCall, then back through FarReturn to PRINT result
      for (let n = 0; n < 2000; n++) {
        d.session.step();
        const pc = d.session.machine.pc;
        const partition = d.session.machine.getPartition(pc);
        // --- A routine's epilogue holds its return address in BC' while it drops the arguments: no
        // --- frame locator can find it there (on any machine), so the check skips epilogues
        const inEpilogue = d.info.extensions!.frames.some(
          (f) =>
            pc >= f.epilogueStart &&
            pc < f.endAddress &&
            (f.partition === undefined || f.partition === partition)
        );
        if (inEpilogue) continue;
        const chain = d.chain();
        // --- Whatever the innermost frame is mid-call, Store's activation and main are always below it
        expect(chain.slice(-2), `at $${pc.toString(16)}`).toEqual(["Store@Store 20", "main"]);
        seen.add(chain[0]);
        if (pc === back.startAddress && partition === back.partition) break;
      }
      expect(seen).toContain("Twice@result = Twice(v) + 1");
      expect(d.session.machine.pc).toBe(back.startAddress);
      expect(twice.partition).toBe(30);
    });
  });
}

for (const level of [0, 1, 2]) describe(`optimize ${level}`, () => scenarios(level));
