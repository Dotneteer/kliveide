/**
 * Step 6.2 — Stale / empty data handling.
 *
 * Verifies that all providers degrade gracefully when:
 *   - The service has never been populated (fresh instance, empty maps).
 *   - The service is re-populated with empty intel data (e.g. after a compilation
 *     that produced no symbols).
 *   - Previously seen symbols disappear after a re-compile.
 */
import { describe, it, expect } from "vitest";
import { LanguageIntelService } from "@renderer/appIde/services/LanguageIntelService";
import {
  computeCompletionItems,
  computeHover,
  computeDefinition,
  computeReferences,
  computeDocumentSymbols
} from "@renderer/appIde/services/z80-providers";
import type { LanguageIntelData } from "@abstractions/CompilerInfo";

const EMPTY_INTEL: LanguageIntelData = {
  symbolDefinitions: [],
  symbolReferences: [],
  documentOutline: [],
  sourceFiles: []
};

const POPULATED_INTEL: LanguageIntelData = {
  symbolDefinitions: [
    { name: "OldSymbol", kind: "label", fileIndex: 0, line: 1, startColumn: 0, endColumn: 9 }
  ],
  symbolReferences: [
    { symbolName: "OldSymbol", fileIndex: 0, line: 5, startColumn: 5, endColumn: 14 }
  ],
  documentOutline: [
    { name: "OldSymbol", kind: "label", fileIndex: 0, line: 1, endLine: 20 }
  ],
  sourceFiles: [{ index: 0, filename: "/main.asm" }]
};

// ---------------------------------------------------------------------------
// Tests — fresh / empty service
// ---------------------------------------------------------------------------

describe("Stale / empty data handling (Step 6.2)", () => {
  describe("fresh service (never updated)", () => {
    it("completion returns static Z80 items (not null/crash)", () => {
      const svc = new LanguageIntelService();
      const results = computeCompletionItems("ld", undefined, svc);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.label === "ld")).toBe(true);
    });

    it("completion with '.' trigger returns pragmas only (not crash)", () => {
      const svc = new LanguageIntelService();
      const results = computeCompletionItems("", ".", svc);
      expect(results.length).toBeGreaterThan(0);
    });

    it("hover for unknown symbol returns null", () => {
      const svc = new LanguageIntelService();
      expect(computeHover("MySymbol", svc)).toBeNull();
    });

    it("hover for empty string returns null", () => {
      const svc = new LanguageIntelService();
      expect(computeHover("", svc)).toBeNull();
    });

    it("hover for built-in instruction still returns description", () => {
      const svc = new LanguageIntelService();
      const result = computeHover("ld", svc);
      expect(result).not.toBeNull();
    });

    it("definition for unknown symbol returns null", () => {
      const svc = new LanguageIntelService();
      expect(computeDefinition("MySymbol", svc)).toBeNull();
    });

    it("definition for empty string returns null", () => {
      const svc = new LanguageIntelService();
      expect(computeDefinition("", svc)).toBeNull();
    });

    it("references for unknown symbol returns empty array", () => {
      const svc = new LanguageIntelService();
      expect(computeReferences("MySymbol", false, svc)).toHaveLength(0);
    });

    it("references with includeDeclaration=true on unknown symbol returns empty array", () => {
      const svc = new LanguageIntelService();
      expect(computeReferences("MySymbol", true, svc)).toHaveLength(0);
    });

    it("document symbols for any fileIndex returns empty array", () => {
      const svc = new LanguageIntelService();
      expect(computeDocumentSymbols(0, svc)).toHaveLength(0);
      expect(computeDocumentSymbols(99, svc)).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Tests — update with explicitly empty intel data
  // ---------------------------------------------------------------------------

  describe("service updated with empty intel data", () => {
    it("definition returns null after update with empty data", () => {
      const svc = new LanguageIntelService();
      svc.update(EMPTY_INTEL);
      expect(computeDefinition("Anything", svc)).toBeNull();
    });

    it("references returns empty array after update with empty data", () => {
      const svc = new LanguageIntelService();
      svc.update(EMPTY_INTEL);
      expect(computeReferences("Anything", true, svc)).toHaveLength(0);
    });

    it("document symbols returns empty array after update with empty data", () => {
      const svc = new LanguageIntelService();
      svc.update(EMPTY_INTEL);
      expect(computeDocumentSymbols(0, svc)).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Tests — stale data cleared on re-compile
  // ---------------------------------------------------------------------------

  describe("stale data cleared on re-update", () => {
    it("previously visible symbol disappears after re-compile with empty intel", () => {
      const svc = new LanguageIntelService();
      svc.update(POPULATED_INTEL);

      // Symbol was reachable before the recompile
      expect(computeDefinition("OldSymbol", svc)).not.toBeNull();
      expect(computeReferences("OldSymbol", false, svc)).toHaveLength(1);
      expect(computeDocumentSymbols(0, svc)).toHaveLength(1);

      // Simulate a recompile that produced no symbols
      svc.update(EMPTY_INTEL);

      expect(computeDefinition("OldSymbol", svc)).toBeNull();
      expect(computeReferences("OldSymbol", false, svc)).toHaveLength(0);
      expect(computeDocumentSymbols(0, svc)).toHaveLength(0);
    });

    it("getFilePath returns undefined after data is cleared", () => {
      const svc = new LanguageIntelService();
      svc.update(POPULATED_INTEL);
      expect(svc.getFilePath(0)).toBe("/main.asm");

      svc.update(EMPTY_INTEL);
      expect(svc.getFilePath(0)).toBeUndefined();
    });

    it("new symbol appears and old one disappears after re-compile", () => {
      const svc = new LanguageIntelService();
      svc.update(POPULATED_INTEL);
      expect(computeDefinition("OldSymbol", svc)).not.toBeNull();

      const newIntel: LanguageIntelData = {
        symbolDefinitions: [
          { name: "NewSymbol", kind: "label", fileIndex: 0, line: 2, startColumn: 0, endColumn: 9 }
        ],
        symbolReferences: [],
        documentOutline: [],
        sourceFiles: [{ index: 0, filename: "/main.asm" }]
      };
      svc.update(newIntel);

      expect(computeDefinition("OldSymbol", svc)).toBeNull();
      expect(computeDefinition("NewSymbol", svc)).not.toBeNull();
    });
  });
});
