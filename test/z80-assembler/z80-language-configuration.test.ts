import { describe, expect, it } from "vitest";
import { asmKz80LanguageProvider } from "@renderer/appIde/project/asmKz80LangaugeProvider";

describe("Klive Z80 language word pattern", () => {
  it("keeps qualified module symbols together", () => {
    const pattern = asmKz80LanguageProvider.options.wordPattern;

    expect("call IoDemo.Read".match(pattern)).toContain("IoDemo.Read");
    expect("call ::Outer.Inner.Read".match(pattern)).toContain("::Outer.Inner.Read");
  });
});
