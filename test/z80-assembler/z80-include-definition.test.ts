import { describe, it, expect } from "vitest";
import { LanguageIntelService } from "@renderer/appIde/services/LanguageIntelService";
import { computeIncludeDefinition } from "@renderer/appIde/services/z80-providers";
import type { LanguageIntelData } from "@abstractions/CompilerInfo";

function makeData(sourceFiles: { index: number; filename: string }[]): LanguageIntelData {
  return { symbolDefinitions: [], symbolReferences: [], documentOutline: [], sourceFiles, lineInfo: [] };
}

function makeSvc(filenames: string[]): LanguageIntelService {
  const svc = new LanguageIntelService();
  svc.update(makeData(filenames.map((filename, index) => ({ index, filename }))));
  return svc;
}

describe("computeIncludeDefinition", () => {
  const svc = makeSvc([
    "/project/main.z80asm",
    "/project/lib/macros.z80asm",
    "/project/lib/utils.z80asm"
  ]);

  // ── Basic matching ───────────────────────────────────────────────────────

  it("returns the absolute path when cursor is on the filename (double quotes)", () => {
    const line = `#include "lib/macros.z80asm"`;
    // column 12 is inside "lib/macros.z80asm"
    expect(computeIncludeDefinition(line, 12, svc)).toBe("/project/lib/macros.z80asm");
  });

  it("returns the absolute path when cursor is on the filename (single quotes)", () => {
    const line = `#include 'lib/utils.z80asm'`;
    expect(computeIncludeDefinition(line, 12, svc)).toBe("/project/lib/utils.z80asm");
  });

  it("returns the absolute path when cursor is at the start of the filename", () => {
    // '#include "' is 10 chars; filename starts at column 11
    const line = `#include "lib/macros.z80asm"`;
    expect(computeIncludeDefinition(line, 11, svc)).toBe("/project/lib/macros.z80asm");
  });

  it("returns the absolute path when cursor is at the last char of the filename", () => {
    // '#include "lib/macros.z80asm"' — filename ends at column 28
    const line = `#include "lib/macros.z80asm"`;
    const endCol = line.indexOf('"') + 1 + "lib/macros.z80asm".length;
    expect(computeIncludeDefinition(line, endCol, svc)).toBe("/project/lib/macros.z80asm");
  });

  it("is case-insensitive for the directive keyword", () => {
    const line = `#INCLUDE "lib/macros.z80asm"`;
    expect(computeIncludeDefinition(line, 12, svc)).toBe("/project/lib/macros.z80asm");
  });

  it("works when there is leading whitespace before the directive", () => {
    const line = `    #include "lib/macros.z80asm"`;
    expect(computeIncludeDefinition(line, 16, svc)).toBe("/project/lib/macros.z80asm");
  });

  // ── Column boundary checks ───────────────────────────────────────────────

  it("returns null when cursor is on '#include' keyword, before the quote", () => {
    const line = `#include "lib/macros.z80asm"`;
    // column 3 is on 'include'
    expect(computeIncludeDefinition(line, 3, svc)).toBeNull();
  });

  it("returns null when cursor is past the closing quote", () => {
    const line = `#include "lib/macros.z80asm"`;
    const afterClose = line.length + 1; // beyond last char
    expect(computeIncludeDefinition(line, afterClose, svc)).toBeNull();
  });

  // ── Non-include lines ────────────────────────────────────────────────────

  it("returns null for a normal instruction line", () => {
    expect(computeIncludeDefinition("  ld hl, $4000", 5, svc)).toBeNull();
  });

  it("returns null for an empty line", () => {
    expect(computeIncludeDefinition("", 1, svc)).toBeNull();
  });

  it("returns null for a comment line", () => {
    expect(computeIncludeDefinition("; #include 'lib/macros.z80asm'", 5, svc)).toBeNull();
  });

  // ── Unresolved file ──────────────────────────────────────────────────────

  it("returns null when included file is not in the service's source list", () => {
    const line = `#include "nonexistent.z80asm"`;
    expect(computeIncludeDefinition(line, 12, svc)).toBeNull();
  });

  // ── Full path is clickable (not just word segments) ─────────────────────
  // Verify that columns falling on '/', '.' and digits all navigate correctly,
  // so the entire path "02_nextreg/write.asm" is one clickable unit.

  it("column on '/' within path resolves correctly", () => {
    const line = `#include "02_nextreg/write.asm"`;
    // '/' is at column: 10 (quote) + 10 (02_nextreg) + 1 (1-based) = column 21
    const slashCol = `#include "02_nextreg`.length + 1; // 1-based
    const svc2 = makeSvc(["/project/02_nextreg/write.asm"]);
    expect(computeIncludeDefinition(line, slashCol, svc2)).toBe("/project/02_nextreg/write.asm");
  });

  it("column on '.' within extension resolves correctly", () => {
    const line = `#include "02_nextreg/write.asm"`;
    const dotCol = `#include "02_nextreg/write`.length + 1; // 1-based
    const svc2 = makeSvc(["/project/02_nextreg/write.asm"]);
    expect(computeIncludeDefinition(line, dotCol, svc2)).toBe("/project/02_nextreg/write.asm");
  });

  it("column on digit at start of path segment resolves correctly", () => {
    const line = `#include "02_nextreg/write.asm"`;
    const digitCol = `#include "`.length + 1; // 1-based, pointing at '0'
    const svc2 = makeSvc(["/project/02_nextreg/write.asm"]);
    expect(computeIncludeDefinition(line, digitCol, svc2)).toBe("/project/02_nextreg/write.asm");
  });

  // ── findFileByRelativePath ───────────────────────────────────────────────

  it("findFileByRelativePath returns the absolute path for a known relative path", () => {
    expect(svc.findFileByRelativePath("lib/macros.z80asm")).toBe("/project/lib/macros.z80asm");
  });

  it("findFileByRelativePath returns undefined for an unknown path", () => {
    expect(svc.findFileByRelativePath("unknown.z80asm")).toBeUndefined();
  });

  it("findFileByRelativePath handles leading slash in relative path", () => {
    expect(svc.findFileByRelativePath("/lib/macros.z80asm")).toBe("/project/lib/macros.z80asm");
  });
});
