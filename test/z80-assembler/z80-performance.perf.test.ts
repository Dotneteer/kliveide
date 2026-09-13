/**
 * Step 6.3 — Performance tests.
 *
 * Verifies that LanguageIntelService and the provider compute functions remain
 * fast even with large symbol tables (10,000+ symbols).  All thresholds are
 * conservative so they pass reliably on CI.
 */
import { describe, it, expect } from "vitest";
import { LanguageIntelService } from "@renderer/appIde/services/LanguageIntelService";
import {
  computeCompletionItems,
  computeDefinition,
  computeReferences,
  computeDocumentSymbols
} from "@renderer/appIde/services/z80-providers";
import type { LanguageIntelData } from "@abstractions/CompilerInfo";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLargeIntelData(symbolCount: number): LanguageIntelData {
  return {
    symbolDefinitions: Array.from({ length: symbolCount }, (_, i) => ({
      name: `Symbol_${i.toString().padStart(6, "0")}`,
      kind: "label" as const,
      fileIndex: 0,
      line: i + 1,
      startColumn: 0,
      endColumn: 12
    })),
    symbolReferences: Array.from({ length: symbolCount }, (_, i) => ({
      symbolName: `Symbol_${i.toString().padStart(6, "0")}`,
      fileIndex: 0,
      line: symbolCount + i + 1,
      startColumn: 5,
      endColumn: 17
    })),
    documentOutline: Array.from({ length: Math.min(symbolCount, 1000) }, (_, i) => ({
      name: `Symbol_${i.toString().padStart(6, "0")}`,
      kind: "label" as const,
      fileIndex: 0,
      line: i + 1,
      endLine: i + 2
    })),
    sourceFiles: [{ index: 0, filename: "/main.asm" }]
  };
}

function populatedService(symbolCount: number): LanguageIntelService {
  const svc = new LanguageIntelService();
  svc.update(makeLargeIntelData(symbolCount));
  return svc;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Performance (Step 6.3)", () => {
  describe("indexing speed", () => {
    it("indexes 10,000 symbols in < 500ms", () => {
      const data = makeLargeIntelData(10_000);
      const svc = new LanguageIntelService();
      const t0 = performance.now();
      svc.update(data);
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(500);
    });

    it("re-indexes (clears + rebuilds) 10,000 symbols in < 500ms", () => {
      const svc = populatedService(10_000);
      const data = makeLargeIntelData(10_000);
      const t0 = performance.now();
      svc.update(data);
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe("query speed", () => {
    it("getSymbolDefinition (Map lookup) for 1,000 lookups < 20ms", () => {
      const svc = populatedService(10_000);
      const t0 = performance.now();
      for (let i = 0; i < 1_000; i++) {
        svc.getSymbolDefinition("Symbol_005000");
      }
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(20);
    });

    it("computeDefinition for 1,000 calls < 20ms", () => {
      const svc = populatedService(10_000);
      const t0 = performance.now();
      for (let i = 0; i < 1_000; i++) {
        computeDefinition("Symbol_005000", svc);
      }
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(20);
    });

    it("computeReferences for 500 calls < 50ms", () => {
      const svc = populatedService(10_000);
      const t0 = performance.now();
      for (let i = 0; i < 500; i++) {
        computeReferences("Symbol_005000", false, svc);
      }
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(50);
    });

    it("computeCompletionItems prefix search across 10,000 symbols < 200ms per call", () => {
      const svc = populatedService(10_000);
      // "symbol_0" matches half the table (Symbol_000000 – Symbol_009999)
      const t0 = performance.now();
      computeCompletionItems("symbol_0", undefined, svc);
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(200);
    });

    it("computeDocumentSymbols for 1,000-entry outline < 100ms", () => {
      const svc = populatedService(10_000); // outline capped at 1,000 by helper
      const t0 = performance.now();
      computeDocumentSymbols(0, svc);
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe("memory / correctness with large data", () => {
    it("correctly finds a symbol near the end of a 10,000-symbol table", () => {
      const svc = populatedService(10_000);
      const result = computeDefinition("Symbol_009999", svc);
      expect(result).not.toBeNull();
      expect(result!.line).toBe(10_000);
    });

    it("returns null for a name not in the 10,000-symbol table", () => {
      const svc = populatedService(10_000);
      expect(computeDefinition("NonExistent", svc)).toBeNull();
    });

    it("case-insensitive lookup still works in large table", () => {
      const svc = populatedService(10_000);
      const lower = computeDefinition("symbol_005000", svc);
      const upper = computeDefinition("SYMBOL_005000", svc);
      expect(lower).not.toBeNull();
      expect(upper).not.toBeNull();
      expect(lower!.line).toBe(upper!.line);
    });
  });
});
