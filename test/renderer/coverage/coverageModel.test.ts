import { describe, expect, it } from "vitest";
import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { PF_CODE, PF_EXECUTED } from "@common/profile/profileTypes";
import { buildCoverageModel, coverageTotals, lineCoverage } from "@common/profile/coverageModel";

/*
 * The coverage model (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D11, D12, T8, Phase 4): asm lines,
 * a macro invocation whose expansion ran only in part, banked segments checked against their own
 * bank, and a Klive BASIC statement's instruction starts decoded from its code.
 */

async function assemble(source: string, model = SpectrumModelType.Spectrum48): Promise<KliveCompilerOutput> {
  const options = new AssemblerOptions();
  options.currentModel = model;
  const output = await new Z80Assembler().compile(source, options);
  expect(output.errors.filter((e) => !e.isWarning)).toEqual([]);
  return output as KliveCompilerOutput;
}

/** Flags with E set at the given (address, partition) points */
function flagsFor(
  model: ReturnType<typeof buildCoverageModel>,
  executed: (address: number, partition: number | null) => boolean
): Uint8Array {
  return Uint8Array.from(model.points.map((p) => (executed(p.address, p.partition) ? PF_EXECUTED | PF_CODE : 0)));
}

describe("the coverage model", () => {
  it("gives every asm line its instruction start; data and labels have none", async () => {
    const output = await assemble(`
      .org $8000
Main: ld a,1
      jr z,Skip
      ld b,2
Skip: ret
Data: .defb 1,2,3
`);
    const model = buildCoverageModel(output, "sp48");
    expect(model.points.map((p) => p.address)).toEqual([0x8000, 0x8002, 0x8004, 0x8006]);
    expect(model.points.every((p) => p.partition === null)).toBe(true);
    const ran = new Set([0x8000, 0x8002, 0x8006]);
    const coverage = lineCoverage(model, flagsFor(model, (a) => ran.has(a)));
    const lines = [...coverage.values()][0];
    expect([...lines].map(([line, c]) => [line, c.state])).toEqual([
      [3, "covered"],
      [4, "covered"],
      [5, "uncovered"],
      [6, "covered"]
    ]);
    expect(coverageTotals(lines.values())).toEqual({ lines: 4, covered: 3, partial: 0 });
  });

  it("marks a macro invocation partial when only some of its instructions ran (T8)", async () => {
    const output = await assemble(`
      .org $8000
Twice: .macro()
      inc a
      inc b
      .endm
Main: Twice()
      ret
`);
    const model = buildCoverageModel(output, "sp48");
    const invocation = model.lines.find((l) => l.line === 7)!;
    expect(invocation.points.map((p) => model.points[p].address)).toEqual([0x8000, 0x8001]);
    const coverage = [...lineCoverage(model, flagsFor(model, (a) => a === 0x8000)).values()][0];
    expect(coverage.get(7)).toMatchObject({ state: "partial", executed: 1, total: 2 });
    // --- The macro body's own lines: the first ran, the second did not
    expect(coverage.get(4)!.state).toBe("covered");
    expect(coverage.get(5)!.state).toBe("uncovered");
  });

  it("checks a banked line against its own bank (D11)", async () => {
    const output = await assemble(
      `
      .model Spectrum128
      .org $8000
      nop
      .bank 1
      .org $C000
      ld a,1
      .bank 3
      .org $C000
      ld a,3
`,
      SpectrumModelType.Spectrum128
    );
    const model = buildCoverageModel(output, "sp128");
    const byLine = new Map(model.lines.map((l) => [l.line, model.points[l.points[0]]]));
    expect(byLine.get(4)).toEqual({ address: 0x8000, partition: null });
    expect(byLine.get(7)).toEqual({ address: 0xc000, partition: 1 });
    expect(byLine.get(10)).toEqual({ address: 0xc000, partition: 3 });
    // --- Bank 3 ran at $C000, bank 1 did not: only bank 3's line is covered
    const coverage = [...lineCoverage(model, flagsFor(model, (_a, p) => p === 3)).values()][0];
    expect(coverage.get(7)!.state).toBe("uncovered");
    expect(coverage.get(10)!.state).toBe("covered");
  });

  it("decodes a statement's instruction starts from its code (Klive BASIC's list items)", () => {
    // --- One statement of three instructions: LD A,1 / LD (IX+2),A / RET
    const output = {
      sourceFileList: [{ filename: "/p/a.zxbas", includes: [] }],
      segments: [{ startAddress: 0x8000, emittedCode: [0x3e, 0x01, 0xdd, 0x77, 0x02, 0xc9] }],
      listFileItems: [{ fileIndex: 0, address: 0x8000, lineNumber: 10, segmentIndex: 0, codeLength: 6 }],
      sourceMap: {},
      errors: []
    } as unknown as KliveCompilerOutput;
    const model = buildCoverageModel(output, "sp48");
    expect(model.points.map((p) => p.address)).toEqual([0x8000, 0x8002, 0x8005]);
    const flags = flagsFor(model, (a) => a !== 0x8005);
    const exec = Uint32Array.from([3, 3, 0]);
    expect(lineCoverage(model, flags, exec).get("/p/a.zxbas")!.get(10)).toEqual({
      state: "partial",
      executed: 2,
      total: 3,
      hits: 3
    });
  });

  it("is empty for an output with no list items", () => {
    expect(buildCoverageModel(undefined, "sp48").points).toEqual([]);
    expect(buildCoverageModel({ errors: [] } as unknown as KliveCompilerOutput, "sp48").lines).toEqual([]);
  });
});
