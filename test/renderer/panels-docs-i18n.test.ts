import { describe, expect, it } from "vitest";
import { setLanguage } from "@common/i18n/i18n";
import { formatBranchReadout, type BranchVerdict } from "@renderer/appIde/DocumentPanels/branchVerdict";
import {
  annotationRowMenuItems,
  disassemblyRowMenuItems
} from "@renderer/appIde/DocumentPanels/disassemblyRowMenu";
import { parseTraceColumns } from "@common/history/historyExport";

/*
 * The document panels' non-React texts in the pseudo-locale (`.plans/LOCALIZATION_PLAN.md` step
 * 11): the disassembly row menus and the execution-point readout's prose are pseudo text, and the
 * readout's notation (the short form) is left alone.
 */
const isPseudo = (text: string) => /^\[.*~+\]$/s.test(text);

describe("the document panels in the pseudo-locale", () => {
  it("translates every disassembly row menu item", () => {
    setLanguage("qps");
    const rowItems = disassemblyRowMenuItems({ address: 0x8000, spec: "$8000" }, {});
    const annotationItems = annotationRowMenuItems({
      rom: true,
      hasOperands: true,
      hasDefinition: true,
      hints: {},
      regionActions: [],
      romEditor: "start"
    });
    for (const item of [...rowItems, ...annotationItems]) {
      expect(isPseudo(item.text), item.text).toBe(true);
    }
  });

  it("translates the branch readout's prose and keeps its notation", () => {
    setLanguage("qps");
    const verdicts: BranchVerdict[] = [
      { kind: "jp", taken: true, conditionText: "NC", reasonText: "C=0", nextAddress: 0x8000, direction: "back", tstates: 10 },
      { kind: "jr", taken: false, conditionText: "Z", nextAddress: 0x8002, direction: "none", tstates: 7 },
      { kind: "call", taken: true, nextAddress: 0x0038, direction: "back", tstates: 17 },
      { kind: "ret", taken: true, unobtainable: "stack-unreadable", direction: "return", tstates: 10 }
    ] as BranchVerdict[];
    for (const verdict of verdicts) {
      const { long, short } = formatBranchReadout(verdict, false);
      expect(isPseudo(long.head), long.head).toBe(true);
      expect(/[A-Za-z]{3,}/.test(short.head), short.head).toBe(false);
    }
  });

  it("translates the trace column errors", () => {
    setLanguage("qps");
    expect(isPseudo(parseTraceColumns(",") as string)).toBe(true);
    expect(isPseudo(parseTraceColumns("pc") as string)).toBe(true);
  });
});
