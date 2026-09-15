import { describe, expect, it } from "vitest";
import {
  createAnnotatedNexDisassemblyItems,
  pcAnchoredRuns
} from "@renderer/appIde/DocumentPanels/Next/nexAnnotatedDisassembly";

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
          hasLineAnnotation: true,
          // --- Two lines, so the space that sets the note off from the code goes above this one
          // --- and below the next, never between them.
          synopsisEdge: "first"
        })
      }),
      expect.objectContaining({
        address: 0x8000,
        isPrefixItem: true,
        prefixComment: "Calls setup",
        annotation: expect.objectContaining({ synopsisEdge: "last" })
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
  /*
   * A synopsis is stored as one comment per *line* and rendered as one row per line, so the block a
   * reader sees as a single paragraph is a run of rows. `synopsisEdge` is what lets the view put
   * breathing space at the block's outer edges only — see `.synopsisBlockFirst` /
   * `.synopsisBlockLast` in `DisassemblyPanel.module.scss`.
   */
  describe("synopsis block edges", () => {
    /** Builds a listing whose first row carries `synopsis`, and returns its synopsis rows' edges. */
    async function edgesFor(synopsis: string) {
      const contents = new Uint8Array(0x4000);
      contents.set([0x00]);
      const items = await createAnnotatedNexDisassemblyItems({
        annotations: {
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 0, type: "disassemble" }],
              lineAnnotations: { "0": { synopsis } }
            }
          }
        },
        bank: 5,
        contents,
        disassOffset: 0x8000
      });
      return (items ?? [])
        .filter((item) => item.isPrefixItem)
        .map((item) => item.annotation?.synopsisEdge);
    }

    it("marks a one-line note as both edges at once", async () => {
      // --- Not "first": a single line has to take the space above *and* below, or a one-line note
      // --- would sit flush against the code beneath it.
      expect(await edgesFor("Just one line")).toEqual(["only"]);
    });

    it("marks only the outer lines of a multi-line note", async () => {
      expect(await edgesFor("One\nTwo\nThree\nFour")).toEqual([
        "first",
        "middle",
        "middle",
        "last"
      ]);
    });
  });
});

/*
 * Alignment at the program counter.
 *
 * A linear decode is only as well-aligned as the offset it started from, and self-modifying code or
 * a jump table can make it wrong for the rest of the bank. A paused Z80 sits between instructions,
 * so PC is the one offset where the alignment is known rather than guessed.
 */
describe("pcAnchoredRuns", () => {
  it("leaves the range alone when there is no program counter to anchor to", () => {
    // --- The machine is running, or PC is in some other bank. Nothing to align against.
    expect(pcAnchoredRuns(0, 100, undefined)).toEqual([[0, 100]]);
  });

  it("leaves the range alone when it already begins on the anchor", () => {
    // --- A cut at `start` would produce an empty first run for no gain.
    expect(pcAnchoredRuns(10, 100, 10)).toEqual([[10, 100]]);
  });

  it("cuts the range in two at the anchor", () => {
    expect(pcAnchoredRuns(0, 100, 40)).toEqual([
      [0, 39],
      [40, 100]
    ]);
  });

  it("cuts at the last byte, which is a range of one", () => {
    expect(pcAnchoredRuns(0, 100, 100)).toEqual([
      [0, 99],
      [100, 100]
    ]);
  });

  it("ignores an anchor outside the range, in either direction", () => {
    // --- PC in another region of the same bank: this run has nothing to say about it.
    expect(pcAnchoredRuns(50, 100, 20)).toEqual([[50, 100]]);
    expect(pcAnchoredRuns(0, 100, 101)).toEqual([[0, 100]]);
  });
});

describe("createAnnotatedNexDisassemblyItems with a program counter", () => {
  /*
   * `nop nop ld hl,$1234 nop`, decoded linearly, puts instruction boundaries at 0, 1, 2 and 5. So
   * offset 3 is the middle of the `ld hl` — exactly the case where a listing built from a guess
   * disagrees with the processor about where an instruction starts.
   */
  const CODE = [0x00, 0x00, 0x21, 0x34, 0x12, 0x00];

  async function addressesFor(pcBankOffset?: number): Promise<number[]> {
    const contents = new Uint8Array(0x4000);
    contents.set(CODE);

    const items = await createAnnotatedNexDisassemblyItems({
      annotations: {
        schemaVersion: 1,
        globalLabels: [],
        banks: {
          "5": {
            offsetIndex: 2,
            regions: [{ start: 0, end: 5, type: "disassemble" }],
            localLabels: [],
            lineAnnotations: {}
          }
        }
      },
      bank: 5,
      contents,
      disassOffset: 0x8000,
      pcBankOffset
    });

    return (items ?? []).filter((item) => !item.isPrefixItem).map((item) => item.address);
  }

  it("decodes linearly when the machine is not paused in this bank", async () => {
    // --- The boundaries a decode from byte 0 produces, and nothing at $8003.
    const addresses = await addressesFor(undefined);
    expect(addresses).toContain(0x8002);
    expect(addresses).not.toContain(0x8003);
  });

  it("puts an instruction boundary at the program counter", async () => {
    // --- The processor is about to execute the byte at offset 3, so the listing has to show an
    // --- instruction starting there rather than the middle of one it guessed at.
    expect(await addressesFor(3)).toContain(0x8003);
  });

  it("leaves an already-aligned listing untouched", async () => {
    // --- Anchoring at a boundary the decode found on its own has to be a no-op, or stepping
    // --- through aligned code would reshuffle the listing on every step.
    expect(await addressesFor(2)).toEqual(await addressesFor(undefined));
  });
});
