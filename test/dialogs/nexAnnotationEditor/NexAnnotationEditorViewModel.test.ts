import { describe, it, expect } from "vitest";

import {
  actionOffsetSpan,
  ANNOTATION_LOAD_FAILED_MESSAGE,
  canAssignOperandLabel,
  deleteLabelConfirmRequest,
  discardConfirmMessage,
  regionTypeOfAction,
  selectViewModel,
  type NexAnnotationMenuAction,
  type NexAnnotationMenuEntry
} from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorViewModel";

import {
  aListing,
  anAnnotationModel,
  anEnvironment,
  anOperandRow,
  aPrefixRow,
  aRow,
  aState,
  SIDECAR
} from "./fixtures";

/** A loaded, annotated editor with a listing — the ordinary case. */
function loaded(over: Parameters<typeof aState>[0] = {}) {
  return aState({ annotations: anAnnotationModel(), items: aListing(10), ...over });
}

function itemOf(
  menu: NexAnnotationMenuEntry[],
  id: NexAnnotationMenuAction
): Extract<NexAnnotationMenuEntry, { kind: "item" }> {
  const entry = menu.find((candidate) => candidate.kind === "item" && candidate.id === id);
  if (!entry || entry.kind !== "item") throw new Error(`no menu item ${id}`);
  return entry;
}

describe("toolbar", () => {
  it("is absent for a document with no sidecar", () => {
    // --- A popped-out loading screen is a plain memory dump: nothing to annotate.
    const vm = selectViewModel(aState({ env: anEnvironment({ annotationPath: undefined }) }));
    expect(vm.toolbar.visible).toEqual(false);
  });

  it("is present for a sidecar that failed to load", () => {
    // --- Keyed on the path, not on a loaded model — showing the warning is the point.
    const vm = selectViewModel(aState({ loadError: "bad json" }));
    expect(vm.toolbar.visible).toEqual(true);
    expect(vm.toolbar.warning).toEqual({ kind: "warning", title: "bad json" });
  });

  it("shows no warning while the sidecar is still loading", () => {
    const vm = selectViewModel(aState({ loading: true }));
    expect(vm.toolbar.warning.kind).toEqual("none");
  });

  it("warns once loading finished without annotations", () => {
    const vm = selectViewModel(aState({ loading: false, annotations: undefined }));
    expect(vm.toolbar.warning).toEqual({
      kind: "warning",
      title: ANNOTATION_LOAD_FAILED_MESSAGE
    });
  });

  it("shows no warning when annotations loaded cleanly", () => {
    expect(selectViewModel(loaded()).toolbar.warning.kind).toEqual("none");
  });

  it("lets a save failure win the tooltip over a load failure", () => {
    // --- The save is the more recent news.
    const vm = selectViewModel(loaded({ saveError: "read-only", loadError: "bad json" }));
    expect(vm.toolbar.warning).toEqual({ kind: "warning", title: "read-only" });
  });

  it("enables and highlights save only while there are unsaved edits", () => {
    expect(selectViewModel(loaded()).toolbar.saveEnabled).toEqual(false);
    expect(selectViewModel(loaded()).toolbar.saveHighlighted).toEqual(false);

    const dirty = selectViewModel(loaded({ dirty: true })).toolbar;
    expect(dirty.saveEnabled).toEqual(true);
    expect(dirty.saveHighlighted).toEqual(true);
  });

  it("does not offer save without a loaded model to write", () => {
    expect(selectViewModel(aState({ dirty: true })).toolbar.saveEnabled).toEqual(false);
  });

  it("does not offer save while one is already running", () => {
    const vm = selectViewModel(loaded({ dirty: true, busy: "saving" }));
    expect(vm.toolbar.saveEnabled).toEqual(false);
    // --- Still highlighted: there are still unsaved edits.
    expect(vm.toolbar.saveHighlighted).toEqual(true);
  });

  it("enables the menu only with something selected", () => {
    expect(selectViewModel(loaded()).toolbar.menuEnabled).toEqual(false);
    const selected = loaded({ selection: { anchorIndex: 2, activeIndex: 2 } });
    expect(selectViewModel(selected).toolbar.menuEnabled).toEqual(true);
  });

  it("keeps the menu disabled without annotations, however the rows look", () => {
    const state = aState({ items: aListing(4), selection: { anchorIndex: 1, activeIndex: 1 } });
    expect(selectViewModel(state).toolbar.menuEnabled).toEqual(false);
  });

  it("reports busy for either job", () => {
    expect(selectViewModel(loaded({ busy: "listing" })).toolbar.busy).toEqual(true);
    expect(selectViewModel(loaded({ busy: "saving" })).toolbar.busy).toEqual(true);
    expect(selectViewModel(loaded()).toolbar.busy).toEqual(false);
  });
});

describe("menu", () => {
  const selected = loaded({ selection: { anchorIndex: 2, activeIndex: 4 } });

  it("lists every action, in the order the menu shows them", () => {
    const ids = selectViewModel(selected)
      .menu.filter((entry) => entry.kind === "item")
      .map((entry) => (entry as any).id);
    expect(ids).toEqual([
      "manage-labels",
      "manage-regions",
      "synopsis",
      "comment",
      "global-label",
      "local-label",
      "operand-label",
      "mark-disassembly",
      "mark-bytes",
      "mark-words",
      "mark-skip",
      "clear"
    ]);
  });

  it("separates the groups", () => {
    const separators = selectViewModel(selected).menu.filter(
      (entry) => entry.kind === "separator"
    );
    expect(separators.length).toEqual(4);
  });

  it("disables everything without annotations", () => {
    const vm = selectViewModel(aState({ items: aListing(4) }));
    expect(vm.menu.every((entry) => entry.kind === "separator" || entry.disabled)).toEqual(true);
  });

  it("keeps the bank-wide actions available with nothing selected", () => {
    // --- Manage Labels and Manage Regions act on the whole bank, so they need no row.
    const vm = selectViewModel(loaded());
    expect(itemOf(vm.menu, "manage-labels").disabled).toEqual(false);
    expect(itemOf(vm.menu, "manage-regions").disabled).toEqual(false);
    // --- The row actions have nothing to act on.
    expect(itemOf(vm.menu, "synopsis").disabled).toEqual(true);
    expect(itemOf(vm.menu, "mark-bytes").disabled).toEqual(true);
  });

  it("enables the row actions once a row is selected", () => {
    const vm = selectViewModel(selected);
    expect(itemOf(vm.menu, "synopsis").disabled).toEqual(false);
    expect(itemOf(vm.menu, "clear").disabled).toEqual(false);
  });

  it("offers Assign Operand Label only on a row with a decoded operand", () => {
    const withOperand = loaded({
      items: [anOperandRow(0), aRow(3)],
      selection: { anchorIndex: 0, activeIndex: 0 }
    });
    expect(itemOf(selectViewModel(withOperand).menu, "operand-label").disabled).toEqual(false);

    // --- A plain `nop` has no operand for a label to name.
    const withoutOperand = loaded({
      items: [anOperandRow(0), aRow(3)],
      selection: { anchorIndex: 1, activeIndex: 1 }
    });
    expect(itemOf(selectViewModel(withoutOperand).menu, "operand-label").disabled).toEqual(true);
  });

  it("refuses Assign Operand Label on a generated prefix row", () => {
    // --- A synopsis comment is a rendered line, not an instruction.
    const state = loaded({
      items: [aPrefixRow(), aRow(1)],
      selection: { anchorIndex: 0, activeIndex: 0 }
    });
    expect(itemOf(selectViewModel(state).menu, "operand-label").disabled).toEqual(true);
  });
});

describe("canAssignOperandLabel", () => {
  it("prefers the row a menu was opened on over the selection", () => {
    const state = loaded({
      items: [anOperandRow(0), aRow(3)],
      selection: { anchorIndex: 1, activeIndex: 1 },
      contextTarget: { rowIndex: 0, isRange: false }
    });
    expect(canAssignOperandLabel(state)).toEqual(true);
  });

  it("takes an explicit row over both", () => {
    const state = loaded({
      items: [anOperandRow(0), aRow(3)],
      contextTarget: { rowIndex: 0, isRange: false }
    });
    expect(canAssignOperandLabel(state, 1)).toEqual(false);
  });

  it("is false with no row at all", () => {
    expect(canAssignOperandLabel(loaded())).toEqual(false);
  });
});

describe("listing", () => {
  it("passes the rows through and reports the highlighted span", () => {
    const vm = selectViewModel(loaded({ selection: { anchorIndex: 5, activeIndex: 2 } }));
    expect(vm.listing.items.length).toEqual(10);
    // --- Ordered, whichever way the range was dragged.
    expect(vm.listing.selectedRange).toEqual({ start: 2, end: 5 });
  });

  it("reports no span with nothing selected", () => {
    expect(selectViewModel(loaded()).listing.selectedRange).toEqual(undefined);
  });
});

describe("actionOffsetSpan", () => {
  it("covers the selection when the named row is inside it", () => {
    const state = loaded({ items: aListing(10), selection: { anchorIndex: 2, activeIndex: 4 } });
    expect(actionOffsetSpan(state, 3)).toEqual({ start: 2, end: 4 });
  });

  it("covers the named row alone when it is outside the selection", () => {
    const state = loaded({ items: aListing(10), selection: { anchorIndex: 2, activeIndex: 4 } });
    expect(actionOffsetSpan(state, 7)).toEqual({ start: 7, end: 7 });
  });

  it("spans every byte of a multi-byte row", () => {
    const state = loaded({ items: [aRow(0), aRow(1, { byteLength: 3 })] });
    expect(actionOffsetSpan(state, 1)).toEqual({ start: 1, end: 3 });
  });
});

describe("hasUnsavedChanges and the discard prompt", () => {
  it("mirrors the session's dirty flag", () => {
    expect(selectViewModel(loaded()).hasUnsavedChanges).toEqual(false);
    expect(selectViewModel(loaded({ dirty: true })).hasUnsavedChanges).toEqual(true);
  });

  it("names the sidecar in the discard question, wording preserved verbatim", () => {
    // --- Answered by `window.confirm`, and the existing DOM suite asserts this exact string.
    expect(discardConfirmMessage(loaded({ dirty: true }))).toEqual(
      `Discard unsaved annotation changes in ${SIDECAR}?`
    );
  });

  it("falls back to a generic name when the sidecar path is unknown", () => {
    const state = loaded({ env: anEnvironment({ annotationPath: undefined }), dirty: true });
    expect(discardConfirmMessage(state)).toEqual(
      "Discard unsaved annotation changes in the annotation file?"
    );
  });
});

describe("regionTypeOfAction", () => {
  it("maps the four marking actions to their region types", () => {
    expect(regionTypeOfAction("mark-disassembly")).toEqual("disassemble");
    expect(regionTypeOfAction("mark-bytes")).toEqual("bytes");
    expect(regionTypeOfAction("mark-words")).toEqual("words");
    expect(regionTypeOfAction("mark-skip")).toEqual("skip");
  });

  it("is undefined for an action that is not a region change", () => {
    expect(regionTypeOfAction("synopsis")).toEqual(undefined);
    expect(regionTypeOfAction("clear")).toEqual(undefined);
  });
});

describe("deleteLabelConfirmRequest", () => {
  it("says which kind of label, and marks the delete destructive", () => {
    const request = deleteLabelConfirmRequest({ scope: "global", name: "Start", referenceCount: 0 });
    expect(request.lines).toEqual(["Delete this global label?"]);
    expect(request.code).toEqual("Start");
    expect(request.danger).toEqual(true);
    // --- Nothing references it, so there is no second consequence to warn about.
    expect(request.linesAfterCode).toEqual(undefined);
  });

  it("calls a local label a bank label, as the dialog does", () => {
    const request = deleteLabelConfirmRequest({ scope: "local", name: "Loop", referenceCount: 0 });
    expect(request.lines).toEqual(["Delete this bank label?"]);
  });

  it("warns that operand references will be cleared, and counts them correctly", () => {
    // --- Clearing those references is the invisible half of saying yes.
    expect(
      deleteLabelConfirmRequest({ scope: "local", name: "Loop", referenceCount: 1 }).linesAfterCode
    ).toEqual(["1 operand reference to it will be cleared."]);
    expect(
      deleteLabelConfirmRequest({ scope: "local", name: "Loop", referenceCount: 3 }).linesAfterCode
    ).toEqual(["3 operand references to it will be cleared."]);
  });
});
