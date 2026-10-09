import { describe, expect, it } from "vitest";

import { discoverUnitTests, MISSING_LABELS_MESSAGE } from "@common/unit-tests/discovery";
import { selectTests, testIdMatches } from "@common/unit-tests/unitTestTypes";
import { flattenSymbols } from "@common/utils/flatten-symbols";
import { integerSymbolsOfOutput } from "@common/utils/breakpoint-condition/integer-symbols";
import { extractSldInfo, sldAnnotations, sldSymbols } from "@main/sjasmp-integration/SjasmPCompiler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

import { assembleWithInclude } from "./unitTestSupport";

/*
 * Unit-test discovery (`.plans/Z80_UNIT_TESTS_PLAN.md` §4.1, D1, T3, T4): DeZog's label conventions on
 * Klive assembler output (modules, case-insensitive builds) and on sjasmplus SLD data.
 */

const KLIVE = `
  .org $8000
  UNITTEST_INITIALIZE()
    ret

UT_First:
    TC_END()
ut_lowercase:            ; written lower-case: not a test (T3)
    TC_END()
NotATest:
    ret

  .module Module1
UT_test2:
    TC_END()
  .module Inner
UT_deep:
    TC_END()
  .endmodule
  .endmodule
`;

describe("discovery, Klive assembler", () => {
  it("finds UT_ labels with their suites as written", async () => {
    const output = await assembleWithInclude(KLIVE);
    const program = discoverUnitTests(output as never);
    expect(program.problems).toEqual([]);
    expect(program.tests.map((t) => t.id)).toEqual(["UT_First", "Module1.UT_test2", "Module1.Inner.UT_deep"]);
    const test2 = program.tests[1];
    expect(test2).toMatchObject({ label: "UT_test2", suitePath: ["Module1"], file: "#" });
    expect(test2.address).toBe((output.getNestedModule("module1")!.getSymbol("ut_test2")!.value.value as number) & 0xffff);
    expect(test2.line).toBeGreaterThan(0);
  });

  it("finds the runner's labels, with the stack guards", async () => {
    const output = await assembleWithInclude(KLIVE);
    const { labels, notes } = discoverUnitTests(output as never);
    expect(labels).toBeDefined();
    expect(labels!.callAddr.address).toBe(labels!.wrapper.address + 4); // di; ld sp,nn
    expect(labels!.stackTop!.address - labels!.stackBottom!.address).toBe(100);
    expect(notes).toEqual([]);
  });

  it("says how to fix a program without the test frame (D1)", async () => {
    const options = new AssemblerOptions();
    const output = await new Z80Assembler().compile("  .org $8000\nUT_x:\n  ret\n", options);
    const program = discoverUnitTests(output as never);
    expect(program.labels).toBeUndefined();
    expect(program.problems).toHaveLength(1);
    expect(program.problems[0]).toContain(MISSING_LABELS_MESSAGE);
    expect(program.problems[0]).toContain("UNITTEST_START");
  });

  it("notes a frame without the stack labels", async () => {
    const options = new AssemblerOptions();
    const output = await new Z80Assembler().compile(
      `  .org $8000
UNITTEST_TEST_WRAPPER: di
UNITTEST_CALL_ADDR: call 0
UNITTEST_TEST_READY_SUCCESS: jr UNITTEST_TEST_READY_SUCCESS
UNITTEST_START: ret
UT_a: jp UNITTEST_TEST_READY_SUCCESS
`,
      options
    );
    const program = discoverUnitTests(output as never);
    expect(program.labels).toBeDefined();
    expect(program.notes[0]).toMatch(/guards are skipped/);
  });

  it("is case-sensitive on the spelling in a case-sensitive build", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    const output = await new Z80Assembler().compile("  .org $8000\nUT_a:\n  ret\nut_b:\n  ret\n", options);
    expect(discoverUnitTests(output as never).tests.map((t) => t.id)).toEqual(["UT_a"]);
  });

  it("puts a banked test in its bank's partition", async () => {
    const options = new AssemblerOptions();
    const output = await new Z80Assembler().compile(
      "  .model Spectrum128\n  .bank 3\n  .org $C000\nUT_banked:\n  ret\n",
      options
    );
    const [test] = discoverUnitTests(output as never, "sp128").tests;
    expect(test).toMatchObject({ address: 0xc000, partition: 3 });
  });
});

describe("discovery, sjasmplus SLD", () => {
  const SLD = [
    "|SLD.data.version|1",
    "main.asm|1||0|-1|-1|Z|pages.size:16384,pages.count:8,slots.count:4,slots.adr:0,16384,32768,49152",
    "unit_tests.inc|30|main.asm|5|2|32768|L|,UNITTEST_TEST_WRAPPER,",
    "unit_tests.inc|33|main.asm|5|2|32772|L|,UNITTEST_CALL_ADDR,",
    "unit_tests.inc|37|main.asm|5|2|32777|L|,UNITTEST_TEST_READY_SUCCESS,",
    "unit_tests.inc|39|main.asm|5|2|32779|L|,UNITTEST_STACK_BOTTOM,",
    "unit_tests.inc|41|main.asm|5|2|32879|L|,UNITTEST_STACK,",
    "unit_tests.inc|43|main.asm|5|2|32881|L|,UNITTEST_START,",
    "tests.asm|3||0|2|32900|L|TestSuite_A,,,+module",
    "tests.asm|4||0|2|32900|L|TestSuite_A,UT_add,",
    "tests.asm|9||0|2|32910|L|TestSuite_A,UT_sub,",
    "tests.asm|12||0|2|32920|L|TestSuite_A,UT_sub,loop",
    "tests.asm|20||0|2|32930|L|,UT_root,",
    "tests.asm|6||0|2|32905|K|; ASSERTION A == B"
  ].join("\n");

  function output() {
    const files: string[] = [];
    const fileIndexOf = (f: string) => {
      if (!files.includes(f)) files.push(f);
      return files.indexOf(f);
    };
    const lines = extractSldInfo(SLD);
    const symbols = sldSymbols(lines, { fileIndexOf });
    const debugAnnotations = sldAnnotations(lines, fileIndexOf);
    return { symbols, debugAnnotations, sourceFileList: files.map((filename) => ({ filename })) };
  }

  it("finds tests in modules and at the root, spelled as in the SLD", () => {
    const program = discoverUnitTests(output() as never);
    expect(program.problems).toEqual([]);
    expect(program.tests.map((t) => t.id)).toEqual(["TestSuite_A.UT_add", "TestSuite_A.UT_sub", "UT_root"]);
    expect(program.tests[0]).toMatchObject({ suitePath: ["TestSuite_A"], file: "tests.asm", line: 4, address: 32900 });
    expect(program.labels!.start.address).toBe(32881);
    expect(program.labels!.stackTop!.address).toBe(32879);
  });
});

describe("flattening and selection", () => {
  it("makes module labels usable in conditions (T4)", async () => {
    const output = await assembleWithInclude(KLIVE);
    const flat = flattenSymbols(output as never);
    expect(Object.keys(flat)).toContain("module1.inner.ut_deep");
    expect(integerSymbolsOfOutput(output)["module1.ut_test2"]).toBeGreaterThan(0x8000);
  });

  it("matches test ids with * patterns", () => {
    expect(testIdMatches("Module1.UT_a", "Module1.*")).toBe(true);
    expect(testIdMatches("Module1.UT_a", "*UT_a")).toBe(true);
    expect(testIdMatches("Module1.UT_a", "UT_a")).toBe(false);
    expect(testIdMatches("A.UT_x", "A.UT_?")).toBe(false);
    const tests = [{ id: "A.UT_1" }, { id: "A.UT_2" }, { id: "B.UT_1" }];
    expect(selectTests(tests, { include: ["A.*"] }).map((t) => t.id)).toEqual(["A.UT_1", "A.UT_2"]);
    expect(selectTests(tests, { ids: ["B.UT_1"] }).map((t) => t.id)).toEqual(["B.UT_1"]);
  });
});
