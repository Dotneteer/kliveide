import { describe, it, expect } from "vitest";
import { computeBlockMatch, type BlockMatchResult } from "@renderer/appIde/services/z80-providers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Splits a template literal into lines (no trailing empty line). */
function src(text: string): string[] {
  return text.split("\n").slice(1); // remove leading empty line from template literal
}

function match(lines: string[], lineNumber: number): BlockMatchResult | null {
  return computeBlockMatch(lines, lineNumber);
}

// ---------------------------------------------------------------------------
// Basic open → close pairs
// ---------------------------------------------------------------------------

describe("computeBlockMatch — open-to-close", () => {
  it(".macro / .endm  — cursor on opener finds closer", () => {
    const lines = src(`
.macro MyMacro
  nop
.endm
`);
    const r = match(lines, 1)!;
    expect(r).not.toBeNull();
    expect(r.openLine).toBe(1);
    expect(r.closeLine).toBe(3);
  });

  it(".loop / .endl", () => {
    const lines = src(`
.loop 10
  nop
.endl
`);
    const r = match(lines, 1)!;
    expect(r.openLine).toBe(1);
    expect(r.closeLine).toBe(3);
  });

  it(".repeat / .until", () => {
    const lines = src(`
.repeat
  nop
.until done
`);
    const r = match(lines, 1)!;
    expect(r.closeLine).toBe(3);
  });

  it(".while / .endw", () => {
    const lines = src(`
.while x > 0
  dec x
.endw
`);
    expect(match(lines, 1)?.closeLine).toBe(3);
  });

  it(".for / .next", () => {
    const lines = src(`
.for i = 1 .to 10
  nop
.next
`);
    expect(match(lines, 1)?.closeLine).toBe(3);
  });

  it(".proc / .endp", () => {
    const lines = src(`
.proc MyProc
  nop
.endp
`);
    expect(match(lines, 1)?.closeLine).toBe(3);
  });

  it(".struct / .ends", () => {
    const lines = src(`
.struct Point
x .word 0
.ends
`);
    expect(match(lines, 1)?.closeLine).toBe(3);
  });

  it(".if / .endif", () => {
    const lines = src(`
.if DEBUG
  nop
.endif
`);
    expect(match(lines, 1)?.closeLine).toBe(3);
  });

  it(".module / .endmodule", () => {
    const lines = src(`
.module MyMod
  nop
.endmodule
`);
    expect(match(lines, 1)?.closeLine).toBe(3);
  });

  it(".module / .endmod (alias)", () => {
    const lines = src(`
.module MyMod
  nop
.endmod
`);
    expect(match(lines, 1)?.closeLine).toBe(3);
  });

  it("#if / #endif", () => {
    const lines = src(`
#if DEBUG
  nop
#endif
`);
    expect(match(lines, 1)?.closeLine).toBe(3);
  });

  it("#ifdef / #endif", () => {
    const lines = src(`
#ifdef DEBUG
  nop
#endif
`);
    expect(match(lines, 1)?.closeLine).toBe(3);
  });

  it("#ifndef / #endif", () => {
    const lines = src(`
#ifndef RELEASE
  nop
#endif
`);
    expect(match(lines, 1)?.closeLine).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Close → open (cursor on closer)
// ---------------------------------------------------------------------------

describe("computeBlockMatch — close-to-open", () => {
  it(".endm on cursor finds .macro opener", () => {
    const lines = src(`
.macro MyMacro
  nop
.endm
`);
    const r = match(lines, 3)!;
    expect(r).not.toBeNull();
    expect(r.openLine).toBe(1);
    expect(r.closeLine).toBe(3);
  });

  it(".endif on cursor finds .if opener", () => {
    const lines = src(`
.if DEBUG
.endif
`);
    expect(match(lines, 2)?.openLine).toBe(1);
  });

  it("#endif on cursor finds #ifdef opener", () => {
    const lines = src(`
#ifdef FEATURE
  nop
#endif
`);
    const r = match(lines, 3)!;
    expect(r.openLine).toBe(1);
    expect(r.closeLine).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Nesting — cursor on outer block finds outer partner
// ---------------------------------------------------------------------------

describe("computeBlockMatch — nesting", () => {
  it("nested .macro: cursor on outer opener → outer closer", () => {
    const lines = src(`
.macro Outer
.macro Inner
  nop
.endm
.endm
`);
    const r = match(lines, 1)!;
    expect(r.openLine).toBe(1);
    expect(r.closeLine).toBe(5); // last .endm
  });

  it("nested .macro: cursor on inner opener → inner closer", () => {
    const lines = src(`
.macro Outer
.macro Inner
  nop
.endm
.endm
`);
    const r = match(lines, 2)!;
    expect(r.openLine).toBe(2);
    expect(r.closeLine).toBe(4); // first .endm
  });

  it("nested .macro: cursor on outer closer → outer opener", () => {
    const lines = src(`
.macro Outer
.macro Inner
  nop
.endm
.endm
`);
    expect(match(lines, 5)?.openLine).toBe(1);
  });

  it("nested .if: inner closer navigates to inner opener", () => {
    const lines = src(`
.if A
.if B
  nop
.endif
.endif
`);
    expect(match(lines, 4)?.openLine).toBe(2);
    expect(match(lines, 5)?.openLine).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Column range computation
// ---------------------------------------------------------------------------

describe("computeBlockMatch — column ranges", () => {
  it("opener column range covers exactly the keyword", () => {
    const lines = src(`
.macro Foo
  nop
.endm
`);
    const r = match(lines, 1)!;
    // ".macro" starts at column 1, ends at column 7 (exclusive)
    expect(r.openStartColumn).toBe(1);
    expect(r.openEndColumn).toBe(7); // ".macro".length + 1
  });

  it("closer column range covers exactly the keyword", () => {
    const lines = src(`
.macro Foo
  nop
.endm
`);
    const r = match(lines, 3)!;
    // ".endm" starts at column 1, length 5 → end column 6 (exclusive)
    expect(r.closeStartColumn).toBe(1);
    expect(r.closeEndColumn).toBe(6);
  });

  it("indented opener: column range is relative to the keyword position", () => {
    const lines = src(`
  .proc Foo
    nop
  .endp
`);
    const r = match(lines, 1)!;
    // Two leading spaces, then ".proc" starts at col 3, ends at col 8
    expect(r.openStartColumn).toBe(3);
    expect(r.openEndColumn).toBe(8);
  });

  it("opener and closer columns are independently computed", () => {
    const lines = src(`
.macro Wide
  nop
  .endm
`);
    const r = match(lines, 1)!;
    expect(r.openStartColumn).toBe(1);   // .macro at col 1
    expect(r.closeStartColumn).toBe(3);  // .endm indented 2 spaces → col 3
  });
});

// ---------------------------------------------------------------------------
// No-match cases
// ---------------------------------------------------------------------------

describe("computeBlockMatch — no match", () => {
  it("returns null for a plain instruction line", () => {
    const lines = src(`
  ld hl, 0
  nop
`);
    expect(match(lines, 1)).toBeNull();
  });

  it("returns null for a comment line", () => {
    const lines = src(`
; .macro this is a comment
  nop
`);
    expect(match(lines, 1)).toBeNull();
  });

  it("returns null for an empty line", () => {
    expect(match([""], 1)).toBeNull();
  });

  it("returns null for out-of-range line number", () => {
    const lines = [".macro Foo", "nop", ".endm"];
    expect(match(lines, 0)).toBeNull();
    expect(match(lines, 4)).toBeNull();
  });

  it("returns null when opener has no closer", () => {
    const lines = [".macro Foo", "nop"];
    expect(match(lines, 1)).toBeNull();
  });

  it("returns null when closer has no opener", () => {
    const lines = ["nop", ".endm"];
    expect(match(lines, 2)).toBeNull();
  });

  it("returns null for a line with a label but no block keyword", () => {
    const lines = ["MyLabel: ld a, 0"];
    expect(match(lines, 1)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Keyword case-insensitivity
// ---------------------------------------------------------------------------

describe("computeBlockMatch — case insensitivity", () => {
  it(".MACRO and .ENDM recognised", () => {
    const lines = [".MACRO Foo", "nop", ".ENDM"];
    const r = match(lines, 1)!;
    expect(r.openLine).toBe(1);
    expect(r.closeLine).toBe(3);
  });

  it("#IF and #ENDIF recognised", () => {
    const lines = ["#IF DEBUG", "nop", "#ENDIF"];
    expect(match(lines, 1)?.closeLine).toBe(3);
  });
});
