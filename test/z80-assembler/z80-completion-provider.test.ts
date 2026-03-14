import { describe, it, expect, beforeEach } from "vitest";
import { LanguageIntelService } from "@renderer/appIde/services/LanguageIntelService";
import { computeCompletionItems, CIK } from "@renderer/appIde/services/z80-providers";
import type { LanguageIntelData, SymbolDefinitionInfo } from "@abstractions/CompilerInfo";

function makeSym(partial: Partial<SymbolDefinitionInfo> & { name: string }): SymbolDefinitionInfo {
  return { kind: "label", fileIndex: 0, line: 1, startColumn: 0, endColumn: partial.name.length, ...partial };
}

function makeData(syms: SymbolDefinitionInfo[] = []): LanguageIntelData {
  return { symbolDefinitions: syms, symbolReferences: [], documentOutline: [], sourceFiles: [], lineInfo: [] };
}

describe("computeCompletionItems", () => {
  let svc: LanguageIntelService;

  beforeEach(() => {
    svc = new LanguageIntelService();
    svc.update(makeData([
      makeSym({ name: "Main" }),
      makeSym({ name: "MainLoop", kind: "label" }),
      makeSym({ name: "Counter", kind: "var" }),
      makeSym({ name: "SCREEN", kind: "equ", value: 0x4000, description: "= $4000" }),
      makeSym({ name: "PrintChar", kind: "macro" }),
      makeSym({ name: "Point", kind: "struct" }),
      makeSym({ name: "Utils", kind: "module" }),
    ]));
  });

  // --- Static items in results
  it("includes static instruction items when no trigger", () => {
    const results = computeCompletionItems("no", undefined, svc);
    const labels = results.map((r) => r.label);
    expect(labels).toContain("nop");
  });

  it("includes matching instructions for a prefix", () => {
    const results = computeCompletionItems("ld", undefined, svc);
    const labels = results.map((r) => r.label);
    expect(labels).toContain("ld");
    expect(labels).toContain("ldi");
    expect(labels).toContain("ldir");
  });

  it("includes register items in results", () => {
    const results = computeCompletionItems("h", undefined, svc);
    const labels = results.map((r) => r.label);
    expect(labels).toContain("hl");
    expect(labels).toContain("h");
  });

  // --- Dynamic symbol items
  it("includes dynamic symbol completions for a matching prefix", () => {
    const results = computeCompletionItems("ma", undefined, svc);
    const labels = results.map((r) => r.label);
    expect(labels).toContain("Main");
    expect(labels).toContain("MainLoop");
  });

  it("does not include symbols that do not match the prefix", () => {
    const results = computeCompletionItems("ma", undefined, svc);
    const labels = results.map((r) => r.label);
    expect(labels).not.toContain("Counter");
    expect(labels).not.toContain("SCREEN");
  });

  it("returns all static and dynamic items for empty prefix", () => {
    const results = computeCompletionItems("", undefined, svc);
    const labels = results.map((r) => r.label);
    // Should include static items
    expect(labels).toContain("nop");
    expect(labels).toContain("ld");
    // And all dynamic symbols
    expect(labels).toContain("Main");
    expect(labels).toContain("Counter");
  });

  // --- Kind mapping
  it("instructions get keyword kind", () => {
    const results = computeCompletionItems("nop", undefined, svc);
    const item = results.find((r) => r.label === "nop");
    expect(item).toBeDefined();
    expect(item!.kind).toBe(CIK.Keyword);
  });

  it("register items get variable kind", () => {
    const results = computeCompletionItems("a", undefined, svc);
    const item = results.find((r) => r.label === "a");
    expect(item).toBeDefined();
    expect(item!.kind).toBe(CIK.Variable);
  });

  it("symbol with kind=var gets variable kind", () => {
    const results = computeCompletionItems("cou", undefined, svc);
    const item = results.find((r) => r.label === "Counter");
    expect(item).toBeDefined();
    expect(item!.kind).toBe(CIK.Variable);
  });

  it("symbol with kind=macro gets function kind", () => {
    const results = computeCompletionItems("p", undefined, svc);
    const item = results.find((r) => r.label === "PrintChar");
    expect(item).toBeDefined();
    expect(item!.kind).toBe(CIK.Function);
  });

  it("symbol with kind=struct gets struct kind", () => {
    const results = computeCompletionItems("poi", undefined, svc);
    const item = results.find((r) => r.label === "Point");
    expect(item).toBeDefined();
    expect(item!.kind).toBe(CIK.Struct);
  });

  it("symbol with kind=module gets module kind", () => {
    const results = computeCompletionItems("ut", undefined, svc);
    const item = results.find((r) => r.label === "Utils");
    expect(item).toBeDefined();
    expect(item!.kind).toBe(CIK.Module);
  });

  it("symbol with kind=equ gets constant kind", () => {
    const results = computeCompletionItems("scr", undefined, svc);
    const item = results.find((r) => r.label === "SCREEN");
    expect(item).toBeDefined();
    expect(item!.kind).toBe(CIK.Constant);
  });

  // --- Trigger character: "." → only pragmas and keywords
  it("trigger '.' returns only pragmas and keywords", () => {
    const results = computeCompletionItems("", ".", svc);
    const labels = results.map((r) => r.label);
    // Instructions should NOT be present
    expect(labels).not.toContain("nop");
    expect(labels).not.toContain("ld");
    // Pragmas and keywords should be present
    expect(labels).toContain(".org");
    expect(labels).toContain(".db");
    expect(labels).toContain(".macro");
  });

  it("trigger '#' returns only directives", () => {
    const results = computeCompletionItems("", "#", svc);
    const labels = results.map((r) => r.label);
    expect(labels).toContain("#ifdef");
    expect(labels).toContain("#include");
    expect(labels).not.toContain("nop");
    expect(labels).not.toContain(".org");
  });

  // --- Insert text / snippet
  it("items with placeholders are marked as snippets", () => {
    const results = computeCompletionItems("ld", undefined, svc);
    const ld = results.find((r) => r.label === "ld");
    expect(ld).toBeDefined();
    expect(ld!.isSnippet).toBe(true);
    expect(ld!.insertText).toContain("$");
  });

  it("items without insert text use label as insertText", () => {
    const results = computeCompletionItems("nop", undefined, svc);
    const nop = results.find((r) => r.label === "nop");
    expect(nop).toBeDefined();
    expect(nop!.insertText).toBe("nop");
    expect(nop!.isSnippet).toBe(false);
  });
});
