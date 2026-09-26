import { describe, expect, it } from "vitest";

import { parseProgram } from "@main/kbasic/front-end";

import spec from "../../../.ai/zxbasic-syntax/zxbasic-syntax.json";
import { CASES } from "./spec-cases";

/**
 * Every EBNF form of the spec has at least one program the parser accepts and one it rejects
 * (plan §13.1). The table is keyed by the form's exact text in `.ai/zxbasic-syntax/`, so a form
 * added to the spec fails this test until it gets its cases.
 */
function allForms(): string[] {
  const forms: string[] = [];
  for (const s of spec.statements) forms.push(...s.syntax);
  for (const f of spec.functions) forms.push(...f.syntax);
  forms.push(...spec.extensions.codebank.syntax);
  forms.push(...spec.types.strings.slicing);
  forms.push(...spec.subprograms.call);
  forms.push(...spec.operators.primary_expressions);
  forms.push(...spec.lexical.line_structure.ebnf);
  return [...new Set(forms)];
}

function errorsOf(text: string): string[] {
  const r = parseProgram("/p/main.zxbas", text, { read: () => undefined });
  return r.diagnostics.items.filter((d) => d.severity === "error").map((d) => `${d.code} ${d.message}`);
}

describe("Klive BASIC parser: every spec form", () => {
  it("has accepting and rejecting cases for every form in the spec, and no stale ones", () => {
    const forms = allForms();
    const missing = forms.filter((f) => !CASES[f] || !CASES[f].accept.length || !CASES[f].reject.length);
    const stale = Object.keys(CASES).filter((k) => !forms.includes(k));
    expect({ missing, stale }).toEqual({ missing: [], stale: [] });
  });

  for (const [form, { accept, reject }] of Object.entries(CASES)) {
    describe(form.slice(0, 90), () => {
      it.each(accept)("accepts %j", (text) => {
        expect(errorsOf(text)).toEqual([]);
      });
      it.each(reject)("rejects %j", (text) => {
        expect(errorsOf(text).length).toBeGreaterThan(0);
      });
    });
  }
});
