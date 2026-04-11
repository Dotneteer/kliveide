/**
 * Phase 2A — Syntax highlighting unit tests for the .dma pragma.
 *
 * These tests validate the structure of the Monaco Monarch language definition
 * exported by `asmKz80LanguageProvider` — specifically:
 *   SH-1  The `pragmas` word list contains all four .dma variants.
 *   SH-2  The tokenizer contains a `dmaSubcmd` state with a sub-command rule.
 *   SH-3  The tokenizer contains a `dmaParams` state with a parameter keyword rule.
 *
 * No browser or Monaco runtime is needed — the definition is a plain JS object.
 */

import { describe, it, expect } from "vitest";
import { asmKz80LanguageProvider } from "@renderer/appIde/project/asmKz80LangaugeProvider";

// Cast to any so we can inspect the language definition internals without
// needing the full MonacoAwareCustomLanguageInfo type to be re-exported.
const langDef = asmKz80LanguageProvider.languageDef as any;

// ---------------------------------------------------------------------------
// SH-1: .dma entries in the pragmas word list
// ---------------------------------------------------------------------------

describe("SH-1: pragmas word list contains .dma entries", () => {
  it("contains '.dma' (dot-lowercase)", () => {
    expect(langDef.pragmas).toContain(".dma");
  });

  it("contains '.DMA' (dot-uppercase)", () => {
    expect(langDef.pragmas).toContain(".DMA");
  });

  it("contains 'dma' (bare lowercase)", () => {
    expect(langDef.pragmas).toContain("dma");
  });

  it("contains 'DMA' (bare uppercase)", () => {
    expect(langDef.pragmas).toContain("DMA");
  });

  it("still contains .savenex entries after insertion", () => {
    expect(langDef.pragmas).toContain(".savenex");
    expect(langDef.pragmas).toContain("savenex");
  });
});

// ---------------------------------------------------------------------------
// SH-2: dmaSubcmd tokenizer state
// ---------------------------------------------------------------------------

describe("SH-2: dmaSubcmd tokenizer state", () => {
  const state: any[] | undefined = langDef.tokenizer?.dmaSubcmd;

  it("dmaSubcmd state exists", () => {
    expect(state).toBeDefined();
    expect(Array.isArray(state)).toBe(true);
  });

  it("contains a rule matching 'wr0'", () => {
    const rule = state?.find(
      (r: any) => Array.isArray(r) && r[0] instanceof RegExp && r[0].test("wr0")
    );
    expect(rule, "no rule matching 'wr0'").toBeDefined();
  });

  it("matches all wr0-wr5 sub-commands", () => {
    const rule = state?.find(
      (r: any) => Array.isArray(r) && r[0] instanceof RegExp && r[0].test("wr0")
    );
    const re: RegExp = rule[0];
    for (const cmd of ["wr0", "wr1", "wr2", "wr3", "wr4", "wr5"]) {
      expect(re.test(cmd), `dmaSubcmd regex should match '${cmd}'`).toBe(true);
    }
  });

  it("matches simple command keywords", () => {
    const rule = state?.find(
      (r: any) => Array.isArray(r) && r[0] instanceof RegExp && r[0].test("reset")
    );
    const re: RegExp = rule[0];
    for (const cmd of ["reset", "load", "enable", "disable", "continue", "readmask", "cmd"]) {
      expect(re.test(cmd), `dmaSubcmd regex should match '${cmd}'`).toBe(true);
    }
  });

  it("rule token is 'statement'", () => {
    const rule = state?.find(
      (r: any) => Array.isArray(r) && r[0] instanceof RegExp && r[0].test("wr0")
    );
    // token can be a string or { token: string, ... }
    const token = typeof rule[1] === "string" ? rule[1] : rule[1]?.token;
    expect(token).toBe("statement");
  });
});

