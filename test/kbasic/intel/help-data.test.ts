import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { KEYWORDS, EXTENSION_KEYWORDS } from "@main/kbasic/syntax/keywords";
import { HELP_ATTRIBUTION, KEYWORD_HELP, keywordHelp, libraryRoutineHelp, monarchWordLists } from "@common/kbasic/help";
import { zxBasLanguageProvider } from "@renderer/appIde/project/zxBasLanguageProvider";

const require = createRequire(import.meta.url);
const generator = require(path.resolve("scripts/kbasic-help-data.cjs")) as {
  generate(): { text: string; problems: string[] };
  displayOf(ebnf: string, keyword?: string): string | undefined;
  OUT: string;
};

describe("Klive BASIC help data (plan §4.4, E8)", () => {
  it("the committed file is what the generator writes (run `npm run kbasic:help`)", () => {
    const { text, problems } = generator.generate();
    expect(problems).toEqual([]);
    expect(fs.readFileSync(generator.OUT, "utf8")).toBe(text);
  });

  it("every keyword has help with a summary", () => {
    for (const name of [...Object.keys(KEYWORDS), ...Object.keys(EXTENSION_KEYWORDS)]) {
      const help = keywordHelp(name);
      expect(help, name).toBeDefined();
      expect(help!.summary, name).not.toBe("");
      expect(help!.display.length, name).toBeGreaterThan(0);
    }
  });

  it("reduces EBNF to a readable line", () => {
    expect(generator.displayOf('beep = "BEEP" expr "," expr ;', "BEEP")).toBe("BEEP expr, expr");
    expect(generator.displayOf('"ABS" "(" expr ")"', "ABS")).toBe("ABS(expr)");
    expect(generator.displayOf('( "STR" | "STR$" ) "(" expr ")"', "STR$")).toBe("STR$(expr)");
    expect(generator.displayOf('convention = "FASTCALL" | "STDCALL" ;', "FUNCTION")).toBeUndefined();
    expect(generator.displayOf('"#include" \'"\' file \'"\'')).toBe('#include "file"');
  });

  it("carries the CC BY attribution", () => {
    expect(HELP_ATTRIBUTION).toMatch(/CC BY 4\.0/);
    expect(HELP_ATTRIBUTION).toMatch(/Boriel/);
  });

  it("knows which library routines Klive BASIC has, and where", () => {
    expect(libraryRoutineHelp("attr")).toMatchObject({ available: true, library: "attr.bas", include: "#include <attr.bas>" });
    expect(libraryRoutineHelp("clearbox")).toMatchObject({ available: true, library: "clearbox.bas" });
  });

  it("the Monarch word lists are built from the help data", () => {
    const words = monarchWordLists();
    const def = zxBasLanguageProvider.languageDef as unknown as Record<string, string[]>;
    expect(def.statements).toEqual(words.statements);
    expect(def.functions).toEqual(words.functions);
    expect(def.types).toEqual(words.types);
    expect(def.directives).toEqual(words.directives);
    for (const op of words.operators) expect(def.operators).toContain(op);
    const all = new Set([...def.statements, ...def.functions, ...def.types, ...def.operators]);
    for (const e of KEYWORD_HELP) expect(all.has(e.name), e.name).toBe(true);
  });

  it("the language configuration comments, brackets and indents", () => {
    const options = zxBasLanguageProvider.options!;
    expect(options.comments?.lineComment).toBe("'");
    expect(options.brackets).toEqual([["(", ")"]]);
    const inc = options.indentationRules!.increaseIndentPattern;
    const dec = options.indentationRules!.decreaseIndentPattern;
    for (const line of ["SUB s(a AS UByte)", "  for i = 1 to 3", "IF a THEN", "DO", "WHILE x", "ELSE", "ASM"]) expect(inc.test(line), line).toBe(true);
    for (const line of ["FOR i = 1 TO 3: NEXT i", "IF a THEN PRINT 1", "DECLARE SUB s"]) expect(inc.test(line), line).toBe(false);
    for (const line of ["END SUB", "  next i", "LOOP UNTIL a", "WEND", "ELSE", "END IF"]) expect(dec.test(line), line).toBe(true);
  });
});

describe("renderer-shared Klive BASIC modules", () => {
  it("the option table and the keyword table import no Node module", () => {
    for (const file of ["src/main/kbasic/options/options.ts", "src/main/kbasic/syntax/keywords.ts"]) {
      const text = fs.readFileSync(file, "utf8");
      const imports = [...text.matchAll(/^import[^"']*["']([^"']+)["']/gm)].map((m) => m[1]);
      expect(imports.filter((i) => !i.startsWith(".") && !i.startsWith("@")), file).toEqual([]);
      expect(imports.filter((i) => /^(?:node:)?(?:fs|path|os|child_process|worker_threads)$/.test(i)), file).toEqual([]);
    }
  });
});
