import { describe, expect, it } from "vitest";

import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { MI_HT1080Z, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_TVC, MI_ZXNEXT, MI_ENTERPRISE, runProgram } from "./unitTestSupport";

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

describe("unit-test runner, HT-1080Z", () => {
  // --- `.plans/HT1080Z_CODE_INJECTION_PLAN.md` D9, D-Q6: booted by the machine's own flow, code at $7000
  it.each(["ht1080z-s2", "ht1080z-64"])("runs tests that call the ROM on %s", async (modelId) => {
    const { results, summary, problems } = await runProgram(
      `
  .model HT1080Z
  .org $7000
  UNITTEST_INITIALIZE()
    ret

UT_Adds:
    ld a,40
    add a,2
    TEST_A(42)
    TC_END()

UT_ReadsMemsiz:
    ld hl,($40B1)        ; MEMSIZ, set by the ROM at boot
    ld a,h
    or a
    TEST_FLAG_NZ()
    TC_END()

UT_Fails:
    ld a,1
    TEST_A(2)
    TC_END()
`,
      { machineId: MI_HT1080Z, modelId, model: SpectrumModelType.HT1080Z }
    );
    expect(problems).toEqual([]);
    expect(summary).toMatchObject({ total: 3, passed: 2, failed: 1, errors: 0 });
    expect(results.UT_Adds.status).toBe("passed");
    expect(results.UT_ReadsMemsiz.status).toBe("passed");
    expect(results.UT_Fails.message).toContain("(A=$01, B=$02)");
  });
});

describe("unit-test runner, Videoton TVC", () => {
  // --- Booted by the machine's own flow to BASIC's prompt; code at $1A30, the TVC's default
  it.each(["tvc64", "tvc64p"])("runs tests that call the operating system on %s", async (modelId) => {
    const { results, summary, problems } = await runProgram(
      `
  .model TVC
  UNITTEST_INITIALIZE()
    ret

UT_Adds:
    ld a,40
    add a,2
    TEST_A(42)
    TC_END()

UT_ReadsHimem:
    ld hl,($0B19)        ; HIMEM, set by the ROM at boot
    ld a,h
    TEST_A($BF)
    TC_END()

UT_PrintsAndReturns:
    ld c,'*'
    rst $30              ; the editor prints C...
    .defb $21
    ld a,1               ; ...and the call returns past its function byte
    TEST_A(1)
    TC_END()

UT_Fails:
    ld a,1
    TEST_A(2)
    TC_END()
`,
      { machineId: MI_TVC, modelId, model: SpectrumModelType.TVC }
    );
    expect(problems).toEqual([]);
    expect(summary).toMatchObject({ total: 4, passed: 3, failed: 1, errors: 0 });
    expect(results.UT_Adds.status).toBe("passed");
    expect(results.UT_ReadsHimem.status).toBe("passed");
    expect(results.UT_PrintsAndReturns.status).toBe("passed");
    expect(results.UT_Fails.message).toContain("(A=$01, B=$02)");
  });
});

describe("unit-test runner, Enterprise", () => {
  // --- Booted by the machine's own flow to IS-BASIC's prompt; code at $0100, the Enterprise's default
  // --- LP_POINTER after boot (observed): B900h on EXOS 2.1, BB00h on EXOS 2.0
  it.each([
    ["ep128", "$B9"],
    ["ep64", "$BB"]
  ])("runs tests that call EXOS on %s", async (modelId, lptHigh) => {
    const { results, summary, problems } = await runProgram(
      `
  .model ENTERPRISE
  UNITTEST_INITIALIZE()
    ret

UT_Adds:
    ld a,40
    add a,2
    TEST_A(42)
    TC_END()

UT_ReadsLpPointer:
    ld hl,($BFF4)        ; LP_POINTER: the line parameter table's CPU address (in segment FFh,
    ld a,h               ; EXOS's system segment, seen through page 2)
    TEST_A(${lptHigh})
    TC_END()

UT_CallsExos:
    ld b,0               ; read...
    ld c,22              ; ...MODE_VID
    rst $30              ; EXOS call 16...
    .defb 16
    TEST_A(0)            ; ...returns past its function byte with status 0
    TC_END()

UT_Fails:
    ld a,1
    TEST_A(2)
    TC_END()
`,
      { machineId: MI_ENTERPRISE, modelId, model: SpectrumModelType.Enterprise }
    );
    expect(problems).toEqual([]);
    expect(summary).toMatchObject({ total: 4, passed: 3, failed: 1, errors: 0 });
    expect(results.UT_Adds.status).toBe("passed");
    expect(results.UT_ReadsLpPointer.status).toBe("passed");
    expect(results.UT_CallsExos.status).toBe("passed");
    expect(results.UT_Fails.message).toContain("(A=$01, B=$02)");
  });
});
