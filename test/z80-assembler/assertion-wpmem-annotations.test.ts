import { describe, expect, it } from "vitest";

import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import {
  annotationBreakpoints,
  annotationsInComment,
  checkSourceAnnotations
} from "@common/utils/source-annotations";
import { buildLogpoints, getBreakpointStorageKey } from "@common/utils/breakpoints";
import { parseWpmemArgs } from "@common/utils/breakpoint-condition/dezog/wpmem-args";
import { kliveConditionText } from "@common/utils/breakpoint-condition/dezog/dezog-printer";
import { compileCondition } from "@common/utils/breakpoint-condition/condition-checker";
import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";

/*
 * DeZog `ASSERTION` and `WPMEM` comments (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` Phases 3-4):
 * the comment scan, the WPMEM arguments, the Klive reading of an expression, the Klive assembler's
 * annotations and the breakpoints a build installs from them.
 */

async function assemble(source: string) {
  const output = await new Z80Assembler().compile(source, new AssemblerOptions());
  expect(output.errors.filter((e) => !e.isWarning)).toEqual([]);
  return output as unknown as KliveCompilerOutput & {
    debugAnnotations: { kind: string; line: number; address: number; text: string }[];
  };
}

describe("annotationsInComment", () => {
  it("finds each keyword; ASSERTION and WPMEM stop at the next ';'", () => {
    expect(annotationsInComment("; ASSERTION A < 5 && hl != 0 ; trailing note")).toEqual([
      { kind: "ASSERTION", text: "A < 5 && hl != 0" }
    ]);
    expect(annotationsInComment("; WPMEM, 5, w")).toEqual([{ kind: "WPMEM", text: ", 5, w" }]);
    expect(annotationsInComment("; note ASSERTION")).toEqual([{ kind: "ASSERTION", text: "" }]);
    expect(annotationsInComment("; WPMEM ; ASSERTION B == 0")).toEqual([
      { kind: "WPMEM", text: "" },
      { kind: "ASSERTION", text: "B == 0" }
    ]);
  });

  it("is case-sensitive and whole-word, and leaves a LOGPOINT's message alone", () => {
    expect(annotationsInComment("; assertion A")).toEqual([]);
    expect(annotationsInComment("; ASSERT A")).toEqual([]);
    expect(annotationsInComment("; ASSERTIONS A")).toEqual([]);
    expect(annotationsInComment("; LOGPOINT ASSERTION hit; x")).toEqual([
      { kind: "LOGPOINT", text: "ASSERTION hit; x" }
    ]);
  });
});

describe("parseWpmemArgs", () => {
  const symbols = { fill_colors: 0x8100, stack_top: 0xff00 };

  it("defaults to the line's address, one byte, read and write", () => {
    expect(parseWpmemArgs("")).toEqual({ args: { length: 1, access: "rw" } });
  });

  it("reads the leading-comma form, expressions and ranges", () => {
    expect(parseWpmemArgs(", 5, w")).toEqual({ args: { length: 5, access: "w" } });
    expect(parseWpmemArgs("0x0000, 0x4000")).toEqual({ args: { address: 0, length: 0x4000, access: "rw" } });
    expect(parseWpmemArgs("fill_colors+2, 3, r", symbols)).toEqual({
      args: { address: 0x8102, length: 3, access: "r" }
    });
    expect(parseWpmemArgs(", 2", symbols)).toEqual({ args: { length: 2, access: "rw" } });
  });

  it("refuses what cannot be a watchpoint", () => {
    expect(parseWpmemArgs("nowhere", symbols)).toMatchObject({ error: /unknown label nowhere/ });
    expect(parseWpmemArgs("HL")).toMatchObject({ error: /register/ });
    expect(parseWpmemArgs("b@(0x8000)")).toMatchObject({ error: /memory read/ });
    expect(parseWpmemArgs("0x8000, 0")).toMatchObject({ error: /between 1 and 65536/ });
    expect(parseWpmemArgs("0xFFFE, 4")).toMatchObject({ error: /past \$FFFF/ });
    expect(parseWpmemArgs("0x8000, 1, x")).toMatchObject({ error: /r, w or rw/ });
    expect(parseWpmemArgs("1, 2, r, 4")).toMatchObject({ error: /at most three/ });
  });
});

describe("the Klive reading of a DeZog expression (§4.5)", () => {
  it("parenthesises every binary operation, so C precedence survives (R2)", () => {
    expect(kliveConditionText("A & 0x80 == 0")).toBe("A & (128 == 0)".replace("128", "$80"));
    expect(kliveConditionText("a < 5 && hl != 0")).toBe("(A < 5) && (HL != 0)");
    expect(kliveConditionText("b@(hl) == 7Fh")).toBe("b[HL] == $7F");
  });

  it("prints labels in backticks, dots included, and Klive's parser reads them back (R3)", () => {
    const text = kliveConditionText("w@(sprite.counter) > 10");
    expect(text).toBe("w[`sprite.counter`] > $A");
    const result = compileCondition(text, { accessKind: "exec", symbols: { "sprite.counter": 0x8000 } });
    expect(result.errors).toEqual([]);
    expect(result.compiled?.inactiveReason).toBeUndefined();
  });
});

describe("Klive assembler ASSERTION / WPMEM annotations", () => {
  it("checks an assertion on an instruction's line before it, and on its own line before the next", async () => {
    const output = await assemble(`
      .org $8000
      nop
      ld a,c        ; ASSERTION a < 7
      ; ASSERTION b != 0
      ld b,a`);
    expect(output.debugAnnotations.map((a) => [a.kind, a.line, a.address, a.text])).toEqual([
      ["ASSERTION", 4, 0x8001, "a < 7"],
      ["ASSERTION", 5, 0x8002, "b != 0"]
    ]);
  });

  it("records WPMEM on a label at the label's address, in a false IF branch not at all", async () => {
    const output = await assemble(`
      .org $8000
      nop
    fill_colors: ; WPMEM, 5, w
      .defs 5
      .if 0
      nop ; WPMEM
      .endif`);
    expect(output.debugAnnotations.map((a) => [a.kind, a.line, a.address, a.text])).toEqual([
      ["WPMEM", 4, 0x8001, ", 5, w"]
    ]);
  });

  it("yields one assertion per macro expansion", async () => {
    const output = await assemble(`
      .org $8000
    Check: .macro()
      inc a ; ASSERTION a != 0
      .endm
      Check()
      Check()`);
    expect(output.debugAnnotations.map((a) => a.address)).toEqual([0x8000, 0x8001]);
  });

  it("drops a malformed comment with a build warning, never an error (S5)", async () => {
    const output = await assemble(`
      .org $8000
      nop ; ASSERTION a <
      nop ; WPMEM nowhere, 2
      nop ; ASSERTION a < 5`);
    const checked = checkSourceAnnotations(output) as unknown as typeof output;
    expect(checked.debugAnnotations.map((a) => a.line)).toEqual([5]);
    const warnings = checked.errors.filter((e) => e.isWarning).map((e) => [e.errorCode, e.line]);
    expect(warnings).toEqual([
      ["AS001", 3],
      ["WP001", 4]
    ]);
  });
});

describe("the breakpoints a build installs (§4.4)", () => {
  async function sample() {
    return assemble(`
      .org $8000
    Main:
      ld a,1         ; ASSERTION a < 5
      ; LOGPOINT [L] A=\${A}
      ld (Buf),a
      ret
    Buf:  ; WPMEM, 2
      .defs 2
      nop ; ASSERTION`);
  }

  it("builds LOGPOINT, ASSERTION and WPMEM breakpoints together, under their own keys", async () => {
    const bps = buildLogpoints(await sample(), undefined, "sp48");
    const keys = bps.map((bp) => getBreakpointStorageKey(bp));
    expect(keys.filter((k) => k.startsWith("LP:"))).toHaveLength(1);
    expect(keys.filter((k) => k.startsWith("AS:"))).toHaveLength(2);
    // --- `rw`: a read and a write definition over two bytes
    expect(keys.filter((k) => k.startsWith("WP:"))).toEqual([
      expect.stringMatching(/\+2:R$/),
      expect.stringMatching(/\+2:W$/)
    ]);
    const assertion = bps.find((bp) => bp.annotationKind === "ASSERTION" && bp.annotationText);
    expect(assertion).toMatchObject({
      address: 0x8000,
      exec: true,
      condition: "!(a < 5)",
      conditionDialect: "dezog",
      owner: { kind: "annotation" }
    });
    // --- A bare ASSERTION always stops: no condition
    expect(bps.find((bp) => bp.annotationKind === "ASSERTION" && !bp.annotationText)?.condition).toBeUndefined();
  });

  it("leaves out a kind whose switch is off, and keeps a disabled comment disabled (S3, S6)", async () => {
    const output = await sample();
    const noAsserts = annotationBreakpoints(output, (f) => f, undefined, { switches: { assertion: false } });
    expect(noAsserts.some((bp) => bp.annotationKind === "ASSERTION")).toBe(false);
    expect(noAsserts.some((bp) => bp.annotationKind === "WPMEM")).toBe(true);
    const noWp = annotationBreakpoints(output, (f) => f, undefined, { switches: { wpmem: false } });
    expect(noWp.some((bp) => bp.annotationKind === "WPMEM")).toBe(false);

    const disabled = annotationBreakpoints(output, (f) => f, undefined, {
      isDisabled: (key) => key.endsWith(":4:ASSERTION")
    });
    expect(disabled.find((bp) => bp.line === 4)?.disabled).toBe(true);
    expect(disabled.find((bp) => bp.line === 11)?.disabled).toBeUndefined();
  });
});

describe("a disabled LOGPOINT comment (Q6)", () => {
  it("stays disabled across a rebuild, like the other kinds", async () => {
    const output = await assemble(`
      .org $8000
      nop ; LOGPOINT [L] here`);
    const bps = annotationBreakpoints(output, (f) => f, undefined, {
      isDisabled: (key) => key.endsWith(":3:LOGPOINT")
    });
    expect(bps).toHaveLength(1);
    expect(bps[0]).toMatchObject({ logMessage: "[L] here", disabled: true });
  });
});
