import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

/**
 * The CPU-neutral assembler core (`dev/plans/ASSEMBLER_CPU_NEUTRAL_PLAN.md`) imports no CPU and no
 * machine: nothing from the Z80 assembler, and no ZX Spectrum Next or ZX80/ZX81 code. The one
 * exception, recorded in the plan's §5, is the output's type-only imports of the Next's Copper and DMA
 * records.
 */
const ROOT = join(__dirname, "../..");
const CORE = "src/main/compiler-common";
const FORBIDDEN = [/z80-compiler/, /@common\/zxnext\//, /@common\/zx8081\//, /SpectrumModelTypes/];
const ALLOWED_TYPE_IMPORTS: Record<string, RegExp[]> = {
  "assembler-in-out.ts": [/@common\/zxnext\/copper\/copperBlocks/, /@common\/zxnext\/dma\/dmaProgram/]
};

function importsOf(text: string): { spec: string; typeOnly: boolean }[] {
  const result: { spec: string; typeOnly: boolean }[] = [];
  for (const m of text.matchAll(/^\s*import\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/gms)) {
    result.push({ spec: m[2], typeOnly: !!m[1] });
  }
  for (const m of text.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) {
    result.push({ spec: m[1], typeOnly: false });
  }
  return result;
}

describe("Assembler architecture: the CPU-neutral core", () => {
  const files = readdirSync(join(ROOT, CORE)).filter((f) => f.endsWith(".ts"));

  it("has files to check", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("imports no CPU and no machine", () => {
    const violations: string[] = [];
    for (const file of files) {
      const text = readFileSync(join(ROOT, CORE, file), "utf8");
      for (const { spec, typeOnly } of importsOf(text)) {
        if (!FORBIDDEN.some((re) => re.test(spec))) continue;
        if (typeOnly && (ALLOWED_TYPE_IMPORTS[file] ?? []).some((re) => re.test(spec))) continue;
        violations.push(`${file} imports ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("names no Z80 operand kind or register class", () => {
    const violations: string[] = [];
    for (const file of files) {
      if (file === "assembler-errors.ts") continue;
      const code = readFileSync(join(ROOT, CORE, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      for (const word of ["Reg8", "Reg16", "reg8", "reg16Idx", "IndexedIndirect", "CPort", "offsetSign", "SpectrumModelType"]) {
        if (new RegExp(`\\b${word}\\b`).test(code)) violations.push(`${file} uses ${word}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("the toy CPU test assembler uses the core only", () => {
    const text = readFileSync(join(ROOT, "test/asm-core/toy-cpu.ts"), "utf8");
    expect(importsOf(text).filter(({ spec }) => /z80-compiler/.test(spec))).toEqual([]);
  });
});
