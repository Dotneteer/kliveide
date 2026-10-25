import { describe, expect, it } from "vitest";
import { setLanguage, t } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";
import panelsSide from "@common/i18n/locales/en/panels-side.json";
import { marginMenuItems } from "@renderer/features/editor/monaco/marginBreakpointMenu";
import {
  createEmptyForm,
  sourceSpecMessage,
  validateBreakpointForm
} from "@renderer/appIde/utils/breakpoint-form";
import { historyCountText, historyEmptyMessage } from "@renderer/features/history/historyViewModel";

/*
 * The side-bar panels' and feature views' texts in the pseudo-locale (`.plans/LOCALIZATION_PLAN.md`
 * step 11): every message of `panels-side.json` formats, with its placeholders, and the view models
 * that build text outside React hand back pseudo text rather than English.
 */
const isPseudo = (text: string) => /^\[.*~+\]$/s.test(text);

/** Every message with every placeholder filled, so a broken ICU message cannot hide */
const ARGS = {
  step: "−3", frame: 1, mode: 2, value: "{r8v}", channel: "A", line: 3, index: 1, size: 4, rows: 16,
  sprite: 2, color: "Red", where: "$5C00", count: 2, name: "x", bit: 1, bits: "7:5", filter: "f",
  ms: 12, test: "t.UT_a", time: "12:00", failures: 1, disabled: 1, address: "$8000", routine: "MAIN",
  page: 0, bank: 5, offset: "$000000", device: "ULA", kind: "WPMEM", target: "$8000", file: "a.asm",
  partition: "R0", what: "all", attribute: 0, old: "$00", new: "$01", origin: "port", pc: "$8000",
  paged: "in R0", hc: 12, range: "$8000", indexes: "$001", lines: 311, hcs: 456, x: 64, pct: "9.4",
  capacity: 100, hits: 3, executed: 1, total: 2, error: "e", note: "n", code: "nop", shortcut: "^-",
  layer: "ULA", rule: 1, why: "w", flags: "border", beam: "line 1", lo: 0, hi: 255, type: "Byte",
  op: "*", key: "$8000", max: 9, column: 1, message: "m", text: "q", frames: "1.0", line2: 0,
  label: "100"
};

const KEYS = Object.keys(panelsSide).filter((key) => !key.startsWith("@")) as MessageKey[];

describe("panels-side in the pseudo-locale", () => {
  it("formats every message as pseudo text", () => {
    setLanguage("qps");
    const problems = KEYS.filter((key) => !isPseudo(t(key, ARGS))).map((key) => `${key}: ${t(key, ARGS)}`);
    expect(problems).toEqual([]);
  });

  it("formats every message in English without falling back to its raw text", () => {
    setLanguage("en");
    const raw = KEYS.filter((key) => /\{[a-z]/i.test(t(key, ARGS)) && !t(key, ARGS).includes("{r8v}"));
    expect(raw).toEqual([]);
    expect(t("panels.side.watchExpr.unknownVariable", { name: "nope" })).toBe("Unknown variable 'nope'");
  });

  it("translates the editor margin's menu", () => {
    setLanguage("qps");
    const items = [
      ...marginMenuItems({ line: 1, canAdd: true }),
      ...marginMenuItems({ line: 1, canAdd: true, breakpoint: { resource: "a.asm", line: 1, exec: true } })
    ];
    expect(items.filter((item) => !isPseudo(item.text))).toEqual([]);
  });

  it("translates the breakpoint form's validation messages", () => {
    setLanguage("qps");
    const errors = validateBreakpointForm(
      { ...createEmptyForm(), address: "" },
      { partitionLabels: {}, supportsPartitions: false, existingKeys: [] }
    );
    expect(isPseudo(errors.address!)).toBe(true);
    expect(isPseudo(sourceSpecMessage())).toBe(true);
  });

  it("translates the execution history's texts", () => {
    setLanguage("qps");
    expect(isPseudo(historyEmptyMessage({ supported: false, running: false, debugging: false }, undefined)!)).toBe(true);
    expect(isPseudo(historyCountText({ count: 1, capacity: 2 } as never))).toBe(true);
  });
});
