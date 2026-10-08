import { describe, expect, it } from "vitest";

import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_ZXNEXT, runProgram } from "./unitTestSupport";

/*
 * The unit-test runner on the 128K, the +2A/+3/+3E and the Next (`.plans/Z80_UNIT_TESTS_PLAN.md`
 * D18, T5, T6): banked test code, written into its bank whatever is paged in, and paged in by the
 * program's own init code.
 */

/** A test in bank 3, paged into $C000 by the init code */
const BANKED_128 = `
  .model Spectrum128
  .org $8000
  UNITTEST_INITIALIZE()
    ld a,$13             ; bank 3 at $C000, ROM 1 (48 BASIC)
    ld bc,$7FFD
    out (c),a
    ret

UT_Unbanked:
    ld a,1
    TEST_A(1)
    TC_END()

UT_CallsBanked:
    call Banked
    TEST_A($42)
    TC_END()

  .bank 3
  .org $C000
UT_InBank:
    call Banked
    TEST_A($43)          ; fails: the banked routine returns $42
    TC_END()
Banked:
    ld a,$42
    ret
`;

describe("unit-test runner, 128K family", () => {
  it.each([
    [MI_SPECTRUM_128, undefined],
    [MI_SPECTRUM_3E, undefined]
  ])("runs banked tests on %s", async (machineId, modelId) => {
    const { results, summary, problems } = await runProgram(BANKED_128, {
      machineId,
      modelId,
      model: SpectrumModelType.Spectrum128,
      bootModel: machineId
    });
    expect(problems).toEqual([]);
    expect(summary).toMatchObject({ total: 3, passed: 2, failed: 1, errors: 0 });
    expect(results.UT_Unbanked.status).toBe("passed");
    expect(results.UT_CallsBanked.status).toBe("passed");
    expect(results.UT_InBank.status).toBe("failed");
    expect(results.UT_InBank.message).toContain("(A=$42, B=$43)");
  });

  it("times out after one emulated second at the 128K's clock", async () => {
    const { results } = await runProgram(
      `
  .model Spectrum128
  .org $8000
  UNITTEST_INITIALIZE()
    ret
UT_Spin:
    jr UT_Spin
`,
      { machineId: MI_SPECTRUM_128, model: SpectrumModelType.Spectrum128 }
    );
    expect(results.UT_Spin).toMatchObject({ status: "error", errorKind: "timeout" });
    expect(results.UT_Spin.tstates).toBeGreaterThanOrEqual(3_546_900);
    expect(results.UT_Spin.tstates).toBeLessThan(3_546_900 + 71_000);
  });
});

describe("unit-test runner, ZX Spectrum Next", () => {
  it("runs MMU-banked tests without booting (boot: none)", async () => {
    const { results, summary, problems } = await runProgram(
      `
  .model Next
  .org $8000
  UNITTEST_INITIALIZE()
    nextreg $56,40       ; 8K pages 40-41 (16K bank 20) at $C000
    nextreg $57,41
    ret

UT_Next:
    call Banked
    TEST_A($55)
    TC_END()

UT_NextFails:
    call Banked
    TEST_A(0)
    TC_END()

  .bank 20
  .org $C000
Banked:
    ld a,$55
    ret
    .defs $2000 - 3
UT_SecondPage:
    ld a,($E000)          ; this instruction's own first byte, in page 41
    TEST_A($3A)
    TC_END()
`,
      { machineId: MI_ZXNEXT, model: SpectrumModelType.Next, boot: "none" }
    );
    expect(problems).toEqual([]);
    expect(results.UT_Next.status).toBe("passed");
    expect(results.UT_SecondPage.status).toBe("passed");
    expect(results.UT_NextFails).toMatchObject({ status: "failed" });
    expect(summary).toMatchObject({ total: 3, passed: 2, failed: 1 });
  });
});
