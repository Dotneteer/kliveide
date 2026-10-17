import { afterEach, describe, expect, it } from "vitest";
import { setLanguage, t } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";
import catalog from "@common/i18n/locales/en/compiler-basic.json";
import { DiagnosticBag } from "@main/kbasic/diagnostics";
import { parseProgram } from "@main/kbasic/front-end";
import { defaultOptions } from "@main/kbasic/options/options";
import { bind } from "@main/kbasic/semantics/binder";

/*
 * Klive BASIC's compiler messages in another language (`.plans/LOCALIZATION_PLAN.md` step 13): every
 * message is a `compiler.basic.*` key, formatted when the diagnostic is made, and the code stays as
 * it is. In the pseudo-locale every message is pseudo text.
 */
const isPseudo = (text: string) => /^\[.*~+\]$/s.test(text);
const entries = catalog as Record<string, unknown>;
const KEYS = Object.keys(entries).filter((k) => !k.startsWith("@")) as MessageKey[];

/** Sample arguments for a message: each placeholder its own name, selectors their `other` branch. */
function sampleArgs(key: string): Record<string, string | number> {
  const meta = entries[`@${key}`] as { placeholders?: Record<string, string> } | undefined;
  const args: Record<string, string | number> = {};
  for (const name of Object.keys(meta?.placeholders ?? {})) args[name] = `<${name}>`;
  const text = entries[key] as string;
  for (const m of text.matchAll(/\{(\w+), plural/g)) args[m[1]] = 2;
  return args;
}

function diagnosticsOf(source: string) {
  const diagnostics = new DiagnosticBag();
  const front = parseProgram("/test/main.bas", source, { read: () => undefined }, {}, diagnostics);
  if (!diagnostics.hasErrors) bind(front.program, { ...defaultOptions(), strict: true }, diagnostics);
  return diagnostics.items;
}

describe("Klive BASIC compiler messages", () => {
  afterEach(() => setLanguage("en"));

  it("every message formats in English with all its placeholders", () => {
    const problems: string[] = [];
    for (const key of KEYS) {
      const args = sampleArgs(key);
      const text = t(key, args);
      if (text === key || /[{}]/.test(text.replace(/\{ \.\.\. \}/, ""))) problems.push(`${key}: ${text}`);
      for (const [name, value] of Object.entries(args)) {
        if (typeof value === "string" && !text.includes(value) && !/select/.test(entries[key] as string)) {
          problems.push(`${key}: {${name}} is not shown`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("every message is pseudo text in the pseudo-locale", () => {
    setLanguage("qps");
    const problems = KEYS.filter((key) => !isPseudo(t(key, sampleArgs(key))));
    expect(problems).toEqual([]);
  });

  it("formats a diagnostic in the display language and keeps its code", () => {
    const source = "DIM a AS UByte\nLET b = c$ + 1\nGOTO nowhere\n";
    const english = diagnosticsOf(source);
    expect(english.length).toBeGreaterThan(0);
    setLanguage("qps");
    const pseudo = diagnosticsOf(source);
    expect(pseudo.map((d) => d.code)).toEqual(english.map((d) => d.code));
    expect(pseudo.filter((d) => !isPseudo(d.message))).toEqual([]);
  });

  it("formats a syntax error with what the parser found", () => {
    expect(diagnosticsOf("PRINT (1\n").map((d) => `${d.code} ${d.message}`)).toEqual([
      "E302 Expected ')', found the end of the line"
    ]);
    setLanguage("qps");
    const [d] = diagnosticsOf("PRINT (1\n");
    expect(d.code).toBe("E302");
    expect(isPseudo(d.message)).toBe(true);
  });
});
