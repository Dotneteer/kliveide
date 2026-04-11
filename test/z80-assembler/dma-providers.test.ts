/**
 * Phase 2B — Auto-complete unit tests for the .dma pragma.
 *
 * Tests:
 *   AC-1  Z80_PRAGMA_ITEMS contains .dma with next: true
 *   AC-2  getDmaCompletionContext() correctly identifies the DMA completion phase
 *   AC-3  getDmaCompletionItems() returns the right keyword candidates per phase
 *         computeCompletionItems() returns DMA context items when lineContent matches
 */

import { describe, it, expect } from "vitest";
import {
  getDmaCompletionContext,
  getDmaCompletionItems,
  computeCompletionItems,
  type DmaCompletionContext
} from "@renderer/appIde/services/z80-providers";
import { Z80_PRAGMA_ITEMS } from "@renderer/appIde/services/z80-completion-data";
import type { ILanguageIntelService } from "@renderer/appIde/services/LanguageIntelService";

// ---------------------------------------------------------------------------
// Minimal service stub — no symbols needed for these tests
// ---------------------------------------------------------------------------

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
// AC-1: Static completion data
// ---------------------------------------------------------------------------

describe("AC-1: Z80_PRAGMA_ITEMS contains .dma", () => {
  it("contains .dma entry", () => {
    const item = Z80_PRAGMA_ITEMS.find((i) => i.label === ".dma");
    expect(item).toBeDefined();
  });

  it(".dma entry has kind 'pragma'", () => {
    const item = Z80_PRAGMA_ITEMS.find((i) => i.label === ".dma")!;
    expect(item.kind).toBe("pragma");
  });

  it(".dma entry has next: true (Next-only feature)", () => {
    const item = Z80_PRAGMA_ITEMS.find((i) => i.label === ".dma")!;
    expect(item.next).toBe(true);
  });

  it(".dma entry has a non-empty detail", () => {
    const item = Z80_PRAGMA_ITEMS.find((i) => i.label === ".dma")!;
    expect(item.detail.length).toBeGreaterThan(0);
  });

  it(".dma insertText uses snippet syntax with sub-command choices", () => {
    const item = Z80_PRAGMA_ITEMS.find((i) => i.label === ".dma")!;
    expect(item.insertText).toBeDefined();
    // Should contain at least 'wr0' and 'reset' in the choice list
    expect(item.insertText).toContain("wr0");
    expect(item.insertText).toContain("reset");
  });
});

// ---------------------------------------------------------------------------
// AC-2: getDmaCompletionContext()
// ---------------------------------------------------------------------------

describe("AC-2: getDmaCompletionContext()", () => {
  // Returns null for non-DMA lines
  it("returns null for an ordinary instruction", () => {
    expect(getDmaCompletionContext("    ld hl, 0")).toBeNull();
  });

  it("returns null for an empty line", () => {
    expect(getDmaCompletionContext("")).toBeNull();
  });

  it("returns null for a comment line", () => {
    expect(getDmaCompletionContext("; this is a comment")).toBeNull();
  });

  // subcommand phase
  it("returns subcommand phase for '.dma '", () => {
    expect(getDmaCompletionContext(".dma ")).toEqual({ phase: "subcommand" });
  });

  it("returns subcommand phase for 'dma ' (bare)", () => {
    expect(getDmaCompletionContext("    dma ")).toEqual({ phase: "subcommand" });
  });

  it("returns subcommand phase for '.DMA ' (uppercase)", () => {
    expect(getDmaCompletionContext(".DMA ")).toEqual({ phase: "subcommand" });
  });

  it("strips optional 'label: ' prefix before matching", () => {
    expect(getDmaCompletionContext("myLabel: .dma ")).toEqual({ phase: "subcommand" });
  });

  // wr0 phases
  it("returns wr0-direction after '.dma wr0 '", () => {
    expect(getDmaCompletionContext("    .dma wr0 ")).toEqual({ phase: "wr0-direction" });
  });

  it("returns wr0-transfer after '.dma wr0 a_to_b, '", () => {
    expect(getDmaCompletionContext(".dma wr0 a_to_b, ")).toEqual({ phase: "wr0-transfer" });
  });

  it("returns wr0-transfer after '.dma wr0 b_to_a, '", () => {
    expect(getDmaCompletionContext(".dma wr0 b_to_a, ")).toEqual({ phase: "wr0-transfer" });
  });

  it("returns wr0-portaaddr after '.dma wr0 a_to_b, transfer, '", () => {
    expect(getDmaCompletionContext(".dma wr0 a_to_b, transfer, ")).toEqual({ phase: "wr0-portaaddr" });
  });

  it("returns wr0-blocklen after '.dma wr0 a_to_b, transfer, 0x8000, '", () => {
    expect(getDmaCompletionContext(".dma wr0 a_to_b, transfer, 0x8000, ")).toEqual({ phase: "wr0-blocklen" });
  });

  // wr1 phases
  it("returns porttype after '.dma wr1 '", () => {
    expect(getDmaCompletionContext("    .dma wr1 ")).toEqual({ phase: "porttype" });
  });

  it("returns addrmode after '.dma wr1 memory, '", () => {
    expect(getDmaCompletionContext(".dma wr1 memory, ")).toEqual({ phase: "addrmode" });
  });

  it("returns cyclelen after '.dma wr1 memory, increment, '", () => {
    expect(getDmaCompletionContext(".dma wr1 memory, increment, ")).toEqual({ phase: "cyclelen" });
  });

  // wr2 phases
  it("returns porttype after '.dma wr2 '", () => {
    expect(getDmaCompletionContext(".dma wr2 ")).toEqual({ phase: "porttype" });
  });

  it("returns prescaler after '.dma wr2 io, fixed, 3t, '", () => {
    expect(getDmaCompletionContext(".dma wr2 io, fixed, 3t, ")).toEqual({ phase: "prescaler" });
  });

  // wr3 phases
  it("returns wr3-flags after '.dma wr3 '", () => {
    expect(getDmaCompletionContext("    .dma wr3 ")).toEqual({ phase: "wr3-flags" });
  });

  it("returns wr3-flags after '.dma wr3 dma_enable, '", () => {
    expect(getDmaCompletionContext(".dma wr3 dma_enable, ")).toEqual({ phase: "wr3-flags" });
  });

  // wr4 phases
  it("returns wr4-mode after '.dma wr4 '", () => {
    expect(getDmaCompletionContext("    .dma wr4 ")).toEqual({ phase: "wr4-mode" });
  });

  it("returns wr4-portbaddr after '.dma wr4 continuous, '", () => {
    expect(getDmaCompletionContext(".dma wr4 continuous, ")).toEqual({ phase: "wr4-portbaddr" });
  });

  // wr5 phases
  it("returns wr5-flags after '.dma wr5 '", () => {
    expect(getDmaCompletionContext("    .dma wr5 ")).toEqual({ phase: "wr5-flags" });
  });
});

// ---------------------------------------------------------------------------
// AC-3: getDmaCompletionItems()
// ---------------------------------------------------------------------------

describe("AC-3: getDmaCompletionItems()", () => {
  it("subcommand phase: returns all 13 sub-commands", () => {
    const items = getDmaCompletionItems({ phase: "subcommand" });
    expect(items.length).toBe(13);
    const labels = items.map((i) => i.label);
    for (const cmd of ["reset", "load", "enable", "disable", "continue",
                        "wr0", "wr1", "wr2", "wr3", "wr4", "wr5",
                        "readmask", "cmd"]) {
      expect(labels, `missing sub-command: ${cmd}`).toContain(cmd);
    }
  });

  it("wr0-direction phase: returns a_to_b and b_to_a", () => {
    const items = getDmaCompletionItems({ phase: "wr0-direction" });
    expect(items.map((i) => i.label)).toEqual(["a_to_b", "b_to_a"]);
  });

  it("wr0-transfer phase: returns transfer, search, search_transfer", () => {
    const items = getDmaCompletionItems({ phase: "wr0-transfer" });
    expect(items.map((i) => i.label)).toEqual(["transfer", "search", "search_transfer"]);
  });

  it("wr0-portaaddr phase: returns empty (numeric expression position)", () => {
    expect(getDmaCompletionItems({ phase: "wr0-portaaddr" })).toEqual([]);
  });

  it("wr0-blocklen phase: returns empty (numeric expression position)", () => {
    expect(getDmaCompletionItems({ phase: "wr0-blocklen" })).toEqual([]);
  });

  it("porttype phase: returns memory and io", () => {
    const items = getDmaCompletionItems({ phase: "porttype" });
    expect(items.map((i) => i.label)).toEqual(["memory", "io"]);
  });

  it("addrmode phase: returns increment, decrement, fixed", () => {
    const items = getDmaCompletionItems({ phase: "addrmode" });
    expect(items.map((i) => i.label)).toEqual(["increment", "decrement", "fixed"]);
  });

  it("cyclelen phase: returns 2t, 3t, 4t", () => {
    const items = getDmaCompletionItems({ phase: "cyclelen" });
    expect(items.map((i) => i.label)).toEqual(["2t", "3t", "4t"]);
  });

  it("prescaler phase: returns empty (numeric expression position)", () => {
    expect(getDmaCompletionItems({ phase: "prescaler" })).toEqual([]);
  });

  it("wr4-mode phase: returns byte, continuous, burst", () => {
    const items = getDmaCompletionItems({ phase: "wr4-mode" });
    expect(items.map((i) => i.label)).toEqual(["byte", "continuous", "burst"]);
  });

  it("wr4-portbaddr phase: returns empty (numeric expression position)", () => {
    expect(getDmaCompletionItems({ phase: "wr4-portbaddr" })).toEqual([]);
  });

  it("wr3-flags phase: returns dma_enable, stop_on_match, int_enable", () => {
    const items = getDmaCompletionItems({ phase: "wr3-flags" });
    expect(items.map((i) => i.label)).toEqual(["dma_enable", "stop_on_match", "int_enable"]);
  });

  it("wr5-flags phase: returns auto_restart", () => {
    const items = getDmaCompletionItems({ phase: "wr5-flags" });
    expect(items.map((i) => i.label)).toEqual(["auto_restart"]);
  });

  it("all subcommand items have non-empty detail and insertText", () => {
    for (const item of getDmaCompletionItems({ phase: "subcommand" })) {
      expect(item.detail.length, `empty detail for ${item.label}`).toBeGreaterThan(0);
      expect(item.insertText.length, `empty insertText for ${item.label}`).toBeGreaterThan(0);
    }
  });

  it("wr0 snippet item is flagged as snippet", () => {
    const wr0 = getDmaCompletionItems({ phase: "subcommand" }).find((i) => i.label === "wr0")!;
    expect(wr0.isSnippet).toBe(true);
  });

  it("reset item is not a snippet", () => {
    const reset = getDmaCompletionItems({ phase: "subcommand" }).find((i) => i.label === "reset")!;
    expect(reset.isSnippet).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeCompletionItems() integration with DMA context
// ---------------------------------------------------------------------------

describe("computeCompletionItems() with lineContent", () => {
  it("returns DMA sub-command items when lineContent is '.dma '", () => {
    const items = computeCompletionItems("", undefined, emptyService, ".dma ");
    expect(items.length).toBe(13);
    expect(items.map((i) => i.label)).toContain("reset");
    expect(items.map((i) => i.label)).toContain("wr0");
  });

  it("returns direction keywords when lineContent is '.dma wr0 '", () => {
    const items = computeCompletionItems("", undefined, emptyService, ".dma wr0 ");
    expect(items.map((i) => i.label)).toContain("a_to_b");
    expect(items.map((i) => i.label)).toContain("b_to_a");
    expect(items.length).toBe(2);
  });

  it("returns port type keywords when lineContent is '.dma wr1 '", () => {
    const items = computeCompletionItems("", undefined, emptyService, ".dma wr1 ");
    expect(items.map((i) => i.label)).toContain("memory");
    expect(items.map((i) => i.label)).toContain("io");
  });

  it("returns mode keywords when lineContent is '.dma wr4 '", () => {
    const items = computeCompletionItems("", undefined, emptyService, ".dma wr4 ");
    expect(items.map((i) => i.label)).toContain("continuous");
    expect(items.map((i) => i.label)).toContain("burst");
    expect(items.map((i) => i.label)).toContain("byte");
  });

  it("returns empty array for expression position '.dma wr0 a_to_b, transfer, '", () => {
    const items = computeCompletionItems("", undefined, emptyService, ".dma wr0 a_to_b, transfer, ");
    expect(items).toEqual([]);
  });

  it("falls through to normal completion when lineContent is unrelated", () => {
    const items = computeCompletionItems("ld", undefined, emptyService, "    ld hl");
    // Should return normal instruction completions (ld, ldi, ldd, …)
    expect(items.some((i) => i.label === "ld")).toBe(true);
  });

  it("falls through to normal completion when lineContent is undefined", () => {
    const items = computeCompletionItems(".dma", ".", emptyService, undefined);
    // Without lineContent, .dma should appear as a static pragma item
    expect(items.some((i) => i.label === ".dma")).toBe(true);
  });
});
