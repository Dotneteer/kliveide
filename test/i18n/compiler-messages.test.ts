import { describe, expect, it } from "vitest";
import { setLanguage } from "@common/i18n/i18n";
import { SOURCE_CATALOG } from "@common/i18n/catalogs";
import { assemblerMessage } from "@main/compiler-common/assembler-errors";
import { ksxErrorMessage } from "@common/ksx/ParserError";

/*
 * Assembler and KSX messages come from the catalog by code (`.plans/LOCALIZATION_PLAN.md` step 13):
 * `{0}`, `{1}`... fill in order, and a compile in another language words them in that language.
 */
describe("assembler messages", () => {
  it("format the catalog text with positional parameters", () => {
    expect(assemblerMessage("Z0201", ["lib.asm"])).toBe("Cannot find include file: 'lib.asm'");
    expect(assemblerMessage("Z0204", ["a.asm", "EACCES"])).toBe("Error reading include file: 'a.asm' (EACCES)");
    expect(assemblerMessage("Z1013", ["Point"])).toBe(
      "The 'Point' label matches a structure name. If you want to invoke it, use parentheses like 'Point(...)'."
    );
  });

  it("keep literal braces and quotes", () => {
    expect(assemblerMessage("Z0006")).toBe("'}}' expected");
    expect(assemblerMessage("Z0004")).toBe("'(' expected");
  });

  it("are undefined for a code without a message", () => {
    expect(assemblerMessage("Z9999")).toBeUndefined();
  });

  it("follow the display language", () => {
    setLanguage("qps");
    expect(assemblerMessage("Z0201", ["lib.asm"])).toMatch(/^\[Çåññôţ .*'lib\.asm'~+\]$/);
  });

  it("cover every code in the catalog, Z80, 6510 and KSX alike", () => {
    const codes = Object.keys(SOURCE_CATALOG).filter((k) => /^compiler\.(asm|ksx)\.[A-Z]\d{3,4}$/.test(k));
    expect(codes.length).toBeGreaterThan(190);
  });
});

describe("KSX parser messages", () => {
  it("format their parameters", () => {
    expect(ksxErrorMessage("K002", ["+"])).toBe("Unexpected token: '+'");
  });
});
