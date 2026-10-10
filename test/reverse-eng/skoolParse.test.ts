import { describe, expect, it } from "vitest";
import { parseSkool, splitComment } from "@common/reverse/skool/skoolParse";
import { parseCtl } from "@common/reverse/skool/ctlParse";

// --- Fixtures written for these tests (R7, R8): no published skool or ctl file is used.
const SKOOL = [
  "; A file header written for this test",
  "@start",
  "",
  "@org=32768",
  "; Draw the frame",
  ";",
  "; Draws the border around the play area.",
  "; .",
  "; Called once per level.",
  ";",
  "; A Border colour",
  "; HL Address of the frame",
  ";",
  "; First we set things up.",
  "@label=FRAME",
  "c32768 LD A,7        ; {Set the colour",
  " 32770 OUT (254),A   ; and write it}",
  "; Now the loop.",
  "@label=LOOP",
  "*32772 DJNZ 32772    ; Wait for B",
  "                     ; to reach zero",
  " 32774 RET",
  "; The routine ends here.",
  "; .",
  "; Really.",
  "",
  "; Message text",
  "t$8007 DEFM \"Hi; there\" ; The greeting",
  " $800F DEFB 13",
  "",
  "i32784",
  "Anything at all",
  ""
].join("\n");

describe("skool parser", () => {
  const doc = parseSkool(SKOOL);

  it("keeps the header as a non-entry", () => {
    expect(doc.diagnostics).toEqual([]);
    expect(doc.nonEntries).toEqual([{ line: 1, lines: ["; A file header written for this test", "@start"] }]);
  });

  it("reads an entry's header sections", () => {
    const entry = doc.entries[0];
    expect(entry.type).toBe("c");
    expect(entry.address).toBe(32768);
    expect(entry.title).toBe("Draw the frame");
    expect(entry.description).toEqual(["Draws the border around the play area.", "Called once per level."]);
    expect(entry.registers).toEqual(["A Border colour", "HL Address of the frame"]);
    expect(entry.startComment).toEqual(["First we set things up."]);
    expect(entry.directives.map((d) => [d.name, d.value])).toEqual([["org", "32768"]]);
  });

  it("reads instructions, comments, braces and directives", () => {
    const [first, second, third, fourth] = doc.entries[0].instructions;
    expect(first).toMatchObject({ marker: "c", address: 32768, text: "LD A,7", comment: "Set the colour", braceOpen: true });
    expect(first.directives.map((d) => [d.name, d.value])).toEqual([["label", "FRAME"]]);
    expect(second).toMatchObject({ text: "OUT (254),A", comment: "and write it", braceClose: true });
    expect(third).toMatchObject({ marker: "*", address: 32772, comment: "Wait for B to reach zero", midComment: ["Now the loop."] });
    expect(third.directives[0]).toMatchObject({ name: "label", value: "LOOP", line: 19 });
    expect(fourth.comment).toBeUndefined();
    expect(doc.entries[0].endComment).toEqual(["The routine ends here.", "Really."]);
  });

  it("reads hex addresses and keeps semicolons inside strings", () => {
    const entry = doc.entries[1];
    expect(entry).toMatchObject({ type: "t", address: 0x8007, title: "Message text" });
    expect(entry.instructions[0]).toMatchObject({ text: 'DEFM "Hi; there"', comment: "The greeting" });
    expect(entry.instructions[1].address).toBe(0x800f);
  });

  it("keeps an ignored entry's raw lines", () => {
    expect(doc.entries[2]).toMatchObject({ type: "i", address: 32784, rawLines: ["Anything at all"] });
  });

  it("reports positions", () => {
    const bad = parseSkool("c32768 RET\nnonsense here\n");
    expect(bad.diagnostics).toEqual([{ line: 2, severity: "warning", message: "Unrecognised line; ignored." }]);
  });

  it("splits comments outside escaped strings", () => {
    expect(splitComment('DEFM "a\\"b;c" ; x')).toEqual({ text: 'DEFM "a\\"b;c"', comment: " x" });
  });
});

const CTL = [
  "# A control file written for this test",
  "> $8000 ; Header line",
  "@ $8000 label=FRAME",
  "c $8000 Draw the frame",
  "D $8000 Draws the border.",
  "D $8000 Called once per level.",
  "R $8000 A Border colour",
  "N $8000 First we set things up.",
  "C $8000,2 Set the colour",
  "N $8004 Now the loop.",
  "M $8002,4 Write and wait",
  "C $8004,2",
  "E $8000 The end.",
  "b $8010 Graphics",
  "B $8010,16,8 Two characters",
  "L $8010,16,4",
  "t $8050 Messages",
  "T $8050,10,9:n1",
  "i $8060",
  "x nonsense"
].join("\n");

describe("control file parser", () => {
  const doc = parseCtl(CTL);

  it("reads blocks and their comments", () => {
    expect(doc.entries.map((e) => [e.type, e.address, e.title])).toEqual([
      ["c", 0x8000, "Draw the frame"],
      ["b", 0x8010, "Graphics"],
      ["t", 0x8050, "Messages"],
      ["i", 0x8060, undefined]
    ]);
    const code = doc.entries[0];
    expect(code.description).toEqual(["Draws the border.", "Called once per level."]);
    expect(code.registers).toEqual(["A Border colour"]);
    expect(code.startComment).toEqual(["First we set things up."]);
    expect(code.endComment).toEqual(["The end."]);
    expect(code.spanComments).toEqual([{ line: 11, address: 0x8002, length: 4, text: "Write and wait" }]);
  });

  it("reads sub-blocks with lengths and mid-block comments", () => {
    const code = doc.entries[0];
    expect(code.instructions.map((i) => [i.address, i.subType, i.length, i.comment, i.midComment])).toEqual([
      [0x8000, "c", 2, "Set the colour", undefined],
      [0x8004, "c", 2, undefined, ["Now the loop."]]
    ]);
    expect(doc.entries[1].instructions[0]).toMatchObject({ subType: "b", length: 16, sublengths: "8" });
    expect(doc.entries[1].repeats).toEqual([{ line: 16, spec: "$8010,16,4" }]);
    expect(doc.entries[2].instructions[0]).toMatchObject({ subType: "t", length: 10, sublengths: "9:n1" });
  });

  it("keeps directives and non-entry text", () => {
    expect(doc.addressDirectives).toEqual([{ address: 0x8000, directive: { name: "label", value: "FRAME", line: 3 } }]);
    expect(doc.nonEntries).toEqual([{ line: 2, address: 0x8000, lines: ["; Header line"] }]);
  });

  it("reports what it does not understand", () => {
    expect(doc.diagnostics).toEqual([{ line: 20, severity: "warning", message: "Unrecognised control directive; ignored." }]);
  });
});
