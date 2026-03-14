/**
 * Step 6.1 — Multi-file provider tests.
 *
 * Verifies that go-to-definition, hover, and find-references correctly resolve
 * symbols defined in included files (fileIndex > 0).
 */
import { describe, it, expect } from "vitest";
import { LanguageIntelService } from "@renderer/appIde/services/LanguageIntelService";
import {
  computeDefinition,
  computeHover,
  computeReferences
} from "@renderer/appIde/services/z80-providers";
import type { LanguageIntelData } from "@abstractions/CompilerInfo";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMultiFileService(): LanguageIntelService {
  const data: LanguageIntelData = {
    symbolDefinitions: [
      { name: "MainLabel",    kind: "label", fileIndex: 0, line: 5,  startColumn: 0, endColumn: 9  },
      { name: "UtilRoutine", kind: "label", fileIndex: 1, line: 10, startColumn: 0, endColumn: 11 },
      { name: "LibConst",    kind: "equ",   fileIndex: 2, line: 3,  startColumn: 0, endColumn: 8, description: "= $4000" }
    ],
    symbolReferences: [
      { symbolName: "UtilRoutine", fileIndex: 0, line: 20, startColumn: 5, endColumn: 16 },
      { symbolName: "UtilRoutine", fileIndex: 0, line: 35, startColumn: 5, endColumn: 16 },
      { symbolName: "LibConst",    fileIndex: 1, line: 12, startColumn: 8, endColumn: 16 }
    ],
    documentOutline: [],
    sourceFiles: [
      { index: 0, filename: "/project/main.kz80.asm"  },
      { index: 1, filename: "/project/utils.kz80.asm" },
      { index: 2, filename: "/project/lib/const.kz80.asm" }
    ]
  };
  const svc = new LanguageIntelService();
  svc.update(data);
  return svc;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Multi-file providers (Step 6.1)", () => {
  describe("computeDefinition — cross-file resolution", () => {
    it("resolves symbol defined in the main file", () => {
      const svc = makeMultiFileService();
      const result = computeDefinition("MainLabel", svc);
      expect(result).not.toBeNull();
      expect(result!.filePath).toBe("/project/main.kz80.asm");
      expect(result!.line).toBe(5);
    });

    it("resolves symbol defined in an included file (fileIndex 1)", () => {
      const svc = makeMultiFileService();
      const result = computeDefinition("UtilRoutine", svc);
      expect(result).not.toBeNull();
      expect(result!.filePath).toBe("/project/utils.kz80.asm");
      expect(result!.line).toBe(10);
    });

    it("resolves symbol defined in a deeply nested included file (fileIndex 2)", () => {
      const svc = makeMultiFileService();
      const result = computeDefinition("LibConst", svc);
      expect(result).not.toBeNull();
      expect(result!.filePath).toBe("/project/lib/const.kz80.asm");
      expect(result!.line).toBe(3);
    });

    it("returns null for a symbol whose fileIndex has no matching source file", () => {
      const data: LanguageIntelData = {
        symbolDefinitions: [
          { name: "Orphan", kind: "label", fileIndex: 99, line: 1, startColumn: 0, endColumn: 6 }
        ],
        symbolReferences: [],
        documentOutline: [],
        sourceFiles: [] // fileIndex 99 is not listed
      };
      const svc = new LanguageIntelService();
      svc.update(data);
      expect(computeDefinition("Orphan", svc)).toBeNull();
    });
  });

  describe("computeReferences — cross-file references", () => {
    it("returns references in the main file for a symbol defined in an included file", () => {
      const svc = makeMultiFileService();
      const refs = computeReferences("UtilRoutine", false, svc);
      expect(refs).toHaveLength(2);
      expect(refs.every((r) => r.filePath === "/project/main.kz80.asm")).toBe(true);
      expect(refs.map((r) => r.line)).toEqual([20, 35]);
    });

    it("includes declaration (from included file) when includeDeclaration=true", () => {
      const svc = makeMultiFileService();
      const refs = computeReferences("UtilRoutine", true, svc);
      expect(refs).toHaveLength(3);
      // First entry is the definition site (utils.kz80.asm line 10)
      expect(refs[0].filePath).toBe("/project/utils.kz80.asm");
      expect(refs[0].line).toBe(10);
      // Following entries are the usage sites
      expect(refs[1].filePath).toBe("/project/main.kz80.asm");
      expect(refs[2].filePath).toBe("/project/main.kz80.asm");
    });

    it("resolves cross-included-file reference (lib/const used in utils)", () => {
      const svc = makeMultiFileService();
      const refs = computeReferences("LibConst", false, svc);
      expect(refs).toHaveLength(1);
      expect(refs[0].filePath).toBe("/project/utils.kz80.asm");
      expect(refs[0].line).toBe(12);
    });

    it("skips references whose fileIndex has no path", () => {
      const data: LanguageIntelData = {
        symbolDefinitions: [
          { name: "Target", kind: "label", fileIndex: 0, line: 1, startColumn: 0, endColumn: 6 }
        ],
        symbolReferences: [
          { symbolName: "Target", fileIndex: 0,  line: 5,  startColumn: 0, endColumn: 6 },
          { symbolName: "Target", fileIndex: 99, line: 10, startColumn: 0, endColumn: 6 } // 99 has no path
        ],
        documentOutline: [],
        sourceFiles: [{ index: 0, filename: "/main.asm" }]
      };
      const svc = new LanguageIntelService();
      svc.update(data);
      const refs = computeReferences("Target", false, svc);
      expect(refs).toHaveLength(1); // the orphan reference is silently skipped
      expect(refs[0].line).toBe(5);
    });
  });

  describe("computeHover — cross-file symbol info", () => {
    it("hover shows the included filename for a cross-file symbol", () => {
      const svc = makeMultiFileService();
      const result = computeHover("UtilRoutine", svc);
      expect(result).not.toBeNull();
      expect(result!.contents.some((c) => c.includes("utils.kz80.asm"))).toBe(true);
    });

    it("hover shows the deeply nested filename", () => {
      const svc = makeMultiFileService();
      const result = computeHover("LibConst", svc);
      expect(result).not.toBeNull();
      expect(result!.contents.some((c) => c.includes("const.kz80.asm"))).toBe(true);
    });
  });
});
