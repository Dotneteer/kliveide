import { describe, expect, it } from "vitest";

import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { checkSourceAnnotations, logpointTextOf } from "@common/utils/source-annotations";
import { buildLogpoints } from "@common/utils/breakpoints";
import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";

/*
 * DeZog `LOGPOINT` comments in the Klive assembler (`.plans/LOGPOINTS_PLAN.md` §4.7, Phase 4): every
 * assembled line is scanned; the annotation fires at the line's address, or at the next instruction
 * for a line that emits nothing; false IF branches yield nothing; each macro expansion yields its own.
 */

async function assemble(source: string) {
  const output = await new Z80Assembler().compile(source, new AssemblerOptions());
  expect(output.errors.filter((e) => !e.isWarning)).toEqual([]);
  return output;
}

const brief = (output: { debugAnnotations: { line: number; address: number; text: string }[] }) =>
  output.debugAnnotations.map((a) => [a.line, a.address, a.text]);

describe("logpointTextOf", () => {
  it("finds the case-sensitive keyword and takes the rest, trimmed", () => {
    expect(logpointTextOf("; LOGPOINT [SPRITES] Status=${A:hex8}  ")).toBe("[SPRITES] Status=${A:hex8}");
    expect(logpointTextOf("//LOGPOINT x")).toBe("x");
    expect(logpointTextOf("; logpoint x")).toBeUndefined();
    expect(logpointTextOf("; LOGPOINTS x")).toBeUndefined();
    expect(logpointTextOf("; MYLOGPOINT x")).toBeUndefined();
    expect(logpointTextOf("; LOGPOINT")).toBe("");
    expect(logpointTextOf(null)).toBeUndefined();
  });
});

describe("Klive assembler LOGPOINT annotations", () => {
  it("records an inline comment at its instruction's address", async () => {
    const output = await assemble(`
      .org $8000
      nop
      ld a,(hl)        ; LOGPOINT [SPRITES] Status=\${A:hex8}
      nop`);
    expect(brief(output)).toEqual([[4, 0x8001, "[SPRITES] Status=${A:hex8}"]]);
  });

  it("puts a comment-only and a label-only line on the next instruction", async () => {
    const output = await assemble(`
      .org $8000
      nop
      ; LOGPOINT before ld
      ld a,1
    Here:  ; LOGPOINT at label
      ld b,2`);
    expect(brief(output)).toEqual([
      [4, 0x8001, "before ld"],
      [6, 0x8003, "at label"]
    ]);
  });

  it("ignores lines in a false IF branch", async () => {
    const output = await assemble(`
      .org $8000
      .if 0
      nop ; LOGPOINT never
      .endif
      .if 1
      nop ; LOGPOINT always
      .endif`);
    expect(brief(output)).toEqual([[7, 0x8000, "always"]]);
  });

  it("yields one annotation per macro expansion", async () => {
    const output = await assemble(`
      .org $8000
    Twice: .macro()
        inc a ; LOGPOINT A=\${A}
      .endm
      Twice()
      nop
      Twice()`);
    const addresses = output.debugAnnotations.map((a) => a.address);
    expect(addresses).toEqual([0x8000, 0x8002]);
    expect(output.debugAnnotations.every((a) => a.text === "A=${A}")).toBe(true);
  });

  it("records the segment of a banked line so the IDE can derive the partition", async () => {
    const output = await assemble(`
      .model next
      .org $8000
      nop
      .bank 5
      .org $C000
      nop ; LOGPOINT in bank`);
    const [annotation] = output.debugAnnotations;
    expect(annotation.address).toBe(0xc000);
    expect(output.segments[annotation.segmentIndex!].bank).toBe(5);
    const [logpoint] = buildLogpoints(output as unknown as KliveCompilerOutput, undefined, "zxnext");
    expect(logpoint).toMatchObject({
      owner: { kind: "annotation" },
      address: 0xc000,
      exec: true,
      logMessage: "in bank",
      logDialect: "dezog"
    });
    // --- Bank 5's first 8K page, as source breakpoints in a banked segment get it
    expect(logpoint.partition).toBe(10);
  });
});

describe("checking annotations (L13)", () => {
  it("drops a malformed comment with a build warning and keeps the rest; an unknown label warns", async () => {
    const output = await assemble(`
      .org $8000
      nop ; LOGPOINT ok \${A}
      nop ; LOGPOINT bad \${A +}
      nop ; LOGPOINT label \${b@(missing.label)}`);
    const checked = checkSourceAnnotations(output as unknown as KliveCompilerOutput) as unknown as {
      debugAnnotations: { line: number }[];
      errors: { line: number; message: string; isWarning?: boolean }[];
    };
    expect(checked.debugAnnotations.map((a) => a.line)).toEqual([3, 5]);
    const warnings = checked.errors.filter((e) => e.isWarning && e.message.startsWith("LOGPOINT"));
    expect(warnings.map((w) => w.line)).toEqual([4, 5]);
    expect(warnings[0].message).toMatch(/^LOGPOINT ignored:/);
    expect(warnings[1].message).toMatch(/Unknown label missing\.label/);
  });

  it("binds labels against the build's own symbols", async () => {
    const output = await assemble(`
      .org $8000
    Counter: .defb 0
      nop ; LOGPOINT c=\${b@(Counter)}`);
    const checked = checkSourceAnnotations(output as unknown as KliveCompilerOutput);
    expect(checked.errors.filter((e) => e.isWarning)).toEqual([]);
  });

  it("keys project files by their project-relative path", () => {
    const output = {
      sourceFileList: [{ filename: "/home/me/proj/code/main.asm" }],
      debugAnnotations: [{ kind: "LOGPOINT", fileIndex: 0, line: 7, address: 0x8000, text: "x" }]
    } as unknown as KliveCompilerOutput;
    expect(buildLogpoints(output, "/home/me/proj", "sp48")[0]).toMatchObject({
      resource: "code/main.asm",
      line: 7
    });
  });
});
