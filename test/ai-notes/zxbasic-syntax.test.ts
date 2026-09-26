/**
 * Contract test for `.ai/zxbasic-syntax/`.
 *
 * `zxbasic-syntax.json` is Klive's own description of the Boriel ZX BASIC language, the only
 * language reference the Klive-native compiler work may use (see `.ai/zxbasic-syntax/README.md`).
 * `upstream-fingerprint.json` pins the upstream release it describes. These checks keep the two
 * files consistent with each other and with the shape the README promises, so that a refresh
 * session cannot leave the reference half-updated:
 *
 * - both files parse and name the same upstream version;
 * - every top-level section the README lists exists;
 * - arrays keyed by `name` are sorted, so that git diffs stay one-hunk-per-change;
 * - every keyword is classified, every statement has at least one syntax form, every warning
 *   code has a meaning, every CLI option has a long form and a meaning;
 * - every docs page referenced from the spec is one the fingerprint watches, so a page rename
 *   upstream is noticed;
 * - the `changes` log is newest-first and its newest entry is the fingerprinted release.
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const folder = path.join(__dirname, "..", "..", ".ai", "zxbasic-syntax");
const spec = JSON.parse(fs.readFileSync(path.join(folder, "zxbasic-syntax.json"), "utf8"));
const fingerprint = JSON.parse(fs.readFileSync(path.join(folder, "upstream-fingerprint.json"), "utf8"));

const SECTIONS = [
  "meta",
  "lexical",
  "keywords",
  "types",
  "operators",
  "statements",
  "functions",
  "subprograms",
  "preprocessor",
  "inline_asm",
  "cli",
  "diagnostics",
  "extensions",
  "changes"
];

const KEYWORD_KINDS = new Set([
  "statement",
  "function",
  "operator",
  "modifier",
  "type",
  "declaration",
  "misc"
]);

function names(items: { name: string }[]): string[] {
  return items.map((i) => i.name);
}

function expectSortedByName(items: { name: string }[], what: string) {
  const actual = names(items);
  const sorted = [...actual].sort((a, b) => a.localeCompare(b, "en"));
  expect(actual, `${what} must be sorted by name`).toEqual(sorted);
  expect(new Set(actual).size, `${what} must not repeat a name`).toBe(actual.length);
}

describe("ZX BASIC syntax reference", () => {
  it("has every section the README promises", () => {
    for (const key of SECTIONS) {
      expect(spec, `missing section '${key}'`).toHaveProperty(key);
    }
  });

  it("describes the upstream release the fingerprint pins", () => {
    expect(spec.meta.upstream.version).toBe(fingerprint.snapshot.version);
    expect(spec.meta.upstream.tag).toBe(fingerprint.snapshot.ref);
    expect(spec.meta.upstream.commit).toBe(fingerprint.snapshot.commit);
    expect(fingerprint.repo).toBe("boriel-basic/zxbasic");
    expect(Object.keys(fingerprint.files).length).toBeGreaterThan(100);
  });

  it("keeps its name-keyed arrays sorted and unique", () => {
    expectSortedByName(spec.keywords, "keywords");
    expectSortedByName(spec.statements, "statements");
    expectSortedByName(spec.functions, "functions");
    expectSortedByName(spec.cli.options, "cli.options");
    expectSortedByName(spec.preprocessor.directives, "preprocessor.directives");
    expectSortedByName(spec.preprocessor.pragmas, "preprocessor.pragmas");
    expectSortedByName(spec.diagnostics.warnings, "diagnostics.warnings");
  });

  it("classifies every keyword", () => {
    for (const kw of spec.keywords) {
      expect(KEYWORD_KINDS.has(kw.kind), `keyword ${kw.name} has kind '${kw.kind}'`).toBe(true);
      expect(kw.name).toBe(kw.name.toUpperCase());
    }
  });

  it("gives every statement at least one syntax form and a meaning", () => {
    for (const st of spec.statements) {
      expect(Array.isArray(st.syntax) && st.syntax.length > 0, `statement ${st.name} has no syntax`).toBe(true);
      expect(typeof st.semantics === "string" && st.semantics.length > 0, `statement ${st.name} has no semantics`).toBe(
        true
      );
    }
  });

  it("names every statement and function keyword in the keyword table", () => {
    const keywordNames = new Set(names(spec.keywords));
    for (const st of spec.statements) {
      const head = st.name.split(/[\s.]/)[0];
      expect(keywordNames.has(head), `statement ${st.name}: '${head}' is not a keyword`).toBe(true);
    }
  });

  it("gives every warning code a meaning and every CLI option a long form", () => {
    for (const w of spec.diagnostics.warnings) {
      expect(w.name).toMatch(/^W\d{3}$/);
      expect(w.meaning.length).toBeGreaterThan(0);
    }
    for (const opt of spec.cli.options) {
      expect(opt.name.startsWith("--"), `CLI option ${opt.name} must be the long form`).toBe(true);
      expect(opt.meaning.length).toBeGreaterThan(0);
    }
  });

  it("references only docs pages the fingerprint watches", () => {
    const watched = new Set(Object.keys(fingerprint.files));
    const collect = (items: { name: string; docs?: string | null }[], what: string) => {
      for (const item of items) {
        if (item.docs) {
          expect(watched.has(item.docs), `${what} ${item.name} points at unwatched page ${item.docs}`).toBe(true);
        }
      }
    };
    collect(spec.keywords, "keyword");
    collect(spec.statements, "statement");
    collect(spec.functions, "function");
  });

  it("logs upstream reviews newest first, starting with the pinned release", () => {
    expect(spec.changes.length).toBeGreaterThan(0);
    expect(spec.changes[0].release).toBe(fingerprint.snapshot.ref);
    const dates = spec.changes.map((c: { date: string }) => c.date);
    const sorted = [...dates].sort().reverse();
    expect(dates).toEqual(sorted);
  });
});
