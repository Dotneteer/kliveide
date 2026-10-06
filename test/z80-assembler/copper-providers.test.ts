/**
 * Language-support unit tests for the .copper pragma (`.plans/COPPER_DEBUGGING_PLAN.md` §4.9).
 *
 *   AC-1  Z80_PRAGMA_ITEMS contains .copper with next: true
 *   AC-2  getCopperCompletionContext() identifies the completion phase
 *   AC-3  getCopperCompletionItems() / computeCompletionItems() offer the right candidates
 *   HV-1  copperWordOfLine() encodes literal operands exactly as the assembler does
 *   HV-2  computeCopperHover() shows the word and its decoded meaning
 */

import { describe, it, expect } from "vitest";
import {
  computeCompletionItems,
  computeCopperHover,
  copperWordOfLine,
  getCopperCompletionContext,
  getCopperCompletionItems
} from "@renderer/appIde/services/z80-providers";
import { Z80_PRAGMA_ITEMS } from "@renderer/appIde/services/z80-completion-data";
import type { ILanguageIntelService } from "@renderer/appIde/services/LanguageIntelService";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

const emptyService: ILanguageIntelService = {
  update: () => {},
  getSymbolAtPosition: () => null,
  getCompletionCandidates: () => [],
  getSymbolDefinition: () => null,
  getSymbolReferences: () => [],
  getDocumentOutline: () => [],
  getFilePath: () => undefined,
  getFileIndex: () => undefined,
  findFileByRelativePath: () => undefined,
  getLineAddress: () => undefined
};

// ---------------------------------------------------------------------------
// AC-1: static completion data
// ---------------------------------------------------------------------------

describe("AC-1: Z80_PRAGMA_ITEMS contains .copper", () => {
  const item = Z80_PRAGMA_ITEMS.find((i) => i.label === ".copper");

  it("has a .copper pragma entry", () => {
    expect(item).toBeDefined();
    expect(item!.kind).toBe("pragma");
    expect(item!.detail.length).toBeGreaterThan(0);
  });

  it("is marked Next-only", () => {
    expect(item!.next).toBe(true);
  });

  it("offers the sub-commands as a choice snippet", () => {
    expect(item!.insertText).toBe(".copper ${1|wait,move,nop,halt,word|}");
  });
});

// ---------------------------------------------------------------------------
// AC-2: completion context
// ---------------------------------------------------------------------------

describe("AC-2: getCopperCompletionContext", () => {
  it("returns null for non-.copper lines", () => {
    expect(getCopperCompletionContext("  ld a,b")).toBeNull();
    expect(getCopperCompletionContext('  .savenex copper "x.cop"')).toBeNull();
    expect(getCopperCompletionContext("  copper wait 1, 2")).toBeNull();
    expect(getCopperCompletionContext(".dma reset")).toBeNull();
  });

  it("returns null right after '.copper' (the pragma word is still being typed)", () => {
    expect(getCopperCompletionContext(".copper")).toBeNull();
  });

  it("subcommand after '.copper '", () => {
    expect(getCopperCompletionContext(".copper ")).toEqual({ phase: "subcommand" });
    expect(getCopperCompletionContext("    .COPPER wa")).toEqual({ phase: "subcommand" });
  });

  it("strips a leading label", () => {
    expect(getCopperCompletionContext("List: .copper ")).toEqual({ phase: "subcommand" });
    expect(getCopperCompletionContext("List:\t.copper move ")).toEqual({ phase: "move-reg" });
  });

  it("move-reg after 'move '", () => {
    expect(getCopperCompletionContext(".copper move ")).toEqual({ phase: "move-reg" });
  });

  it("wait-args after 'wait '", () => {
    expect(getCopperCompletionContext(".copper wait ")).toEqual({ phase: "wait-args" });
  });

  it("nothing once operands are typed", () => {
    expect(getCopperCompletionContext(".copper move $41, ")).toBeNull();
    expect(getCopperCompletionContext(".copper wait 10, ")).toBeNull();
    expect(getCopperCompletionContext(".copper halt ")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-3: completion items
// ---------------------------------------------------------------------------

describe("AC-3: getCopperCompletionItems", () => {
  it("subcommand phase offers the five sub-commands", () => {
    const labels = getCopperCompletionItems({ phase: "subcommand" }).map((i) => i.label);
    expect(labels).toEqual(["wait", "move", "nop", "halt", "word"]);
  });

  it("wait and move sub-commands are snippets", () => {
    const items = getCopperCompletionItems({ phase: "subcommand" });
    const wait = items.find((i) => i.label === "wait")!;
    expect(wait.insertText).toBe("wait ${1:line}, ${2:hpos}");
    expect(wait.isSnippet).toBe(true);
    expect(items.find((i) => i.label === "halt")!.isSnippet).toBe(false);
  });

  it("move-reg offers NextRegs $01-$7F with their descriptions", () => {
    const items = getCopperCompletionItems({ phase: "move-reg" });
    expect(items.length).toBeGreaterThan(20);
    expect(items.find((i) => i.label === "$00")).toBeUndefined();
    expect(items.every((i) => /^\$[0-7][0-9A-F]$/.test(i.label))).toBe(true);
    const palette = items.find((i) => i.label === "$41")!;
    expect(palette).toBeDefined();
    expect(palette.detail).toMatch(/palette/i);
    expect(palette.insertText).toBe("$41");
    expect(items.find((i) => i.label === "$80")).toBeUndefined();
  });

  it("wait-args offers the line, hpos snippet", () => {
    const items = getCopperCompletionItems({ phase: "wait-args" });
    expect(items).toHaveLength(1);
    expect(items[0].insertText).toBe("${1:line}, ${2:hpos}");
    expect(items[0].isSnippet).toBe(true);
  });

  it("computeCompletionItems uses the Copper context on a .copper line", () => {
    const items = computeCompletionItems("", undefined, emptyService, "  .copper move ");
    expect(items.some((i) => i.label === "$41")).toBe(true);
  });

  it("computeCompletionItems falls back to the general list elsewhere", () => {
    const items = computeCompletionItems(".cop", ".", emptyService, ".cop");
    expect(items.some((i) => i.label === ".copper")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// HV-1: copperWordOfLine
// ---------------------------------------------------------------------------

describe("HV-1: copperWordOfLine", () => {
  it("encodes each sub-command", () => {
    expect(copperWordOfLine(".copper wait 120, 31")).toBe(0xbe78);
    expect(copperWordOfLine(".copper move $41, $FC")).toBe(0x41fc);
    expect(copperWordOfLine(".copper nop")).toBe(0x0000);
    expect(copperWordOfLine(".copper halt")).toBe(0xffff);
    expect(copperWordOfLine(".copper word $1234")).toBe(0x1234);
  });

  it("reads the assembler's literal forms", () => {
    expect(copperWordOfLine(".copper move 0x41, 0FCh")).toBe(0x41fc);
    expect(copperWordOfLine(".copper move %1000001, 252")).toBe(0x41fc);
  });

  it("ignores a label and a comment", () => {
    expect(copperWordOfLine("List: .copper wait 96, 8 ; line 96, x 64")).toBe(0x9060);
  });

  it("returns undefined for symbolic or out-of-range operands", () => {
    expect(copperWordOfLine(".copper wait LINE, 8")).toBeUndefined();
    expect(copperWordOfLine(".copper move $80, 1")).toBeUndefined();
    expect(copperWordOfLine(".copper wait 512, 0")).toBeUndefined();
  });

  it("agrees with the assembler", async () => {
    const opts = new AssemblerOptions();
    opts.currentModel = SpectrumModelType.Next;
    const lines = [
      ".copper wait 0, 0",
      ".copper wait 511, 63",
      ".copper wait 300, 17",
      ".copper move $7F, $80",
      ".copper move 0, $12",
      ".copper move $40, -1",
      ".copper word $ABCD"
    ];
    for (const line of lines) {
      const result = await new Z80Assembler().compile(line, opts);
      const [hi, lo] = result.segments[0].emittedCode;
      expect(copperWordOfLine(line), line).toBe((hi << 8) | lo);
    }
  });
});

// ---------------------------------------------------------------------------
// HV-2: computeCopperHover
// ---------------------------------------------------------------------------

describe("HV-2: computeCopperHover", () => {
  it("returns null for other lines", () => {
    expect(computeCopperHover("  ld a,b")).toBeNull();
    expect(computeCopperHover('  .savenex copper "x.cop"')).toBeNull();
  });

  it("WAIT shows the word, the line and the paper x", () => {
    const hover = computeCopperHover("  .copper wait 120, 31");
    expect(hover!.contents[0]).toContain("$BE78");
    expect(hover!.contents[0]).toContain("WAIT line 120, x 248");
    expect(hover!.contents[1]).toContain("hc 260");
  });

  it("MOVE shows the NextReg description", () => {
    const hover = computeCopperHover("  .copper move $41, $FC");
    expect(hover!.contents[0]).toContain("$41FC");
    expect(hover!.contents[0]).toContain("MOVE $41, $FC");
    expect(hover!.contents[1]).toMatch(/palette/i);
    expect(hover!.contents[1]).toContain("$FC");
  });

  it("MOVE 0 shows a NOP with the ignored value", () => {
    const hover = computeCopperHover(".copper move 0, $12");
    expect(hover!.contents[0]).toContain("$0012");
    expect(hover!.contents[1]).toContain("ignored");
  });

  it("HALT names the WAIT idiom", () => {
    const hover = computeCopperHover(".copper halt");
    expect(hover!.contents[0]).toContain("$FFFF");
    expect(hover!.contents[0]).toContain("WAIT 511, 63");
  });

  it("symbolic operands fall back to the compiled bytes", () => {
    expect(computeCopperHover(".copper wait LINE, 8")).toBeNull();
    const hover = computeCopperHover(".copper wait LINE, 8", [0x90, 0x60]);
    expect(hover!.contents[0]).toContain("$9060");
    expect(hover!.contents[0]).toContain("WAIT line 96, x 64");
  });

  it("literal operands win over stale compiled bytes", () => {
    const hover = computeCopperHover(".copper halt", [0x00, 0x00]);
    expect(hover!.contents[0]).toContain("$FFFF");
  });
});
