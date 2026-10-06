import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

// ---------------------------------------------------------------------------
// Helpers

function nextOptions(): AssemblerOptions {
  const opts = new AssemblerOptions();
  opts.currentModel = SpectrumModelType.Next;
  return opts;
}

async function compileNext(source: string) {
  return await new Z80Assembler().compile(source, nextOptions());
}

async function compileCopper(source: string, ...expectedBytes: number[]): Promise<void> {
  const result = await compileNext(source);
  expect(result.errors.map((e) => `${e.errorCode}: ${e.message}`)).toEqual([]);
  expect(result.segments.length).toBe(1);
  expect(result.segments[0].emittedCode).toEqual(expectedBytes);
}

async function compileCopperErrors(source: string, ...errorCodes: string[]) {
  const result = await compileNext(source);
  expect(result.errors.map((e) => e.errorCode)).toEqual(errorCodes);
  return result;
}

// ---------------------------------------------------------------------------
// Model guard

describe("Z80 Assembler - .copper pragma: model guard", () => {
  it("rejects .copper on Spectrum 48 model", async () => {
    const opts = new AssemblerOptions();
    opts.currentModel = SpectrumModelType.Spectrum48;
    const result = await new Z80Assembler().compile(".copper halt", opts);
    expect(result.errors.map((e) => e.errorCode)).toEqual(["Z0372"]);
  });

  it("rejects .copper on Spectrum 128 model", async () => {
    const opts = new AssemblerOptions();
    opts.currentModel = SpectrumModelType.Spectrum128;
    const result = await new Z80Assembler().compile(".copper wait 1, 2", opts);
    expect(result.errors.map((e) => e.errorCode)).toEqual(["Z0372"]);
  });

  it("accepts .model next before .copper", async () => {
    const result = await new Z80Assembler().compile(".model next\n.copper halt");
    expect(result.errorCount).toBe(0);
    expect(result.segments[0].emittedCode).toEqual([0xff, 0xff]);
  });

  it("accepts the upper-case spelling", async () => {
    await compileCopper(".COPPER HALT", 0xff, 0xff);
  });
});

// ---------------------------------------------------------------------------
// Sub-commands

describe("Z80 Assembler - .copper sub-commands", () => {
  it("wait emits 1HHHHHHL LLLLLLLL, big-endian", async () => {
    // --- line 120, hpos 31: $80 | 31<<1 | 0, $78
    await compileCopper(".copper wait 120, 31", 0xbe, 0x78);
  });

  it("wait carries line bit 8 into the high byte", async () => {
    await compileCopper(".copper wait 256, 0", 0x81, 0x00);
  });

  it("wait 511, 63 is the HALT word", async () => {
    await compileCopper(".copper wait 511, 63", 0xff, 0xff);
  });

  it("wait 0, 0 is $8000", async () => {
    await compileCopper(".copper wait 0, 0", 0x80, 0x00);
  });

  it("move emits 0RRRRRRR VVVVVVVV", async () => {
    await compileCopper(".copper move $41, $FC", 0x41, 0xfc);
  });

  it("move $7F is the highest register", async () => {
    await compileCopper(".copper move $7F, 1", 0x7f, 0x01);
  });

  it("move 0 is legal and emitted as written (a NOP with a value)", async () => {
    await compileCopper(".copper move 0, $12", 0x00, 0x12);
  });

  it("move accepts a negative 8-bit value", async () => {
    await compileCopper(".copper move $40, -1", 0x40, 0xff);
  });

  it("nop emits $00 $00", async () => {
    await compileCopper(".copper nop", 0x00, 0x00);
  });

  it("halt emits $FF $FF", async () => {
    await compileCopper(".copper halt", 0xff, 0xff);
  });

  it("word emits any 16-bit word big-endian", async () => {
    await compileCopper(".copper word $1234", 0x12, 0x34);
  });

  it("sub-commands are case-insensitive", async () => {
    await compileCopper(".copper WAIT 1, 1\n.copper Move 1, 2\n.copper NOP", 0x82, 0x01, 0x01, 0x02, 0, 0);
  });

  it("a label on a .copper line names its address", async () => {
    const result = await compileNext(".org $8000\n.copper nop\nList: .copper halt\nld hl,List");
    expect(result.errorCount).toBe(0);
    expect(result.segments[0].emittedCode).toEqual([0, 0, 0xff, 0xff, 0x21, 0x02, 0x80]);
  });

  it("works inside a macro", async () => {
    await compileCopper(
      "Band: .macro(ln, col)\n.copper wait {{ln}}, 0\n.copper move $41, {{col}}\n.endm\nBand(10, $E0)",
      0x80,
      0x0a,
      0x41,
      0xe0
    );
  });
});

// ---------------------------------------------------------------------------
// Errors

describe("Z80 Assembler - .copper errors", () => {
  it("unknown sub-command raises Z0371", async () => {
    await compileCopperErrors(".copper jump 3", "Z0371");
  });

  it("Z0371 names the sub-command", async () => {
    const result = await compileNext(".copper jump 3");
    expect(result.errors[0].message).toBe("Unknown .copper sub-command: 'jump'.");
  });

  it("line 511 is legal, 512 raises Z0373", async () => {
    await compileCopper(".copper wait 511, 0", 0x81, 0xff);
    const result = await compileCopperErrors(".copper wait 512, 0", "Z0373");
    expect(result.errors[0].message).toBe("Copper WAIT line 512 is out of range (0..511).");
  });

  it("negative line raises Z0373", async () => {
    await compileCopperErrors(".copper wait -1, 0", "Z0373");
  });

  it("hpos 63 is legal, 64 raises Z0374", async () => {
    await compileCopper(".copper wait 0, 63", 0xfe, 0x00);
    const result = await compileCopperErrors(".copper wait 0, 64", "Z0374");
    expect(result.errors[0].message).toBe(
      "Copper WAIT horizontal position 64 is out of range (0..63)."
    );
  });

  it("T7: move $80 raises Z0375 and is never masked", async () => {
    const result = await compileCopperErrors(".copper move $80, 1", "Z0375");
    expect(result.errors[0].message).toBe("Copper MOVE can write only NextRegs $00..$7F, not $80.");
    expect(result.segments.length).toBe(0);
  });

  it("move value 256 raises Z0376", async () => {
    const result = await compileCopperErrors(".copper move $41, 256", "Z0376");
    expect(result.errors[0].message).toBe("Copper MOVE value 256 does not fit in 8 bits.");
  });

  it("missing second operand raises a syntax error", async () => {
    const result = await compileNext(".copper wait 10");
    expect(result.errorCount).toBeGreaterThan(0);
  });

  it("a block of 1024 instructions is legal", async () => {
    const result = await compileNext(".loop 1024\n.copper nop\n.endl");
    expect(result.errorCount).toBe(0);
    expect(result.copperBlocks.length).toBe(1);
    expect(result.copperBlocks[0].length).toBe(1024);
  });

  it("a block of 1025 instructions raises Z0377", async () => {
    const result = await compileCopperErrors(".org $8000\n.loop 1025\n.copper nop\n.endl", "Z0377");
    expect(result.errors[0].message).toBe(
      "Copper block at $8000 is 1025 instructions long; the Copper holds at most 1024."
    );
  });

  it("two blocks of 1024 split by other code are legal", async () => {
    const result = await compileNext(".loop 1024\n.copper nop\n.endl\nnop\n.loop 1024\n.copper nop\n.endl");
    expect(result.errorCount).toBe(0);
    expect(result.copperBlocks.map((b) => b.length)).toEqual([1024, 1024]);
  });
});

// ---------------------------------------------------------------------------
// Forward references (T6)

describe("Z80 Assembler - .copper forward references", () => {
  it("wait line and hpos from later .equ symbols", async () => {
    await compileCopper(".copper wait LINE, HPOS\nLINE .equ 300\nHPOS .equ 17", 0xa3, 0x2c);
  });

  it("wait with only the line forward-referenced keeps the hpos bits", async () => {
    await compileCopper(".copper wait LINE, 63\nLINE .equ 511", 0xff, 0xff);
  });

  it("wait with only the hpos forward-referenced keeps the line bits", async () => {
    await compileCopper(".copper wait 256, HPOS\nHPOS .equ 1", 0x83, 0x00);
  });

  it("move register and value from later symbols", async () => {
    await compileCopper(".copper move REG, VAL\nREG .equ $41\nVAL .equ $E0", 0x41, 0xe0);
  });

  it("word from a later label, big-endian", async () => {
    const result = await compileNext(".org $8000\n.copper word Target\nTarget: nop");
    expect(result.errorCount).toBe(0);
    expect(result.segments[0].emittedCode).toEqual([0x80, 0x02, 0x00]);
  });

  it("a forward-referenced line out of range raises Z0373", async () => {
    await compileCopperErrors(".copper wait LINE, 0\nLINE .equ 600", "Z0373");
  });

  it("a forward-referenced hpos out of range raises Z0374", async () => {
    await compileCopperErrors(".copper wait 0, HPOS\nHPOS .equ 64", "Z0374");
  });

  it("T7: a forward-referenced register $80 raises Z0375", async () => {
    await compileCopperErrors(".copper move REG, 0\nREG .equ $80", "Z0375");
  });

  it("a forward-referenced value out of range raises Z0376", async () => {
    await compileCopperErrors(".copper move $41, VAL\nVAL .equ 300", "Z0376");
  });

  it("copperBlocks records the word after the fixups", async () => {
    const result = await compileNext(".copper move REG, VAL\nREG .equ $41\nVAL .equ $E0");
    expect(result.copperBlocks[0].entries[0].word).toBe(0x41e0);
  });
});

// ---------------------------------------------------------------------------
// .savenex copper and the bare keyword

describe("Z80 Assembler - .copper and other uses of the word", () => {
  it(".savenex copper still parses", async () => {
    const result = await compileNext('.savenex copper "copper.cop"');
    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.copperFile).toBe("copper.cop");
  });

  it("copper is still usable as a label", async () => {
    const result = await compileNext(".org $8000\ncopper: .copper halt\nld hl,copper");
    expect(result.errorCount).toBe(0);
    expect(result.segments[0].emittedCode).toEqual([0xff, 0xff, 0x21, 0x00, 0x80]);
  });
});

// ---------------------------------------------------------------------------
// Debug info (D8)

describe("Z80 Assembler - .copper debug info (copperBlocks)", () => {
  it("records nothing without .copper", async () => {
    const result = await compileNext("nop\n.dw $1234");
    expect(result.copperBlocks).toEqual([]);
  });

  it("records two blocks split by other code", async () => {
    const source = [
      "  .org $8000", // 1
      "First:", // 2
      "  .copper move $40, 16", // 3
      "  .copper wait 96, 8", // 4
      "  .copper halt", // 5
      "  ld a,1", // 6
      "Second:", // 7
      "  .copper nop", // 8
      "  .copper word $1234" // 9
    ].join("\n");
    const result = await compileNext(source);
    expect(result.errorCount).toBe(0);
    expect(result.copperBlocks).toEqual([
      {
        address: 0x8000,
        length: 3,
        entries: [
          { word: 0x4010, fileIndex: 0, line: 3 },
          { word: 0x9060, fileIndex: 0, line: 4 },
          { word: 0xffff, fileIndex: 0, line: 5 }
        ]
      },
      {
        address: 0x8008,
        length: 2,
        entries: [
          { word: 0x0000, fileIndex: 0, line: 8 },
          { word: 0x1234, fileIndex: 0, line: 9 }
        ]
      }
    ]);
  });

  it("a comment or label line between .copper lines does not split a block", async () => {
    const result = await compileNext(".copper nop\n; comment\nMid:\n.copper halt");
    expect(result.copperBlocks.length).toBe(1);
    expect(result.copperBlocks[0].length).toBe(2);
  });

  it("an .org between .copper lines splits the block", async () => {
    const result = await compileNext(".org $8000\n.copper nop\n.org $9000\n.copper halt");
    expect(result.copperBlocks.map((b) => b.address)).toEqual([0x8000, 0x9000]);
  });

  it("a .db between .copper lines splits the block", async () => {
    const result = await compileNext(".copper nop\n.db 0, 0\n.copper halt");
    expect(result.copperBlocks.length).toBe(2);
  });

  it("copperBlocks is plain data that survives a structured clone", async () => {
    const result = await compileNext(".copper wait 1, 2\n.copper halt");
    const cloned = structuredClone({ ...result, addressMap: undefined }) as typeof result;
    expect(cloned.copperBlocks).toEqual(result.copperBlocks);
  });
});

// ---------------------------------------------------------------------------
// Parity with the visual tests' Cu* macros (D17)

const COPPER_DIR = path.resolve(__dirname, "../visual/copper");
const MACROS = fs.readFileSync(path.join(COPPER_DIR, "_include/copper-macros.z80asm"), "utf8");

/** The `List:` .. `ListEnd:` lines of a visual test's program. */
function listOf(caseFolder: string): string[] {
  const lines = fs.readFileSync(path.join(COPPER_DIR, caseFolder, "program.asm"), "utf8").split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === "List:");
  const end = lines.findIndex((l) => l.trim() === "ListEnd:");
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return lines.slice(start + 1, end).map((l) => l.split(";")[0].trim()).filter((l) => l);
}

/** The same list, written with `.copper` instead of the macros. */
function asCopperPragmas(list: string[]): string[] {
  return list.flatMap((line) => {
    const call = /^(\w+)\((.*)\)$/.exec(line);
    if (!call) throw new Error(`Unexpected list line: ${line}`);
    const args = call[2].split(",").map((a) => a.trim());
    switch (call[1]) {
      case "CuPalette":
        return [`.copper move $40, ${args[0]}`, `.copper move $41, ${args[1]}`];
      case "CuWait":
        return [`.copper wait ${args[0]}, ${args[1]}`];
      case "CuMove":
        return [`.copper move ${args[0]}, ${args[1]}`];
      case "CuNop":
        return [".copper nop"];
      case "CuHalt":
        return [".copper halt"];
      default:
        throw new Error(`Unexpected macro: ${call[1]}`);
    }
  });
}

describe("Z80 Assembler - .copper parity with the Cu* macros", () => {
  for (const caseFolder of ["C03-wait-hpos-staircase", "C05-upload-16bit"]) {
    it(`${caseFolder}: .copper emits the same bytes as the macros`, async () => {
      const list = listOf(caseFolder);
      const viaMacros = await compileNext(`${MACROS}\n${list.join("\n")}`);
      const viaPragmas = await compileNext(asCopperPragmas(list).join("\n"));
      expect(viaMacros.errors).toEqual([]);
      expect(viaPragmas.errors).toEqual([]);
      expect(viaMacros.segments[0].emittedCode.length).toBeGreaterThan(10);
      expect(viaPragmas.segments[0].emittedCode).toEqual(viaMacros.segments[0].emittedCode);
      // --- One block, one entry per Copper word
      expect(viaPragmas.copperBlocks.length).toBe(1);
      expect(viaPragmas.copperBlocks[0].length).toBe(viaMacros.segments[0].emittedCode.length / 2);
    });
  }
});
