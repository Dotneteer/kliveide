import { describe, expect, it } from "vitest";
import {
  createDefaultNexAnnotations,
  getLabelsAtBankOffset,
  getNexAnnotationPath,
  getNexBankAddressOffset,
  getNexBankOffsetIndex,
  getOperandLabelCandidates,
  isNexAnnotationPath,
  isValidNexLabelName,
  NEX_BANK_COMMENT_SOFT_LIMIT,
  normalizeMultilineComment,
  parseNexAnnotations,
  validateNexAnnotations
} from "@renderer/appIde/DocumentPanels/Next/nexAnnotations";

describe("NEX annotations", () => {
  it("derives the sidecar path and recognizes annotation files", () => {
    expect(getNexAnnotationPath("/tmp/ScrollNutter.nex")).toBe("/tmp/ScrollNutter.nex.dis");
    expect(isNexAnnotationPath("/tmp/ScrollNutter.nex.dis")).toBe(true);
    expect(isNexAnnotationPath("/tmp/ScrollNutter.NEX.DIS")).toBe(true);
    expect(isNexAnnotationPath("/tmp/ScrollNutter.dis")).toBe(false);
  });

  it("creates default annotations for loaded banks", () => {
    const annotations = createDefaultNexAnnotations({
      nexPath: "/games/ScrollNutter.nex",
      sha256: "abc123",
      loadedBanks: [5, 2, 0, 122],
      getDefaultOffsetIndex: (bank) => (bank === 5 ? 1 : 3)
    });

    expect(annotations.source).toEqual({
      fileName: "ScrollNutter.nex",
      sha256: "abc123"
    });
    expect(Object.keys(annotations.banks)).toEqual(["0", "2", "5"]);
    expect(annotations.banks["5"].offsetIndex).toBe(1);
    expect(annotations.banks["2"].offsetIndex).toBe(3);
    expect(annotations.banks["5"].regions).toEqual([
      { start: 0, end: 0x3fff, type: "disassemble" }
    ]);
  });

  it("parses and normalizes a minimal valid annotation file", () => {
    const result = parseNexAnnotations(
      JSON.stringify({
        schemaVersion: 1,
        source: { fileName: "ScrollNutter.nex" },
        globalLabels: [{ name: "MainLoop", value: 0xc123 }],
        banks: {
          "5": {
            offsetIndex: 3,
            lastView: "disassembly",
            decimalView: true,
            localLabels: [{ name: "LocalLoop", value: 0x0123 }],
            regions: [
              { start: 0x0100, end: 0x0103, type: "bytes" },
              { start: 0x0200, end: 0x0203, type: "words" },
              { start: 0x0300, end: 0x030f, type: "skip" }
            ],
            lineAnnotations: {
              "0": { synopsis: "Entry point", comment: "sets SP" },
              "1": { synopsis: "", comment: "" }
            },
            operandReferences: {
              "2": [{ operandIndex: 0, scope: "global", name: "MainLoop" }]
            }
          }
        }
      }),
      { loadedBanks: [5] }
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.annotations?.banks["5"].lastView).toBe("disassembly");
    expect(result.annotations?.banks["5"].decimalView).toBe(true);
    expect(result.annotations?.banks["5"].regions).toEqual([
      { start: 0x0000, end: 0x00ff, type: "disassemble" },
      { start: 0x0100, end: 0x0103, type: "bytes" },
      { start: 0x0104, end: 0x01ff, type: "disassemble" },
      { start: 0x0200, end: 0x0203, type: "words" },
      { start: 0x0204, end: 0x02ff, type: "disassemble" },
      { start: 0x0300, end: 0x030f, type: "skip" },
      { start: 0x0310, end: 0x3fff, type: "disassemble" }
    ]);
    expect(result.annotations?.banks["5"].lineAnnotations).toEqual({
      "0": { synopsis: "Entry point", comment: "sets SP" }
    });
    expect(result.annotations?.banks["5"].operandReferences).toEqual({
      "2": [{ operandIndex: 0, scope: "global", name: "MainLoop" }]
    });
  });

  it("accepts missing and empty region lists as a full disassembly region", () => {
    const result = validateNexAnnotations({
      schemaVersion: 1,
      banks: {
        "0": { offsetIndex: 0 },
        "2": { offsetIndex: 2, regions: [] }
      }
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.annotations?.banks["0"].regions).toEqual([
      { start: 0, end: 0x3fff, type: "disassemble" }
    ]);
    expect(result.annotations?.banks["2"].regions).toEqual([
      { start: 0, end: 0x3fff, type: "disassemble" }
    ]);
  });

  it("reports JSON syntax errors", () => {
    const result = parseNexAnnotations("{ nope");

    expect(result.annotations).toBeUndefined();
    expect(result.diagnostics[0]).toMatchObject({
      severity: "error",
      path: "$"
    });
  });

  it("rejects invalid labels, ranges, bank keys, and operand references", () => {
    const result = validateNexAnnotations({
      schemaVersion: 1,
      globalLabels: [
        { name: "ThisLabelNameIsTooLong", value: 0 },
        { name: "Good", value: 0x10000 }
      ],
      banks: {
        "-1": { offsetIndex: 0 },
        "5": {
          offsetIndex: 4,
          localLabels: [
            { name: "Local", value: 0x4000 },
            { name: "2Bad", value: 0 }
          ],
          regions: [{ start: 0x0100, end: 0x00ff, type: "bytes" }],
          operandReferences: {
            "0": [{ operandIndex: 0, scope: "global", name: "Missing" }]
          }
        }
      }
    });

    expect(result.annotations).toBeUndefined();
    expect(result.diagnostics.filter((item) => item.severity === "error").length).toBeGreaterThan(6);
    expect(result.diagnostics.map((item) => item.path)).toEqual(
      expect.arrayContaining([
        "$.globalLabels[0].name",
        "$.globalLabels[1].value",
        "$.banks.-1",
        "$.banks.5.offsetIndex",
        "$.banks.5.localLabels[0].value",
        "$.banks.5.localLabels[1].name",
        "$.banks.5.regions[0]"
      ])
    );
  });

  it("rejects invalid bank last view values", () => {
    const result = validateNexAnnotations({
      schemaVersion: 1,
      banks: {
        "5": {
          offsetIndex: 0,
          lastView: "hex"
        }
      }
    });

    expect(result.annotations).toBeUndefined();
    expect(result.diagnostics).toContainEqual({
      severity: "error",
      path: "$.banks.5.lastView",
      message: "lastView must be memory or disassembly."
    });
  });

  it("rejects invalid bank decimal view values", () => {
    const result = validateNexAnnotations({
      schemaVersion: 1,
      banks: {
        "5": {
          offsetIndex: 0,
          decimalView: "yes"
        }
      }
    });

    expect(result.annotations).toBeUndefined();
    expect(result.diagnostics).toContainEqual({
      severity: "error",
      path: "$.banks.5.decimalView",
      message: "decimalView must be a boolean."
    });
  });

  it("reads rowBytes on bytes regions, and keeps differently laid-out neighbours apart", () => {
    const result = validateNexAnnotations({
      schemaVersion: 2,
      banks: {
        "5": {
          offsetIndex: 0,
          regions: [
            { start: 0, end: 7, type: "bytes" },
            { start: 8, end: 15, type: "bytes", rowBytes: 2 },
            // --- The default size, written out, reads as no field at all and merges with it.
            { start: 16, end: 23, type: "bytes", rowBytes: 4 }
          ]
        }
      }
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.annotations?.banks["5"].regions).toEqual([
      { start: 0, end: 7, type: "bytes" },
      { start: 8, end: 15, type: "bytes", rowBytes: 2 },
      { start: 16, end: 23, type: "bytes" },
      { start: 24, end: 0x3fff, type: "disassemble" }
    ]);
  });

  it("rejects rowBytes outside 1..4 or on a region that is not bytes", () => {
    const check = (region: Record<string, unknown>) =>
      validateNexAnnotations({ schemaVersion: 2, banks: { "5": { offsetIndex: 0, regions: [region] } } });

    for (const rowBytes of [0, 5, 1.5, "2"]) {
      const bad = check({ start: 0, end: 7, type: "bytes", rowBytes });
      expect(bad.annotations).toBeUndefined();
      expect(bad.diagnostics).toContainEqual({
        severity: "error",
        path: "$.banks.5.regions[0].rowBytes",
        message: "rowBytes must be in the range 1..4."
      });
    }
    const onWords = check({ start: 0, end: 7, type: "words", rowBytes: 2 });
    expect(onWords.annotations).toBeUndefined();
    expect(onWords.diagnostics).toContainEqual({
      severity: "error",
      path: "$.banks.5.regions[0].rowBytes",
      message: "rowBytes applies only to bytes regions."
    });
  });

  it("rejects overlapping regions and odd-length word regions", () => {
    const overlapping = validateNexAnnotations({
      schemaVersion: 1,
      banks: {
        "5": {
          offsetIndex: 0,
          regions: [
            { start: 0, end: 4, type: "bytes" },
            { start: 4, end: 8, type: "skip" }
          ]
        }
      }
    });
    const oddWords = validateNexAnnotations({
      schemaVersion: 1,
      banks: {
        "5": {
          offsetIndex: 0,
          regions: [{ start: 0, end: 2, type: "words" }]
        }
      }
    });

    expect(overlapping.annotations).toBeUndefined();
    expect(overlapping.diagnostics).toContainEqual({
      severity: "error",
      path: "$.banks.5.regions",
      message: "Regions must not overlap."
    });
    expect(oddWords.annotations).toBeUndefined();
    expect(oddWords.diagnostics).toContainEqual({
      severity: "error",
      path: "$.banks.5.regions[0]",
      message: "Word regions must contain an even number of bytes."
    });
  });

  it("warns about annotations for banks missing from the loaded NEX file", () => {
    const result = validateNexAnnotations(
      {
        schemaVersion: 1,
        banks: {
          "4": { offsetIndex: 0 }
        }
      },
      { loadedBanks: [0, 2, 5] }
    );

    expect(result.annotations).toBeDefined();
    expect(result.diagnostics).toEqual([
      {
        severity: "warning",
        path: "$.banks.4",
        message: "Bank is not present in the loaded NEX file."
      }
    ]);
  });

  it("validates label names with the shared NEX annotation rule", () => {
    expect(isValidNexLabelName("MainLoop")).toBe(true);
    expect(isValidNexLabelName("_local1")).toBe(true);
    expect(isValidNexLabelName("123Bad")).toBe(false);
    expect(isValidNexLabelName("")).toBe(false);
    expect(isValidNexLabelName("SixteenCharsHere")).toBe(true);
    expect(isValidNexLabelName("SeventeenCharsHere")).toBe(false);
  });

  it("resolves labels at bank offsets and operand values", () => {
    const result = validateNexAnnotations({
      schemaVersion: 1,
      globalLabels: [{ name: "GlobalTarget", value: 0xc123 }],
      banks: {
        "5": {
          offsetIndex: 3,
          localLabels: [{ name: "LocalTarget", value: 0x0123 }]
        }
      }
    });

    expect(result.annotations).toBeDefined();
    expect(getNexBankAddressOffset(3)).toBe(0xc000);
    expect(getNexBankOffsetIndex(0xc000)).toBe(3);
    expect(getNexBankOffsetIndex(0x2000)).toBeUndefined();
    expect(getLabelsAtBankOffset(result.annotations!, 5, 0x0123)).toEqual([
      { name: "GlobalTarget", value: 0xc123, scope: "global" },
      { name: "LocalTarget", value: 0x0123, scope: "local", bank: 5 }
    ]);
    expect(getOperandLabelCandidates(result.annotations!, 5, 0xc123)).toEqual([
      { name: "GlobalTarget", value: 0xc123, scope: "global" },
      { name: "LocalTarget", value: 0x0123, scope: "local", bank: 5 }
    ]);
  });
});

describe("NEX bank comments", () => {
  function parseBank(bank: Record<string, unknown>) {
    return parseNexAnnotations(
      JSON.stringify({ schemaVersion: 2, banks: { "5": { offsetIndex: 1, ...bank } } })
    );
  }

  it("reads a multi-line bank comment", () => {
    const result = parseBank({ comment: "Music player\nCalled from IsrMain" });
    expect(result.diagnostics).toEqual([]);
    expect(result.annotations?.banks["5"].comment).toBe("Music player\nCalled from IsrMain");
  });

  it("normalizes line breaks and trailing whitespace the way the dialog writes them", () => {
    const result = parseBank({ comment: "First  \r\n\r\nSecond\t" });
    expect(result.annotations?.banks["5"].comment).toBe("First\n\nSecond");
  });

  it("drops a comment with nothing visible in it rather than storing it", () => {
    const result = parseBank({ comment: "  \n\t" });
    expect(result.diagnostics).toEqual([]);
    expect(result.annotations?.banks["5"]).not.toHaveProperty("comment");
  });

  it("rejects a comment that is not a string", () => {
    const result = parseBank({ comment: 42 });
    expect(result.diagnostics).toContainEqual({
      severity: "error",
      path: "$.banks.5.comment",
      message: "Bank comment must be a string."
    });
  });

  it("warns about, but still loads, an over-long comment", () => {
    const long = "x".repeat(NEX_BANK_COMMENT_SOFT_LIMIT + 1);
    const result = parseBank({ comment: long });
    expect(result.annotations?.banks["5"].comment).toBe(long);
    expect(result.diagnostics.map((d) => d.severity)).toEqual(["warning"]);
  });

  it("shares its normalization with the synopsis dialog", () => {
    expect(normalizeMultilineComment(" First  \n\t\nSecond\t")).toBe(" First\n\nSecond");
    expect(normalizeMultilineComment("  \n\t")).toBeUndefined();
  });
});

describe("NEX bank sprites", () => {
  function parseBank(bank: Record<string, unknown>) {
    return parseNexAnnotations(
      JSON.stringify({ schemaVersion: 2, banks: { "5": { offsetIndex: 1, ...bank } } })
    );
  }

  it("reads a format and an offset", () => {
    const result = parseBank({ sprites: { format: "4bit", offset: 3 } });
    expect(result.diagnostics).toEqual([]);
    expect(result.annotations?.banks["5"].sprites).toEqual({ format: "4bit", offset: 3 });
  });

  it("has no block when none is written", () => {
    expect(parseBank({}).annotations?.banks["5"]).not.toHaveProperty("sprites");
  });

  it("warns about bad values, ignores them, and still loads the file", () => {
    const result = parseBank({ sprites: { format: "16bit", offset: 0x4000 } });
    expect(result.annotations).toBeDefined();
    expect(result.annotations?.banks["5"]).not.toHaveProperty("sprites");
    expect(result.diagnostics.map((d) => [d.severity, d.path])).toEqual([
      ["warning", "$.banks.5.sprites.format"],
      ["warning", "$.banks.5.sprites.offset"]
    ]);
  });

  it("keeps the good half of a half-bad block", () => {
    const result = parseBank({ sprites: { format: "4bit", offset: -1 } });
    expect(result.annotations?.banks["5"].sprites).toEqual({ format: "4bit" });
  });

  it("reads the active flag, and warns about a non-boolean one", () => {
    expect(parseBank({ sprites: { active: true } }).annotations?.banks["5"].sprites).toEqual({
      active: true
    });
    expect(parseBank({ sprites: { active: false } }).annotations?.banks["5"]).not.toHaveProperty(
      "sprites"
    );
    const bad = parseBank({ sprites: { active: "yes" } });
    expect(bad.annotations).toBeDefined();
    expect(bad.diagnostics.map((d) => d.severity)).toEqual(["warning"]);
  });

  it("warns about a block that is not an object", () => {
    const result = parseBank({ sprites: "4bit" });
    expect(result.annotations).toBeDefined();
    expect(result.diagnostics.map((d) => d.severity)).toEqual(["warning"]);
  });
});
