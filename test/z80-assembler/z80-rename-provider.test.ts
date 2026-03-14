import { describe, it, expect, beforeEach } from "vitest";
import { LanguageIntelService } from "@renderer/appIde/services/LanguageIntelService";
import { computeRenameEdits, computeRenameValidation } from "@renderer/appIde/services/z80-providers";
import type { LanguageIntelData, SymbolDefinitionInfo, SymbolReferenceInfo } from "@abstractions/CompilerInfo";

function makeSym(partial: Partial<SymbolDefinitionInfo> & { name: string }): SymbolDefinitionInfo {
  return { kind: "label", fileIndex: 0, line: 5, startColumn: 0, endColumn: partial.name.length, ...partial };
}

function makeRef(partial: Partial<SymbolReferenceInfo> & { symbolName: string }): SymbolReferenceInfo {
  return { fileIndex: 0, line: 10, startColumn: 5, endColumn: 5 + partial.symbolName.length, ...partial };
}

function makeData(
  syms: SymbolDefinitionInfo[] = [],
  refs: SymbolReferenceInfo[] = []
): LanguageIntelData {
  return {
    symbolDefinitions: syms,
    symbolReferences: refs,
    documentOutline: [],
    sourceFiles: [
      { index: 0, filename: "/project/main.asm" },
      { index: 1, filename: "/project/lib.asm" }
    ],
    lineInfo: []
  };
}

// ---------------------------------------------------------------------------
// computeRenameValidation
// ---------------------------------------------------------------------------

describe("computeRenameValidation", () => {
  let svc: LanguageIntelService;

  beforeEach(() => {
    svc = new LanguageIntelService();
    svc.update(makeData([
      makeSym({ name: "Entry",    line: 5,  startColumn: 0, endColumn: 5 }),
      makeSym({ name: "MAXVAL",   kind: "equ", line: 2, startColumn: 0, endColumn: 6 }),
      makeSym({ name: "MyMacro",  kind: "macro", line: 10, startColumn: 0, endColumn: 7 }),
      makeSym({ name: "MyStruct", kind: "struct", line: 20, startColumn: 0, endColumn: 8 }),
    ]));
  });

  it("returns symbol info for a known label", () => {
    const result = computeRenameValidation("Entry", svc);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("Entry");  // original case preserved
  });

  it("returns symbol info for an .equ symbol", () => {
    const result = computeRenameValidation("MAXVAL", svc);
    expect(result).not.toBeNull();
  });

  it("returns symbol info for a macro", () => {
    const result = computeRenameValidation("MyMacro", svc);
    expect(result).not.toBeNull();
  });

  it("returns symbol info for a struct", () => {
    const result = computeRenameValidation("MyStruct", svc);
    expect(result).not.toBeNull();
  });

  it("returns null for an instruction mnemonic", () => {
    expect(computeRenameValidation("nop", svc)).toBeNull();
    expect(computeRenameValidation("ld", svc)).toBeNull();
    expect(computeRenameValidation("call", svc)).toBeNull();
  });

  it("returns null for a register name", () => {
    expect(computeRenameValidation("a", svc)).toBeNull();
    expect(computeRenameValidation("hl", svc)).toBeNull();
    expect(computeRenameValidation("ix", svc)).toBeNull();
  });

  it("returns null for an unknown symbol", () => {
    expect(computeRenameValidation("NonExistent", svc)).toBeNull();
  });

  it("returns null for an empty word", () => {
    expect(computeRenameValidation("", svc)).toBeNull();
  });

  it("lookup is case-insensitive", () => {
    expect(computeRenameValidation("entry", svc)).not.toBeNull();
    expect(computeRenameValidation("ENTRY", svc)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeRenameEdits
// ---------------------------------------------------------------------------

describe("computeRenameEdits", () => {
  let svc: LanguageIntelService;

  beforeEach(() => {
    svc = new LanguageIntelService();
    svc.update(makeData(
      [
        makeSym({ name: "MyLabel", line: 5, startColumn: 0, endColumn: 7, fileIndex: 0 }),
        makeSym({ name: "Other",   line: 50, startColumn: 0, endColumn: 5, fileIndex: 0 })
      ],
      [
        makeRef({ symbolName: "mylabel", line: 10, startColumn: 4, endColumn: 11, fileIndex: 0 }),
        makeRef({ symbolName: "mylabel", line: 20, startColumn: 8, endColumn: 15, fileIndex: 0 }),
        makeRef({ symbolName: "other",   line: 30, startColumn: 4, endColumn: 9, fileIndex: 0 })
      ]
    ));
  });

  it("returns edits for the definition and all references", () => {
    const edits = computeRenameEdits("MyLabel", "NewLabel", svc);
    expect(edits.length).toBe(3);
    // Definition
    expect(edits[0]).toEqual({
      filePath: "/project/main.asm",
      line: 5,
      startColumn: 0,
      endColumn: 7,
      newText: "NewLabel"
    });
    // References
    expect(edits[1].line).toBe(10);
    expect(edits[1].newText).toBe("NewLabel");
    expect(edits[2].line).toBe(20);
    expect(edits[2].newText).toBe("NewLabel");
  });

  it("all edits use the new name", () => {
    const edits = computeRenameEdits("MyLabel", "Renamed", svc);
    for (const e of edits) {
      expect(e.newText).toBe("Renamed");
    }
  });

  it("works for a symbol with a single reference", () => {
    const edits = computeRenameEdits("Other", "Changed", svc);
    expect(edits.length).toBe(2); // definition + 1 reference
    expect(edits[0].line).toBe(50);
    expect(edits[1].line).toBe(30);
  });

  it("works for a symbol with no references (definition only)", () => {
    svc.update(makeData(
      [makeSym({ name: "Lone", line: 99, startColumn: 0, endColumn: 4 })],
      []
    ));
    const edits = computeRenameEdits("Lone", "Solo", svc);
    expect(edits.length).toBe(1);
    expect(edits[0].line).toBe(99);
    expect(edits[0].newText).toBe("Solo");
  });

  it("lookup is case-insensitive", () => {
    expect(computeRenameEdits("mylabel", "X", svc).length).toBe(3);
    expect(computeRenameEdits("MYLABEL", "X", svc).length).toBe(3);
  });

  it("handles cross-file symbols", () => {
    svc.update(makeData(
      [makeSym({ name: "LibFn", line: 3, startColumn: 0, endColumn: 5, fileIndex: 1 })],
      [
        makeRef({ symbolName: "libfn", line: 8,  startColumn: 4, endColumn: 9, fileIndex: 0 }),
        makeRef({ symbolName: "libfn", line: 22, startColumn: 4, endColumn: 9, fileIndex: 1 })
      ]
    ));
    const edits = computeRenameEdits("LibFn", "NewFn", svc);
    expect(edits.length).toBe(3);
    const paths = edits.map((e) => e.filePath);
    expect(paths).toContain("/project/lib.asm");
    expect(paths).toContain("/project/main.asm");
  });

  it("returns empty array for unknown symbol", () => {
    expect(computeRenameEdits("NoSuch", "X", svc)).toEqual([]);
  });

  it("returns empty array for instruction mnemonic", () => {
    expect(computeRenameEdits("nop", "X", svc)).toEqual([]);
    expect(computeRenameEdits("ld", "X", svc)).toEqual([]);
  });

  it("returns empty array for register name", () => {
    expect(computeRenameEdits("a", "X", svc)).toEqual([]);
    expect(computeRenameEdits("hl", "X", svc)).toEqual([]);
  });

  it("returns empty array for empty old name", () => {
    expect(computeRenameEdits("", "X", svc)).toEqual([]);
  });

  it("returns empty array for empty new name", () => {
    expect(computeRenameEdits("MyLabel", "", svc)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Integration: rename with compiler output
// ---------------------------------------------------------------------------

import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { extractLanguageIntelData } from "@main/compiler-integration/extractIntelData";
import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";

describe("computeRenameEdits (integration with compiler)", () => {
  it("renames a label at definition and all usage sites", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
Start:
    ld a,5
    jp Start
    call Start
    nop
`);
    expect(output.errorCount).toBe(0);

    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);
    const svc = new LanguageIntelService();
    svc.update(intel);

    const edits = computeRenameEdits("Start", "Begin", svc);
    // 1 definition + 2 references (jp Start, call Start)
    expect(edits.length).toBe(3);
    for (const e of edits) {
      expect(e.newText).toBe("Begin");
    }
  });

  it("renames a macro at definition and invocation sites", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
Delay: .macro(wait)
    ld b,{{wait}}
DelayLoop:
    djnz DelayLoop
    .endm
    Delay(10)
    Delay(20)
    nop
`);
    expect(output.errorCount).toBe(0);

    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);
    const svc = new LanguageIntelService();
    svc.update(intel);

    const edits = computeRenameEdits("Delay", "Wait", svc);
    // 1 definition + 2 invocations
    expect(edits.length).toBe(3);
    for (const e of edits) {
      expect(e.newText).toBe("Wait");
    }
  });

  it("renames an .equ symbol at definition and usage", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
BorderColor .equ 4
    ld a,BorderColor
    out (#fe),a
`);
    expect(output.errorCount).toBe(0);

    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);
    const svc = new LanguageIntelService();
    svc.update(intel);

    const edits = computeRenameEdits("BorderColor", "BorderClr", svc);
    // 1 definition + 1 usage in ld a,BorderColor
    expect(edits.length).toBe(2);
    for (const e of edits) {
      expect(e.newText).toBe("BorderClr");
    }
  });

  it("rejects renaming an instruction mnemonic", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
    nop
`);
    expect(output.errorCount).toBe(0);

    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);
    const svc = new LanguageIntelService();
    svc.update(intel);

    const validation = computeRenameValidation("nop", svc);
    expect(validation).toBeNull();
    const edits = computeRenameEdits("nop", "newop", svc);
    expect(edits).toEqual([]);
  });
});
