import { afterEach, describe, expect, it } from "vitest";
import { setLanguage } from "@common/i18n/i18n";
import {
  deleteLabelConfirmRequest,
  selectViewModel
} from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorViewModel";
import { summarizeNexIssues } from "@renderer/appIde/DocumentPanels/Next/nexValidation";
import { formatBankLocation } from "@renderer/appIde/DocumentPanels/Next/nextBankLocation";
import {
  describeBankBreakpoints,
  formatBankBreakpointBadge
} from "@renderer/appIde/DocumentPanels/Next/nexBankGutter";
import { formatBankDiff } from "@renderer/appIde/DocumentPanels/Next/nexLiveBank";
import { regionHint, validateRegion } from "@renderer/appIde/DocumentPanels/Next/NexRegionDialog";
import { VIEW_NAMES } from "@renderer/appIde/DocumentPanels/Next/NexBankBrowser";
import { aListing, anAnnotationModel, aState } from "../dialogs/nexAnnotationEditor/fixtures";

/*
 * The NEX panels' text in the pseudo-locale (`.plans/LOCALIZATION_PLAN.md` step 11): the pure
 * formatters behind the bank browser, the pop-out header and the annotation editor produce pseudo
 * text, and the annotation menu, built before a language switch, follows the switch when it is read.
 */
const isPseudo = (text: string) => /^\[.*~+\]$/s.test(text);

afterEach(() => setLanguage("en"));

describe("the NEX panels in the pseudo-locale", () => {
  it("translates the annotation menu as it is read, even from a view model built earlier", () => {
    const vm = selectViewModel(aState({ annotations: anAnnotationModel(), items: aListing(4) }));
    setLanguage("qps");
    const problems = vm.menu
      .filter((entry) => entry.kind === "item")
      .map((entry) => (entry.kind === "item" ? entry.text : ""))
      .filter((text) => !isPseudo(text));
    expect(problems).toEqual([]);
  });

  it("translates the formatters' text", () => {
    setLanguage("qps");
    const summary = {
      total: 3,
      exec: 2,
      memRead: 1,
      memWrite: 0,
      disabled: 1,
      disabledByKind: { exec: 1, memRead: 0, memWrite: 0 }
    };
    const texts = [
      summarizeNexIssues([{ id: "x", severity: "error", message: "" }])!,
      formatBankLocation([]).text,
      formatBankLocation([]).title,
      formatBankBreakpointBadge(summary)!.title,
      ...describeBankBreakpoints(summary).map((d) => d.text),
      formatBankDiff({ mask: new Uint8Array(100).fill(1), changed: 100 })!.title,
      validateRegion("words", 0, 2)!,
      regionHint("copper", 1, 4, [0, 0, 0, 0, 0])!.text,
      deleteLabelConfirmRequest({ scope: "local", name: "Loop", referenceCount: 2 }).title,
      VIEW_NAMES.disassembly
    ];
    expect(texts.filter((text) => !isPseudo(text))).toEqual([]);
  });
});
