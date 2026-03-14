import { describe, it, expect } from "vitest";
import {
  computeSemanticTokenData,
  SEMANTIC_LEGEND_TYPES
} from "@renderer/appIde/services/z80-providers";
import type { ILanguageIntelService } from "@renderer/appIde/services/LanguageIntelService";
import type { SymbolDefinitionInfo } from "@abstractions/CompilerInfo";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Splits a template literal into lines (removes leading empty line). */
function src(text: string): string[] {
  return text.split("\n").slice(1);
}

type KindName = SymbolDefinitionInfo["kind"];

/** Build a minimal ILanguageIntelService stub with a fixed symbol table. */
function makeService(
  symbols: Array<{ name: string; kind: KindName }>
): ILanguageIntelService {
  const table = new Map<string, SymbolDefinitionInfo>();
  for (const s of symbols) {
    table.set(s.name.toLowerCase(), {
      name: s.name,
      kind: s.kind,
      fileIndex: 0,
      line: 1,
      startColumn: 1,
      endColumn: s.name.length + 1
    } as SymbolDefinitionInfo);
  }
  return {
    update: () => {},
    getSymbolAtPosition: () => null,
    getCompletionCandidates: () => [],
    getSymbolDefinition: (name) => table.get(name.toLowerCase()) ?? null,
    getSymbolReferences: () => [],
    getDocumentOutline: () => [],
    getFilePath: () => undefined,
    getFileIndex: () => undefined,
    findFileByRelativePath: () => undefined,
    getLineAddress: () => undefined
  };
}

/** Return the flat 5-tuple array for a single-line source string. */
function tokens(line: string, syms: Array<{ name: string; kind: KindName }>) {
  return computeSemanticTokenData([line], makeService(syms));
}

/** Decode the data array into human-readable token objects. */
function decode(data: number[]): Array<{ deltaLine: number; deltaCol: number; len: number; type: string; mod: number }> {
  const result = [];
  for (let i = 0; i < data.length; i += 5) {
    result.push({
      deltaLine: data[i],
      deltaCol:  data[i + 1],
      len:       data[i + 2],
      type:      SEMANTIC_LEGEND_TYPES[data[i + 3]],
      mod:       data[i + 4]
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

describe("SEMANTIC_LEGEND_TYPES", () => {
  it("contains the five expected type names", () => {
    expect(SEMANTIC_LEGEND_TYPES).toContain("variable");
    expect(SEMANTIC_LEGEND_TYPES).toContain("namespace");
    expect(SEMANTIC_LEGEND_TYPES).toContain("struct");
    expect(SEMANTIC_LEGEND_TYPES).toContain("enumMember");
    expect(SEMANTIC_LEGEND_TYPES).toContain("macro");
  });

  it("has exactly 5 entries", () => {
    expect(SEMANTIC_LEGEND_TYPES).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// Empty / no-symbol cases
// ---------------------------------------------------------------------------

describe("computeSemanticTokenData — empty / no match", () => {
  it("returns empty array for an empty source", () => {
    expect(computeSemanticTokenData([], makeService([]))).toEqual([]);
  });

  it("returns empty for a blank line", () => {
    expect(tokens("", [])).toEqual([]);
  });

  it("returns empty when no identifiers match symbols", () => {
    expect(tokens("  nop", [])).toEqual([]);
  });

  it("returns empty for a comment-only line", () => {
    expect(tokens("; MyLabel call", [{ name: "MyLabel", kind: "label" }])).toEqual([]);
  });

  it("does not match identifiers that appear only in the comment tail", () => {
    const data = tokens("  ld a, 1  ; MyLabel", [{ name: "MyLabel", kind: "label" }]);
    expect(data).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Single-token cases — one symbol per kind
// ---------------------------------------------------------------------------

describe("computeSemanticTokenData — single token per kind", () => {
  it("label → variable type (index 0)", () => {
    const data = tokens("  ld bc, MyLabel", [{ name: "MyLabel", kind: "label" }]);
    const toks = decode(data);
    expect(toks).toHaveLength(1);
    expect(toks[0].type).toBe("variable");
    expect(toks[0].len).toBe("MyLabel".length);
  });

  it("var → variable type", () => {
    const data = tokens("  ld a, (myVar)", [{ name: "myVar", kind: "var" }]);
    const toks = decode(data);
    expect(toks).toHaveLength(1);
    expect(toks[0].type).toBe("variable");
  });

  it("module → namespace type", () => {
    // Module name appears standalone (e.g. on the .module definition line)
    const data = tokens("  .module MyModule", [{ name: "MyModule", kind: "module" }]);
    const toks = decode(data);
    // ".module" keyword is not in the symbol table → 0 tokens; only "MyModule" matches
    expect(toks).toHaveLength(1);
    expect(toks[0].type).toBe("namespace");
    expect(toks[0].len).toBe("MyModule".length);
  });

  it("struct → struct type", () => {
    const data = tokens("  MyStruct .inst dw 0", [{ name: "MyStruct", kind: "struct" }]);
    const toks = decode(data);
    expect(toks).toHaveLength(1);
    expect(toks[0].type).toBe("struct");
  });

  it("equ → enumMember type", () => {
    const data = tokens("  ld hl, SCREEN_ADDR", [{ name: "SCREEN_ADDR", kind: "equ" }]);
    const toks = decode(data);
    expect(toks).toHaveLength(1);
    expect(toks[0].type).toBe("enumMember");
  });

  it("macro → macro type", () => {
    const data = tokens("  PrintString arg1, arg2", [{ name: "PrintString", kind: "macro" }]);
    const toks = decode(data);
    expect(toks).toHaveLength(1);
    expect(toks[0].type).toBe("macro");
  });

  it("proc → macro type", () => {
    const data = tokens("  call MyProc", [{ name: "MyProc", kind: "proc" }]);
    const toks = decode(data);
    expect(toks).toHaveLength(1);
    expect(toks[0].type).toBe("macro");
  });
});

// ---------------------------------------------------------------------------
// Column and count encoding
// ---------------------------------------------------------------------------

describe("computeSemanticTokenData — column computation", () => {
  it("encodes correct deltaCol for a token at column 0", () => {
    const data = tokens("MyLabel: nop", [{ name: "MyLabel", kind: "label" }]);
    expect(data[1]).toBe(0); // deltaCol
    expect(data[2]).toBe("MyLabel".length); // length
  });

  it("encodes correct deltaCol for a token after leading spaces", () => {
    const data = tokens("    MyLabel:", [{ name: "MyLabel", kind: "label" }]);
    expect(data[1]).toBe(4); // deltaCol = 4 (spaces before)
  });

  it("encodes correct length for the identifier", () => {
    const data = tokens("  SUPER_LONG_SYM", [{ name: "SUPER_LONG_SYM", kind: "equ" }]);
    expect(data[2]).toBe("SUPER_LONG_SYM".length);
  });

  it("modifier bitmask is always 0", () => {
    const data = tokens("  MyMacro arg", [{ name: "MyMacro", kind: "macro" }]);
    expect(data[4]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Multi-token and multi-line encoding
// ---------------------------------------------------------------------------

describe("computeSemanticTokenData — multiple tokens", () => {
  it("emits two tokens on the same line with correct delta columns", () => {
    const service = makeService([
      { name: "Alpha", kind: "label" },
      { name: "Beta",  kind: "equ" }
    ]);
    const data = computeSemanticTokenData(["  Alpha ld Beta"], service);
    const toks = decode(data);
    expect(toks).toHaveLength(2);
    expect(toks[0].type).toBe("variable");
    expect(toks[1].type).toBe("enumMember");
    // Second token delta line = 0, delta col relative to Alpha's start
    expect(data[5]).toBe(0); // deltaLine of second token
    expect(data[6]).toBeGreaterThan(0); // deltaCol of second token
  });

  it("emits tokens across two lines with correct delta lines", () => {
    const lines = src(`
  Alpha:
  ld a, Beta
`);
    const service = makeService([
      { name: "Alpha", kind: "label" },
      { name: "Beta",  kind: "equ" }
    ]);
    const data = computeSemanticTokenData(lines, service);
    const toks = decode(data);
    expect(toks).toHaveLength(2);
    expect(toks[0].deltaLine).toBe(0);  // first token: deltaLine from 0
    expect(toks[1].deltaLine).toBe(1);  // second token: 1 line after first
  });

  it("deltaCol resets to absolute column on a new line", () => {
    const lines = src(`
  Alpha:
    ld a, Beta
`);
    const service = makeService([
      { name: "Alpha", kind: "label" },
      { name: "Beta",  kind: "equ" }
    ]);
    const data = computeSemanticTokenData(lines, service);
    // data[6] = deltaCol of Beta (should be its column on line 2, not relative to Alpha)
    const betaLine = "    ld a, Beta";
    const betaCol = betaLine.indexOf("Beta");
    expect(data[6]).toBe(betaCol);
  });

  it("handles three symbols across three lines", () => {
    const lines = src(`
MyMacro arg1, arg2
CONST equ 42
lbl:  nop
`);
    const service = makeService([
      { name: "MyMacro", kind: "macro" },
      { name: "CONST",   kind: "equ" },
      { name: "lbl",     kind: "label" }
    ]);
    const data = computeSemanticTokenData(lines, service);
    const toks = decode(data);
    expect(toks).toHaveLength(3);
    expect(toks[0].type).toBe("macro");
    expect(toks[1].type).toBe("enumMember");
    expect(toks[2].type).toBe("variable");
    expect(toks[1].deltaLine).toBe(1);
    expect(toks[2].deltaLine).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Case-insensitive symbol lookup
// ---------------------------------------------------------------------------

describe("computeSemanticTokenData — case insensitivity", () => {
  it("matches UPPERCASE token against lowercase symbol table entry", () => {
    const service = makeService([{ name: "mylabel", kind: "label" }]);
    const data = computeSemanticTokenData(["  MYLABEL"], service);
    expect(data).toHaveLength(5);
    expect(decode(data)[0].type).toBe("variable");
  });

  it("matches mixed-case token", () => {
    const service = makeService([{ name: "MyLabel", kind: "label" }]);
    const data = computeSemanticTokenData(["  mylabel"], service);
    expect(data).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// Known non-symbol tokens (registers, instructions) produce no tokens
// ---------------------------------------------------------------------------

describe("computeSemanticTokenData — ignores non-user-symbols", () => {
  it("does not match Z80 register name 'hl' (not in symbol table)", () => {
    expect(tokens("  ld hl, 0", [])).toHaveLength(0);
  });

  it("does not match instruction 'nop'", () => {
    expect(tokens("  nop", [])).toHaveLength(0);
  });

  it("does not match pragma '.defb'", () => {
    expect(tokens("  .defb 0", [])).toHaveLength(0);
  });
});
