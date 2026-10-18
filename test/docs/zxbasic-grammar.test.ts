/**
 * The docs' ZX BASIC grammar (docs/zxbasic.tmLanguage.json) is generated from the IDE editor's own
 * word lists (`monarchWordLists`). When the help data changes (`npm run kbasic:help`), the site
 * must follow: regenerate with `npm run doc:grammar`.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const REPO = join(__dirname, "..", "..");

describe("the docs' ZX BASIC grammar", () => {
  it("is current with the IDE's word lists", () => {
    const { render } = require("../../scripts/build-doc-zxbasic-grammar.cjs");
    const committed = readFileSync(join(REPO, "docs", "zxbasic.tmLanguage.json"), "utf8");
    expect(committed, "run `npm run doc:grammar`").toBe(render());
  });

  it("highlights the statement, function, type and directive words", () => {
    const grammar = JSON.parse(readFileSync(join(REPO, "docs", "zxbasic.tmLanguage.json"), "utf8"));
    const keyword = grammar.repository.keyword.patterns as { name: string; match: string }[];
    const matches = (scope: string, word: string) =>
      new RegExp(keyword.find((p) => p.name === scope)!.match.replace("(?i)", ""), "i").test(word);
    expect(matches("keyword.control.zxbasic", "PRINT")).toBe(true);
    expect(matches("keyword.control.zxbasic", "printer")).toBe(false);
    expect(matches("support.function.zxbasic", "CHR$")).toBe(true);
    expect(matches("storage.type.zxbasic", "UInteger")).toBe(true);
    expect(new RegExp(grammar.repository.directive.match.replace("(?i)", ""), "i").test("#include")).toBe(true);
  });
});
