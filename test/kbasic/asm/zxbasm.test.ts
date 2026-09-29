import { describe, expect, it } from "vitest";

import { convertZxbasmBlocks } from "@main/kbasic/asm/zxbasm";

/** The converted text of each block's lines, without the indentation. */
function convert(...blocks: string[]): { out: string[][]; problems: string[] } {
  const problems: string[] = [];
  const out = convertZxbasmBlocks(
    blocks.map((b) => b.split("\n").map((text, k) => ({ text, span: k }))),
    (_span, message) => problems.push(message)
  );
  return { out: out.map((lines) => lines.map((l) => l.text.trim())), problems };
}

describe("zxbasm inline asm into Klive's dialect (compatibility plan C5)", () => {
  it("splits at ':' and keeps a label on its line", () => {
    expect(convert("ld hl,1 : inc hl").out[0]).toEqual(["ld hl,1", "inc hl"]);
    expect(convert("go: ld a,1").out[0]).toEqual(["go:", "ld a,1"]);
    expect(convert("rlca : rlca").out[0]).toEqual(["rlca", "rlca"]);
  });

  it("drops the comment, lowercases keywords and keeps the case of labels", () => {
    expect(convert("Ld Hl,MyData ; load : it").out[0]).toEqual(["ld hl,MyData"]);
  });

  it("writes numbers in decimal and characters as their codes", () => {
    expect(convert("ld hl,$1F+0x10+20h+%101+'A'").out[0]).toEqual(["ld hl,31+16+32+5+65"]);
  });

  it("turns grouping parentheses into brackets, but keeps a memory operand", () => {
    expect(convert("ld hl,(2+3)*4").out[0]).toEqual(["ld hl,[2+3]*4"]);
    expect(convert("ld a,(ix+(2*3))").out[0]).toEqual(["ld a,(ix+[2*3])"]);
    expect(convert("ld hl,(data)").out[0]).toEqual(["ld hl,(data)"]);
    expect(convert("db (1+2)").out[0]).toEqual([".defb [1+2]"]);
  });

  it("maps the data directives, and DEFB strings to bytes", () => {
    expect(convert('db "a""b",7\ndw 1\nds 3,9\nx equ 5').out[0]).toEqual([".defb 97,34,98,7", ".defw 1", ".defs 3,9", "x .equ 5"]);
  });

  it("rejects EQU after a label with a colon, as zxbasm", () => {
    expect(convert("v: EQU 3").problems).toHaveLength(1);
  });

  it("names temporary labels uniquely, and rejects an undefined one", () => {
    const { out } = convert("1: inc hl\ndjnz 1b\njr 1f\n1:");
    const [first, , back, fwd, second] = out[0];
    expect(back).toBe(`djnz ${first.replace(/:.*/, "")}`);
    expect(fwd).toBe(`jr ${second.replace(/:.*/, "")}`);
    expect(first).not.toBe(second);
    expect(convert("ld hl,1010b").problems).toEqual(["Undefined temporary label '1010b'"]);
  });

  it("makes only LOCAL names local, across blocks and before the LOCAL line", () => {
    const { out } = convert("PROC\njp lp\nother: nop", "LOCAL lp\nlp: nop\nENDP\njp lp");
    const local = out[0][1].slice(3);
    expect(local).not.toBe("lp");
    expect(out[1][1]).toBe(`${local}:`);
    expect(out[0][2]).toBe("other:");
    expect(out[1][4]).toBe("jp lp");
  });

  it("renames labels that are keywords of Klive's assembler", () => {
    expect(convert("bank: nop\nld a,(bank)").out[0]).toEqual(["bank__zx:", "nop", "ld a,(bank__zx)"]);
  });

  it("maps dotted names: labels, BASIC labels and globals", () => {
    expect(convert(".skip:\njr .skip\njp .LABEL._there\nld hl,(._g)").out[0]).toEqual(["skip:", "jr skip", "jp _label.there", "ld hl,(_g)"]);
  });

  it("keeps each line's span and the block's line count", () => {
    const out = convertZxbasmBlocks([[{ text: "a: nop : nop", span: 7 }, { text: "", span: 8 }]]);
    expect(out[0].map((l) => l.span)).toEqual([7, 7, 7, 8]);
  });
});
