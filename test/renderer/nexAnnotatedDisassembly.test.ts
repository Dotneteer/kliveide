import { describe, expect, it } from "vitest";
import { createAnnotatedNexDisassemblyItems } from "@renderer/appIde/DocumentPanels/Next/nexAnnotatedDisassembly";

describe("createAnnotatedNexDisassemblyItems", () => {
  it("renders annotated regions, comments, and labels", async () => {
    const contents = new Uint8Array(0x4000);
    contents.set([
      0xcd, 0x34, 0x12,
      0x01, 0x02, 0x03, 0x04,
      0x78, 0x56, 0xbc, 0x9a
    ]);

    const items = await createAnnotatedNexDisassemblyItems({
      annotations: {
        schemaVersion: 1,
        globalLabels: [{ name: "EntryPoint", value: 0x8000 }],
        banks: {
          "5": {
            offsetIndex: 2,
            regions: [
              { start: 0, end: 2, type: "disassemble" },
              { start: 3, end: 6, type: "bytes" },
              { start: 7, end: 10, type: "words" },
              { start: 11, end: 15, type: "skip" }
            ],
            localLabels: [{ name: "DataBytes", value: 3 }],
            lineAnnotations: {
              "0": {
                synopsis: "Program entry\nCalls setup",
                comment: "annotated call"
              },
              "3": {
                comment: "packed values"
              }
            }
          }
        }
      },
      bank: 5,
      contents,
      disassOffset: 0x8000
    });

    expect(items).toEqual([
      expect.objectContaining({
        address: 0x8000,
        isPrefixItem: true,
        prefixComment: "Program entry",
        annotation: expect.objectContaining({
          bank: 5,
          bankOffset: 0,
          byteLength: 3,
          regionType: "disassemble",
          hasLineAnnotation: true
        })
      }),
      expect.objectContaining({
        address: 0x8000,
        isPrefixItem: true,
        prefixComment: "Calls setup"
      }),
      expect.objectContaining({
        address: 0x8000,
        formattedLabel: "EntryPoint",
        hardComment: "annotated call",
        instruction: "call L1234",
        annotation: expect.objectContaining({
          bank: 5,
          bankOffset: 0,
          byteLength: 3,
          regionType: "disassemble",
          hasLineAnnotation: true,
          hasLabel: true
        })
      }),
      expect.objectContaining({
        address: 0x8003,
        formattedLabel: "DataBytes",
        hardComment: "packed values",
        instruction: ".defb $01, $02, $03, $04",
        annotation: expect.objectContaining({
          bank: 5,
          bankOffset: 3,
          byteLength: 4,
          regionType: "bytes",
          hasLineAnnotation: true,
          hasLabel: true
        })
      }),
      expect.objectContaining({
        address: 0x8007,
        instruction: ".defw $5678, $9ABC",
        annotation: expect.objectContaining({
          bank: 5,
          bankOffset: 7,
          byteLength: 4,
          regionType: "words"
        })
      }),
      expect.objectContaining({
        address: 0x800b,
        instruction: ".skip $0005",
        annotation: expect.objectContaining({
          bank: 5,
          bankOffset: 11,
          byteLength: 5,
          regionType: "skip"
        })
      })
    ]);
  });

  it("uses annotation grouping in decimal mode", async () => {
    const contents = new Uint8Array(0x4000);
    contents.set([1, 2, 3, 4, 0x78, 0x56, 0xbc, 0x9a]);

    const items = await createAnnotatedNexDisassemblyItems({
      annotations: {
        schemaVersion: 1,
        banks: {
          "2": {
            offsetIndex: 1,
            regions: [
              { start: 0, end: 3, type: "bytes" },
              { start: 4, end: 7, type: "words" },
              { start: 8, end: 10, type: "skip" }
            ]
          }
        }
      },
      bank: 2,
      contents,
      decimalView: true,
      disassOffset: 0x4000
    });

    expect(items).toEqual([
      expect.objectContaining({ instruction: ".defb 001, 002, 003, 004" }),
      expect.objectContaining({ instruction: ".defw 22136, 39612" }),
      expect.objectContaining({ instruction: ".skip 3" })
    ]);
  });

  it("returns undefined when the bank has no annotation", async () => {
    await expect(
      createAnnotatedNexDisassemblyItems({
        annotations: {
          schemaVersion: 1,
          banks: {}
        },
        bank: 7,
        contents: new Uint8Array(0x4000)
      })
    ).resolves.toBeUndefined();
  });

  it("substitutes automatic global labels in 16-bit operands", async () => {
    const contents = new Uint8Array(0x4000);
    contents.set([0xcd, 0x34, 0x12]);

    const items = await createAnnotatedNexDisassemblyItems({
      annotations: {
        schemaVersion: 1,
        globalLabels: [{ name: "SetupRoutine", value: 0x1234 }],
        banks: {
          "5": {
            offsetIndex: 2,
            regions: [{ start: 0, end: 2, type: "disassemble" }]
          }
        }
      },
      bank: 5,
      contents,
      disassOffset: 0x8000
    });

    expect(items?.[0]).toEqual(
      expect.objectContaining({
        instruction: "call SetupRoutine"
      })
    );
  });

  it("substitutes automatic local labels in 16-bit operands within the bank window", async () => {
    const contents = new Uint8Array(0x4000);
    contents.set([0xcd, 0x34, 0x92]);

    const items = await createAnnotatedNexDisassemblyItems({
      annotations: {
        schemaVersion: 1,
        banks: {
          "5": {
            offsetIndex: 2,
            regions: [{ start: 0, end: 2, type: "disassemble" }],
            localLabels: [{ name: "LocalSetup", value: 0x1234 }]
          }
        }
      },
      bank: 5,
      contents,
      disassOffset: 0x8000
    });

    expect(items?.[0]).toEqual(
      expect.objectContaining({
        instruction: "call LocalSetup"
      })
    );
  });

  it("uses explicit operand references before automatic label matches", async () => {
    const contents = new Uint8Array(0x4000);
    contents.set([0xcd, 0x34, 0x92]);

    const items = await createAnnotatedNexDisassemblyItems({
      annotations: {
        schemaVersion: 1,
        globalLabels: [{ name: "GlobalSetup", value: 0x9234 }],
        banks: {
          "5": {
            offsetIndex: 2,
            regions: [{ start: 0, end: 2, type: "disassemble" }],
            localLabels: [{ name: "LocalSetup", value: 0x1234 }],
            operandReferences: {
              "0": [{ operandIndex: 0, scope: "local", name: "LocalSetup" }]
            }
          }
        }
      },
      bank: 5,
      contents,
      disassOffset: 0x8000
    });

    expect(items?.[0]).toEqual(
      expect.objectContaining({
        instruction: "call LocalSetup"
      })
    );
  });

  it("keeps numeric operands when an explicit reference no longer matches", async () => {
    const contents = new Uint8Array(0x4000);
    contents.set([0xcd, 0x34, 0x92]);

    const items = await createAnnotatedNexDisassemblyItems({
      annotations: {
        schemaVersion: 1,
        globalLabels: [{ name: "GlobalSetup", value: 0x9234 }],
        banks: {
          "5": {
            offsetIndex: 2,
            regions: [{ start: 0, end: 2, type: "disassemble" }],
            localLabels: [{ name: "OtherLocal", value: 0x0010 }],
            operandReferences: {
              "0": [{ operandIndex: 0, scope: "local", name: "OtherLocal" }]
            }
          }
        }
      },
      bank: 5,
      contents,
      disassOffset: 0x8000
    });

    expect(items?.[0]).toEqual(
      expect.objectContaining({
        instruction: "call L9234"
      })
    );
  });
});
