import { describe, expect, it } from "vitest";

import { INCLUDE_LINES, runProgram } from "./unitTestSupport";

/*
 * The unit-test runner on the real 48K core (`.plans/Z80_UNIT_TESTS_PLAN.md` Phase 1): the outcome
 * matrix of D8 with Klive's own include, deterministic T-states (D20), and LOGPOINT capture (D11).
 */

const PROGRAM = `
  .org $8000
Main:
  ret

  UNITTEST_INITIALIZE()
    xor a
    ld (Counter),a
    ret

Counter: .defb 0
Result: .defw 0

; --- Passing tests
UT_Pass:
    ld a,5
    TEST_A(5)
    TC_END()

UT_InitRunsEveryTime:
    ld a,(Counter)
    inc a
    ld (Counter),a
    TEST_MEMORY_BYTE(Counter, 1)
    TC_END()

UT_Memory:
    ld hl,$1234
    ld (Result),hl
    TEST_MEMORY_WORD(Result, $1234)
    ld hl,Text
    TEST_STRING(Text, "HELLO", 1)
    TEST_MEM_CMP(Text, Copy, 5)
    xor a
    TEST_FLAG_Z()
    DEFAULT_REGS()
    TEST_UNCHANGED_BC_DE_HL()
    TC_END()
Text: .defm "HELLO"
    .defb 0
Copy: .defm "HELLO"

UT_Log:
    ld a,7
    TC_END() ; LOGPOINT A is \${A}

; --- Failing tests
UT_FailValue:
    ld a,7
    TEST_A(5)
    TC_END()

UT_FailString:
    TEST_STRING(Text, "HELP", 0)
    TC_END()

UT_Fail:
    TEST_FAIL()
    TC_END()

; --- Errors
UT_Returns:
    ret

UT_Overflow:
    push hl
    jr UT_Overflow

UT_Underflow:
    pop hl
    pop hl
    TC_END()

UT_Timeout:
    jr UT_Timeout

UT_Halt:
    di
    halt

UT_Watch:
    ld a,1
    ld (Guarded),a
    TC_END()
Guarded: .defb 0 ; WPMEM Guarded, 1, w

  .module Suite1
UT_Inner:
    TC_END()
  .endmodule
`;

describe("unit-test runner, ZX Spectrum 48K", () => {
  it("classifies every outcome", async () => {
    const { results, summary, problems } = await runProgram(PROGRAM);
    expect(problems).toEqual([]);
    expect(summary).toMatchObject({ total: 14, passed: 5, failed: 3, errors: 6 });

    for (const id of ["UT_Pass", "UT_InitRunsEveryTime", "UT_Memory", "UT_Log", "Suite1.UT_Inner"]) {
      expect(results[id], id).toMatchObject({ status: "passed" });
      expect(results[id].tstates).toBeGreaterThan(0);
    }

    // --- An assertion names its invocation line and the values (T2, D8)
    expect(results.UT_FailValue).toMatchObject({ status: "failed" });
    expect(results.UT_FailValue.message).toMatch(/^ASSERTION failed at .*:\d+: A == B {2}\(A=\$07, B=\$05\)$/);
    expect(results.UT_FailString.message).toContain("A == C");
    expect(results.UT_Fail.message).toContain("(always)");

    expect(results.UT_Returns).toMatchObject({ status: "error", errorKind: "returned" });
    expect(results.UT_Returns.message).toBe("UT_Returns returned with RET; end a test with TC_END.");
    expect(results.UT_Overflow).toMatchObject({ status: "error", errorKind: "stack" });
    expect(results.UT_Overflow.message).toMatch(/^Stack overflow/);
    expect(results.UT_Underflow).toMatchObject({ status: "error", errorKind: "stack" });
    expect(results.UT_Underflow.message).toMatch(/^Stack underflow/);
    expect(results.UT_Timeout).toMatchObject({ status: "error", errorKind: "timeout" });
    expect(results.UT_Timeout.tstates).toBeGreaterThanOrEqual(3_500_000);
    expect(results.UT_Halt).toMatchObject({ status: "error", errorKind: "halt" });
    expect(results.UT_Watch).toMatchObject({ status: "error", errorKind: "breakpoint" });
    expect(results.UT_Watch.message).toMatch(/^WPMEM write at \$[0-9A-F]{4} \(guarded\)/);
  });

  it("points a failure at the macro invocation", async () => {
    const source = `
  .org $8000
  UNITTEST_INITIALIZE()
    ret
UT_Fails:
    ld a,2
    TEST_A(3)
    TC_END()
`;
    const { results } = await runProgram(source);
    const line = INCLUDE_LINES + source.split("\n").findIndex((l) => l.includes("TEST_A(3)")) + 1;
    expect(results.UT_Fails.location).toMatchObject({ line });
    expect(results.UT_Fails.message).toContain(`:${line}: A == B`);
  });

  it("captures LOGPOINT output in the test's log", async () => {
    const { results, events } = await runProgram(PROGRAM, { include: ["UT_Log"] });
    expect(results.UT_Log.log).toEqual(["A is $07"]);
    expect(events.filter((e) => e.kind === "log")).toEqual([{ kind: "log", id: "UT_Log", text: "A is $07" }]);
  });

  it("gives identical results and T-states on every run (D20)", async () => {
    const first = await runProgram(PROGRAM);
    const second = await runProgram(PROGRAM);
    expect(JSON.stringify(second.results)).toBe(JSON.stringify(first.results));
  });

  it("runs the selected tests only", async () => {
    const { summary, results } = await runProgram(PROGRAM, { include: ["UT_Fail*"], ids: ["UT_FailValue"] });
    expect(summary.total).toBe(1);
    expect(Object.keys(results)).toEqual(["UT_FailValue"]);
  });

  it("runs without booting the ROM", async () => {
    const { results } = await runProgram(PROGRAM, { boot: "none", include: ["UT_Pass", "UT_Memory"] });
    expect(results.UT_Pass.status).toBe("passed");
    expect(results.UT_Memory.status).toBe("passed");
  });

  it("honours a shorter time limit", async () => {
    const { results } = await runProgram(PROGRAM, { timeoutSeconds: 0.1, include: ["UT_Timeout"] });
    expect(results.UT_Timeout.tstates).toBeLessThan(500_000);
  });

  it("reports a program without the test frame", async () => {
    const { problems, summary } = await runProgram(`
  .org $8000
UT_Lonely:
    ret
`);
    expect(summary.total).toBe(0);
    expect(problems[0]).toMatch(/UNITTEST_INITIALIZE/);
  });

  it("reports init code that does not return as a setup error", async () => {
    const { results } = await runProgram(`
  .org $8000
  UNITTEST_INITIALIZE()
Spin:
    jr Spin
UT_Never:
    TC_END()
`);
    expect(results.UT_Never).toMatchObject({ status: "error", errorKind: "setup" });
  });

  it("merges coverage over the tests (D17)", async () => {
    const { events } = await runProgram(PROGRAM, { coverage: true, include: ["UT_Pass", "UT_Memory"] });
    const finished = events.find((e) => e.kind === "finished");
    expect(finished?.kind === "finished" && finished.coverage?.bytes.length).toBeGreaterThan(0);
  });
});

