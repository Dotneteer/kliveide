import { describe, expect, it } from "vitest";

import type { SyntaxNode } from "@common/utils/breakpoint-condition/condition-parser";
import { parseDezogExpression } from "@common/utils/breakpoint-condition/dezog/dezog-parser";
import { annotationsInComment } from "@common/utils/source-annotations";
import { KLIVE_UNIT_TEST_INCLUDE } from "@main/unit-tests/includes/kliveInclude";
import { SJASMPLUS_UNIT_TEST_INCLUDE } from "@main/unit-tests/includes/sjasmplusInclude";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

import { assembleWithInclude, INCLUDE_LINES } from "./unitTestSupport";

/*
 * Klive's unit-test includes (`.plans/Z80_UNIT_TESTS_PLAN.md` D4, D5, T2, T9).
 */

/** Every assertion macro of the Klive include, with arguments */
const INVOCATIONS = [
  "TEST_A(5)",
  "TEST_A_UNEQUAL(5)",
  "TEST_REG(b, 5)",
  "TEST_DREG(hl, $4000)",
  "TEST_FLAG_Z()",
  "TEST_FLAG_NZ()",
  "TEST_FAIL()",
  "TEST_MEMORY_BYTE(Data, 5)",
  "TEST_MEMORY_WORD(Data, $1234)",
  'TEST_STRING(Data, "AB", 1)',
  "TEST_STRING_PTR(Data, Data, 0)",
  "TEST_MEM_CMP(Data, Data, 4)",
  "TEST_UNCHANGED_A()",
  "TEST_UNCHANGED_B()",
  "TEST_UNCHANGED_C()",
  "TEST_UNCHANGED_D()",
  "TEST_UNCHANGED_E()",
  "TEST_UNCHANGED_H()",
  "TEST_UNCHANGED_L()",
  "TEST_UNCHANGED_BC()",
  "TEST_UNCHANGED_DE()",
  "TEST_UNCHANGED_HL()",
  "TEST_UNCHANGED_BC_DE()",
  "TEST_UNCHANGED_BC_DE_HL()"
];

function readsMemory(node: SyntaxNode): boolean {
  switch (node.k) {
    case "mem":
      return true;
    case "un":
      return readsMemory(node.e);
    case "bin":
      return readsMemory(node.l) || readsMemory(node.r);
    case "call":
      return readsMemory(node.arg);
    default:
      return false;
  }
}

describe("the Klive include", () => {
  it("assembles with every macro invoked", async () => {
    const output = await assembleWithInclude(`
  .org $8000
  UNITTEST_INITIALIZE()
    ret
UT_all:
    DEFAULT_REGS()
    USE_ALL_REGS()
${INVOCATIONS.map((i) => `    ${i}`).join("\n")}
    TC_END()
Data: .defb 1, 2, 3, 4
`);
    expect(output.errors.filter((e) => !e.isWarning)).toEqual([]);
  });

  it("gives every assertion macro exactly one ASSERTION per invocation, on the invocation line (T2)", async () => {
    for (const invocation of INVOCATIONS) {
      const output = await assembleWithInclude(`
  .org $8000
  ${invocation}
  ${invocation}
Data: .defb 1, 2, 3, 4
`);
      const assertions = output.debugAnnotations.filter((a) => a.kind === "ASSERTION");
      expect(assertions, invocation).toHaveLength(2);
      expect(assertions.map((a) => a.invokedAt?.line), invocation).toEqual([INCLUDE_LINES + 3, INCLUDE_LINES + 4]);
      expect(assertions[0].address, invocation).not.toBe(assertions[1].address);
      // --- No warning: every expression compiled
      expect(output.errors.filter((e) => e.errorCode === "AS001"), invocation).toEqual([]);
    }
  });

  it("asserts on registers and constants only, as DeZog's expressions allow (T9)", async () => {
    for (const include of [KLIVE_UNIT_TEST_INCLUDE, SJASMPLUS_UNIT_TEST_INCLUDE]) {
      const assertions = include
        .split("\n")
        .flatMap((line) => annotationsInComment(line.substring(Math.max(0, line.indexOf(";")))))
        .filter((a) => a.kind === "ASSERTION" && a.text);
      expect(assertions.length).toBeGreaterThan(20);
      for (const { text } of assertions) {
        // --- The sjasmplus include writes parameters by name; DeZog's expressions take any label
        // --- A Klive macro argument (`{{reg}}`) stands for a register
        const expression = text.replace(/\{\{\w+\}\}/g, "B");
        expect(readsMemory(parseDezogExpression(expression)), text).toBe(false);
      }
    }
  });

  it("carries no DeZog keyword outside its assertion lines", () => {
    for (const include of [KLIVE_UNIT_TEST_INCLUDE, SJASMPLUS_UNIT_TEST_INCLUDE]) {
      const stray = include
        .split("\n")
        .filter((line) => annotationsInComment(line.substring(Math.max(0, line.indexOf(";")))).length)
        .filter((line) => !/^\s+nop ; ASSERTION/.test(line));
      expect(stray).toEqual([]);
    }
  });

  it("lays down the DeZog labels in the global scope, as written", async () => {
    const output = await assembleWithInclude(`
  .org $8000
  .module Tests
  UNITTEST_INITIALIZE()
    ret
  .endmodule
`);
    for (const name of ["UNITTEST_TEST_WRAPPER", "UNITTEST_CALL_ADDR", "UNITTEST_TEST_READY_SUCCESS", "UNITTEST_STACK_BOTTOM", "UNITTEST_STACK", "UNITTEST_START"]) {
      const symbol = output.symbols[name.toLowerCase()];
      expect(symbol, name).toBeDefined();
      expect(symbol.writtenName, name).toBe(name);
    }
  });
});

describe("annotations in macros", () => {
  it("leaves a comment outside a macro without an invocation", async () => {
    const output = await new Z80Assembler().compile("  .org $8000\n  nop ; ASSERTION A == 1\n", new AssemblerOptions());
    expect(output.debugAnnotations[0].invokedAt).toBeUndefined();
  });

  it("names the outermost invocation for nested macros", async () => {
    const output = await new Z80Assembler().compile(
      `  .org $8000
Inner: .macro()
    nop ; ASSERTION A == 1
  .endm
Outer: .macro()
    Inner()
  .endm
  Outer()
`,
      new AssemblerOptions()
    );
    expect(output.debugAnnotations).toHaveLength(1);
    expect(output.debugAnnotations[0]).toMatchObject({ line: 3, invokedAt: { fileIndex: 0, line: 8 } });
  });
});
