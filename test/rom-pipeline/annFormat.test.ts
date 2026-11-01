import { describe, expect, it } from "vitest";

import { parseAnn, writeAnn } from "@common/reverse/pipeline/annFormat";

/*
 * The `.ann` grammar (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §5, P1): every line kind, the escapes,
 * and problems reported with their line instead of thrown.
 */

const SAMPLE = `# A sample
rom ep-exos21.rom page 0 cpu z80
default observed

code 0000-0B3C
bytes 0B3D-0B3F rows=1 radix=binary
text 0B40-0B4F

.0001 Before the first block

@0B40 SEG1_SERVICE
  EXOS 32 (read time): segment 1 service 0.
     1. An indented step line
  \\.0B41 is not a comment here
  \\\\ starts with a backslash
  \\
  Entry: A = the service number.
  .0B41 A' = service number
.0B44 Through the pager \\\\ at $B217\\nsecond line

@0C00
  A synopsis with no label

manual 0B40:label 0B41:line
derived 0B3D:region
delete 0D00:synopsis
question 0C40 Does A come back 0 for a missing drive?
feedback missing 0B40 "Card did not say $B217 is the pager"
feedback pattern 0D00-0D40 Six routines end SCF / RET
`;

describe("parseAnn", () => {
  it("reads every line kind", () => {
    const { document, problems } = parseAnn(SAMPLE, "sample.ann");
    expect(problems).toEqual([]);
    expect(document.header).toEqual({ rom: "ep-exos21.rom", page: 0, cpu: "z80" });
    expect(document.regions.map((r) => [r.kind, r.start, r.end, r.rowBytes, r.radix])).toEqual([
      ["code", 0, 0x0b3c, undefined, undefined],
      ["bytes", 0x0b3d, 0x0b3f, 1, "binary"],
      ["text", 0x0b40, 0x0b4f, undefined, undefined]
    ]);
    expect(document.labels.map((l) => [l.offset, l.name])).toEqual([[0x0b40, "SEG1_SERVICE"]]);
    expect(document.synopses.map((s) => [s.offset, s.text])).toEqual([
      [
        0x0b40,
        [
          "EXOS 32 (read time): segment 1 service 0.",
          "   1. An indented step line",
          ".0B41 is not a comment here",
          "\\ starts with a backslash",
          "",
          "Entry: A = the service number."
        ].join("\n")
      ],
      [0x0c00, "A synopsis with no label"]
    ]);
    expect(document.comments.map((c) => [c.offset, c.text])).toEqual([
      [0x0001, "Before the first block"],
      [0x0b41, "A' = service number"],
      [0x0b44, "Through the pager \\ at $B217\nsecond line"]
    ]);
    expect(document.provenance.map((m) => [m.offset, m.kind, m.provenance])).toEqual([
      [0x0b40, "label", "manual"],
      [0x0b41, "line", "manual"],
      [0x0b3d, "region", "derived"]
    ]);
    expect(document.deletes).toMatchObject([{ offset: 0x0d00, kind: "synopsis" }]);
    expect(document.questions).toMatchObject([{ offset: 0x0c40, text: "Does A come back 0 for a missing drive?" }]);
    expect(document.feedback).toMatchObject([
      { kind: "missing", from: 0x0b40, to: 0x0b40, text: "Card did not say $B217 is the pager" },
      { kind: "pattern", from: 0x0d00, to: 0x0d40, text: "Six routines end SCF / RET" }
    ]);
  });

  it("reports every bad line with its number, and a missing header", () => {
    const { problems } = parseAnn(
      ["code 0000", "@0B40 1BAD", " one space", "  orphan?", "bytes 0000-0001 rows=0", "zap 0000", "manual 0B40:name"].join("\n"),
      "bad.ann"
    );
    // --- Line 4 follows a rejected block, so it has no block to join
    expect(problems.map((p) => p.line)).toEqual([1, 2, 3, 4, 5, 6, 7, 1]);
    expect(problems.at(-1)?.message).toMatch(/header/);
    const orphan = parseAnn("rom x.rom page 0 cpu z80\n  orphan", "o.ann").problems;
    expect(orphan).toMatchObject([{ line: 2, message: expect.stringMatching(/needs a block/) }]);
  });

  it("rejects a bad header and a block given twice", () => {
    expect(parseAnn("rom x.rom page 0 cpu 8080", "h.ann").problems[0].message).toMatch(/header is/);
    const twice = parseAnn("rom x.rom page 0 cpu z80n\n@0010 A\n@0010", "t.ann");
    expect(twice.document.header?.cpu).toBe("z80n");
    expect(twice.problems).toMatchObject([{ line: 3, message: expect.stringMatching(/twice/) }]);
  });
});

describe("writeAnn", () => {
  it("writes a document that parses back to the same entries", () => {
    const first = parseAnn(SAMPLE, "sample.ann").document;
    const text = writeAnn(first);
    const second = parseAnn(text, "again.ann");
    expect(second.problems).toEqual([]);
    const strip = (doc: typeof first) =>
      JSON.parse(JSON.stringify(doc, (key, value) => (key === "line" ? undefined : value)));
    expect(strip(second.document)).toEqual(strip(first));
    // --- And writing it again changes nothing
    expect(writeAnn(second.document)).toBe(text);
  });

  it("wraps long provenance lists at 92 columns", () => {
    const { document } = parseAnn("rom x.rom page 0 cpu z80", "x.ann");
    document.provenance = Array.from({ length: 40 }, (_, i) => ({ offset: i, kind: "label" as const, provenance: "manual" as const, line: 0 }));
    const lines = writeAnn(document).split("\n").filter((l) => l.startsWith("manual"));
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => l.length <= 92)).toBe(true);
  });
});
