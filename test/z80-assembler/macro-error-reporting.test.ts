import { describe, it, expect } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

// These tests verify that errors raised while expanding a macro invocation
// reference the invocation site (file, line and column), not just the
// location inside the macro definition body. The reporting must also work
// for nested macro invocations and for both syntactic errors discovered when
// re-parsing the expanded body and semantic errors raised during emission.

describe("Assembler - macro invocation error reporting", () => {
  it("argument evaluation error references the invocation line", async () => {
    const compiler = new Z80Assembler();
    const source = [
      "      MyMacro: .macro(first)", //  line 1 (leading newline -> body lines start at 2)
      "        nop",
      "        .endm",
      "      value .equ 0",
      "      MyMacro(1/value)"
    ].join("\n");

    const output = await compiler.compile("\n" + source + "\n");

    expect(output.errorCount).toBe(2);

    // --- The Z1012 entry points at the invocation site
    const inv = output.errors.find((e) => e.errorCode === "Z1012")!;
    expect(inv).toBeDefined();
    expect(inv.line).toBe(6);
    expect(inv.message).toContain("MyMacro");
    expect(inv.message).toContain(":6:");

    // --- The actual evaluation error mentions the invocation in the message
    const eval0 = output.errors.find((e) => e.errorCode === "Z0606")!;
    expect(eval0).toBeDefined();
    expect(eval0.message).toContain("MyMacro");
    expect(eval0.message).toContain(":6:");
    expect(eval0.message).toMatch(/Divide by zero/);
  });

  it("syntax error in expanded macro body includes invocation site in message", async () => {
    const compiler = new Z80Assembler();
    // The macro substitutes the user-supplied label expression and creates a
    // duplicate label. The re-parser then raises a syntax error on the body
    // line that holds {{MyArg}}. The expectation is that the error message
    // references the invocation site in the user's source.
    const source = [
      "      MyMacro: .macro(MyArg)", //  line 2
      "      Label: {{MyArg}}", //        line 3
      "      .endm", //                   line 4
      "      MyMacro(\"MyLabel: jp MyLabel\")" // line 5 (invocation)
    ].join("\n");

    const output = await compiler.compile("\n" + source + "\n");

    expect(output.errorCount).toBeGreaterThanOrEqual(2);

    // --- Z1012 invocation marker at the invocation line
    const inv = output.errors.find((e) => e.errorCode === "Z1012")!;
    expect(inv).toBeDefined();
    expect(inv.line).toBe(5);
    expect(inv.startColumn).toBe(6);
    expect(inv.message).toContain("MyMacro");
    expect(inv.message).toContain(":5:6");

    // --- The syntax error message references the invocation site explicitly
    const synErr = output.errors.find((e) => e.errorCode !== "Z1012")!;
    expect(synErr).toBeDefined();
    expect(synErr.message).toMatch(/in macro invocation/i);
    expect(synErr.message).toContain("MyMacro");
    expect(synErr.message).toContain(":5:6");
  });

  it("semantic error inside macro body references the invocation site", async () => {
    const compiler = new Z80Assembler();
    // The macro contains an evaluation expression that depends on a symbol
    // forwarded by the caller. The error originates while emitting the macro
    // body but must point back to the invocation in the user's source.
    const source = [
      "      MyMacro: .macro(x)", //          line 2
      "        ld a,1/{{x}}", //              line 3
      "      .endm", //                       line 4
      "      value .equ 0", //                line 5
      "      MyMacro(value)" //               line 6 (invocation)
    ].join("\n");

    const output = await compiler.compile("\n" + source + "\n");

    expect(output.errorCount).toBe(2);

    const inv = output.errors.find((e) => e.errorCode === "Z1012")!;
    expect(inv).toBeDefined();
    expect(inv.line).toBe(6);
    expect(inv.startColumn).toBe(6);
    expect(inv.message).toContain("MyMacro");
    expect(inv.message).toContain(":6:6");

    const evalErr = output.errors.find((e) => e.errorCode === "Z0606")!;
    expect(evalErr).toBeDefined();
    expect(evalErr.message).toMatch(/in macro invocation/i);
    expect(evalErr.message).toContain("MyMacro");
    expect(evalErr.message).toContain(":6:6");
    expect(evalErr.message).toMatch(/Divide by zero/);
  });

  it("nested macro invocation reports the full chain", async () => {
    const compiler = new Z80Assembler();
    // Outer expands into Inner which contains a divide-by-zero. The reporter
    // must mention both 'Outer' and 'Inner' invocations in the chain along
    // with their respective source locations.
    const source = [
      "      Inner: .macro(x)", //           line 2
      "        ld a,1/{{x}}", //              line 3
      "      .endm", //                       line 4
      "      Outer: .macro(y)", //            line 5
      "        Inner({{y}})", //              line 6 (inner invocation)
      "      .endm", //                       line 7
      "      value .equ 0", //                line 8
      "      Outer(value)" //                 line 9 (outer invocation)
    ].join("\n");

    const output = await compiler.compile("\n" + source + "\n");

    expect(output.errorCount).toBe(3);

    // --- Two Z1012 entries, one per invocation level
    const z1012s = output.errors.filter((e) => e.errorCode === "Z1012");
    expect(z1012s.length).toBe(2);

    const innerInv = z1012s.find((e) => e.message.includes("Inner"))!;
    const outerInv = z1012s.find((e) => e.message.includes("Outer"))!;
    expect(innerInv).toBeDefined();
    expect(outerInv).toBeDefined();

    expect(outerInv.line).toBe(9);
    expect(innerInv.line).toBe(6);
    expect(innerInv.message).toMatch(/level 2 of 2/);
    expect(outerInv.message).toMatch(/level 1 of 2/);

    // --- The actual evaluation error mentions both invocations and their
    //     locations in the order outer -> inner.
    const evalErr = output.errors.find((e) => e.errorCode === "Z0606")!;
    expect(evalErr).toBeDefined();
    expect(evalErr.message).toContain("Outer");
    expect(evalErr.message).toContain("Inner");
    const outerIdx = evalErr.message.indexOf("Outer");
    const innerIdx = evalErr.message.indexOf("Inner");
    expect(outerIdx).toBeGreaterThanOrEqual(0);
    expect(innerIdx).toBeGreaterThan(outerIdx);
    expect(evalErr.message).toContain(":9:");
    expect(evalErr.message).toContain(":6:");
  });

  it("each invocation reports its own location independently", async () => {
    const compiler = new Z80Assembler();
    // Two invocations of the same buggy macro. The reporter must produce a
    // distinct invocation marker for each call site, not a shared one.
    const source = [
      "      MyMacro: .macro(MyArg)", //      line 2
      "      Label: {{MyArg}}", //            line 3
      "      .endm", //                       line 4
      "      MyMacro(\"MyLabel: jp MyLabel\")", // line 5
      "      MyMacro(\"MyLabel: jp MyLabel\")" //  line 6
    ].join("\n");

    const output = await compiler.compile("\n" + source + "\n");

    const z1012s = output.errors.filter((e) => e.errorCode === "Z1012");
    expect(z1012s.length).toBe(2);
    const lines = z1012s.map((e) => e.line).sort((a, b) => a - b);
    expect(lines).toEqual([5, 6]);
  });

  it("non-macro errors are not annotated with macro invocation context", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      value .equ 0
      ld a,1/value
      `);

    expect(output.errorCount).toBe(1);
    const err = output.errors[0];
    expect(err.errorCode).toBe("Z0606");
    expect(err.message).not.toMatch(/macro invocation/i);
  });

  it("deferred fixup error inside a macro mentions the invocation", async () => {
    // The macro references a symbol that is never defined. The error is
    // reported during deferred fixup resolution, after the macro invocation
    // stack would normally have been cleared. The new behavior preserves the
    // invocation chain on a per-fixup basis, so the error message must still
    // identify the failing macro invocation.
    const compiler = new Z80Assembler();
    const source = [
      "      .org #6000", //                     line 2
      "      MyMacro: .macro(color)", //         line 3
      "        ld a,{{color}}", //                line 4
      "      .endm", //                           line 5
      "      MyMacro(UNDEFINED_SYM)" //           line 6 (invocation)
    ].join("\n");

    const output = await compiler.compile("\n" + source + "\n");

    expect(output.errorCount).toBeGreaterThanOrEqual(1);
    const undefErr = output.errors.find((e) => e.errorCode === "Z0605")!;
    expect(undefErr).toBeDefined();
    expect(undefErr.message).toContain("UNDEFINED_SYM");
    expect(undefErr.message).toMatch(/in macro invocation/i);
    expect(undefErr.message).toContain("MyMacro");
    expect(undefErr.message).toContain(":6:");
  });

  it("deferred fixup error inside nested macros lists the full chain", async () => {
    const compiler = new Z80Assembler();
    const source = [
      "      .org #6000", //                     line 2
      "      Inner: .macro(x)", //                line 3
      "        ld a,{{x}}", //                    line 4
      "      .endm", //                           line 5
      "      Outer: .macro(y)", //                line 6
      "        Inner({{y}})", //                  line 7
      "      .endm", //                           line 8
      "      Outer(UNDEFINED_SYM)" //             line 9
    ].join("\n");

    const output = await compiler.compile("\n" + source + "\n");

    const undefErr = output.errors.find((e) => e.errorCode === "Z0605")!;
    expect(undefErr).toBeDefined();
    expect(undefErr.message).toContain("UNDEFINED_SYM");
    expect(undefErr.message).toContain("Outer");
    expect(undefErr.message).toContain("Inner");
    const outerIdx = undefErr.message.indexOf("Outer");
    const innerIdx = undefErr.message.indexOf("Inner");
    expect(innerIdx).toBeGreaterThan(outerIdx);
    expect(undefErr.message).toContain(":9:");
    expect(undefErr.message).toContain(":7:");
  });
});
