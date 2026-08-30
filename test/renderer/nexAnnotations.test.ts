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
