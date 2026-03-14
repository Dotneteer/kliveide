import { describe, it, expect } from "vitest";
import { computeFoldingRanges } from "@renderer/appIde/services/z80-providers";

/** Split a multi-line string into an array of lines for testing. */
function lines(src: string): string[] {
  return src.split("\n");
}

describe("Code Folding for Z80 Blocks", () => {
  // ── Basic block types ────────────────────────────────────────────────────

  it("folds a .macro/.endm block", () => {
    const src = lines(`
Border .macro(color)
  push af
  ld a,{{color}}
  out ($fe),a
  pop af
.endm`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].line).toBe(2);
    expect(ranges[0].endLine).toBe(7);
  });

  it("folds a .struct/.ends block", () => {
    const src = lines(`
Point .struct
  .db 0   ; x
  .db 0   ; y
.ends`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].line).toBe(2);
    expect(ranges[0].endLine).toBe(5);
  });

  it("folds a .proc/.endp block", () => {
    const src = lines(`
MainProc .proc
  ld hl, 0
  ret
.endp`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].line).toBe(2);
    expect(ranges[0].endLine).toBe(5);
  });

  it("folds a .module/.endmodule block", () => {
    const src = lines(`
.module Graphics
  Label1: nop
  Label2: nop
.endmodule`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].line).toBe(2);
    expect(ranges[0].endLine).toBe(5);
  });

  it("folds a .module closed with .endmod", () => {
    const src = lines(`
.module Audio
  nop
.endmod`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].line).toBe(2);
    expect(ranges[0].endLine).toBe(4);
  });

  it("folds a .loop/.endl block", () => {
    const src = lines(`
.loop 10
  nop
.endl`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].line).toBe(2);
    expect(ranges[0].endLine).toBe(4);
  });

  it("folds a .repeat/.until block", () => {
    const src = lines(`
.repeat
  dec b
.until b == 0`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].line).toBe(2);
    expect(ranges[0].endLine).toBe(4);
  });

  it("folds a .while/.endw block", () => {
    const src = lines(`
.while counter > 0
  dec b
.endw`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].line).toBe(2);
    expect(ranges[0].endLine).toBe(4);
  });

  it("folds a .for/.next block", () => {
    const src = lines(`
.for i = 0 .to 9
  nop
.next`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].line).toBe(2);
    expect(ranges[0].endLine).toBe(4);
  });

  it("folds a .if/.endif block", () => {
    const src = lines(`
.if DEBUG
  nop
.endif`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].line).toBe(2);
    expect(ranges[0].endLine).toBe(4);
  });

  it("folds a #if/#endif block", () => {
    const src = lines(`
#if DEBUG
  nop
#endif`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].line).toBe(2);
    expect(ranges[0].endLine).toBe(4);
  });

  it("folds a #ifdef/#endif block", () => {
    const src = lines(`
#ifdef DEBUG
  nop
#endif`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].line).toBe(2);
    expect(ranges[0].endLine).toBe(4);
  });

  it("folds a #ifndef/#endif block", () => {
    const src = lines(`
#ifndef RELEASE
  nop
#endif`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].line).toBe(2);
    expect(ranges[0].endLine).toBe(4);
  });

  // ── Label-prefixed keywords ──────────────────────────────────────────────

  it("folds when a label precedes the keyword", () => {
    const src = lines(`
Border .macro(color)
  nop
.endm`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].line).toBe(2);
    expect(ranges[0].endLine).toBe(4);
  });

  it("folds when a label with colon precedes the keyword", () => {
    const src = lines(`
Border: .macro(color)
  nop
.endm`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].line).toBe(2);
    expect(ranges[0].endLine).toBe(4);
  });

  // ── Case-insensitivity ───────────────────────────────────────────────────

  it("matches keywords case-insensitively", () => {
    const src = lines(`
.MACRO Foo
  nop
.ENDM`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].line).toBe(2);
    expect(ranges[0].endLine).toBe(4);
  });

  // ── Nesting ─────────────────────────────────────────────────────────────

  it("handles a .macro with a nested .if block", () => {
    const src = lines(`
Foo .macro
  .if DEBUG
    nop
  .endif
.endm`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(2);
    const sorted = [...ranges].sort((a, b) => a.line - b.line);
    expect(sorted[0]).toMatchObject({ line: 2, endLine: 6 }); // macro
    expect(sorted[1]).toMatchObject({ line: 3, endLine: 5 }); // if
  });

  it("handles deeply nested blocks", () => {
    const src = lines(`
.module M
  .proc P
    .loop 3
      nop
    .endl
  .endp
.endmodule`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(3);
    const sorted = [...ranges].sort((a, b) => a.line - b.line);
    expect(sorted[0]).toMatchObject({ line: 2, endLine: 8 }); // module
    expect(sorted[1]).toMatchObject({ line: 3, endLine: 7 }); // proc
    expect(sorted[2]).toMatchObject({ line: 4, endLine: 6 }); // loop
  });

  // ── Multiple top-level blocks ────────────────────────────────────────────

  it("returns ranges for multiple sequential blocks", () => {
    const src = lines(`
.macro Foo
  nop
.endm
.macro Bar
  nop
.endm`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toMatchObject({ line: 2, endLine: 4 });
    expect(ranges[1]).toMatchObject({ line: 5, endLine: 7 });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  it("ignores comment lines (starting with ;)", () => {
    const src = lines(`
; .macro this should be ignored
; .endm also ignored
nop`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(0);
  });

  it("returns no range when closer has no matching opener", () => {
    const src = lines(`
nop
.endm`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(0);
  });

  it("returns no range when opener has no matching closer", () => {
    const src = lines(`
.macro Orphan
  nop`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(0);
  });

  it("returns empty array for plain instructions with no blocks", () => {
    const src = lines(`
nop
ld hl, 0
ret`);
    const ranges = computeFoldingRanges(src);
    expect(ranges).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(computeFoldingRanges([])).toHaveLength(0);
    expect(computeFoldingRanges([""])).toHaveLength(0);
  });
});
