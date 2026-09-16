import { describe, it, expect } from "vitest";

import {
  actionRange,
  isAnnotationEnabled,
  initialState,
  offsetIndexOf,
  offsetSpanOf,
  reduce,
  selectedRange
} from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorModel";

import {
  aListing,
  anAnnotationModel,
  anEnvironment,
  aPrefixRow,
  aRow,
  aSnapshot,
  aState,
  BANK,
  SIDECAR
} from "./fixtures";

describe("NexAnnotationEditor initialState", () => {
  it("starts idle, with nothing selected and no listing", () => {
    const state = initialState(anEnvironment());
    expect(state.loading).toEqual(false);
    expect(state.dirty).toEqual(false);
    expect(state.items).toEqual([]);
    expect(state.busy).toEqual(undefined);
    expect(state.selection).toEqual(undefined);
  });
});

describe("reduce: envReplaced", () => {
  it("returns the same state object for an equal environment", () => {
    // --- The container derives the environment fresh on every render, so an equal one must be a
    // --- no-op or `useSyncExternalStore` re-renders forever. See trap 4 in `.ai/ui-mvc-guide.md`.
    const state = aState();
    expect(reduce(state, { type: "envReplaced", env: anEnvironment() })).toBe(state);
  });

  it("keeps the selection when only the display settings changed", () => {
    // --- Toggling decimal view does not move any row, so the selection still means what it did.
    const state = aState({ items: aListing(10), selection: { anchorIndex: 2, activeIndex: 4 } });
    const next = reduce(state, {
      type: "envReplaced",
      env: anEnvironment({ decimalView: true })
    });
    expect(next.selection).toEqual({ anchorIndex: 2, activeIndex: 4 });
  });

  it("drops the selection when the bank changes", () => {
    // --- Row indices meant positions in the old bank's listing.
    const state = aState({ items: aListing(10), selection: { anchorIndex: 2, activeIndex: 4 } });
    const next = reduce(state, { type: "envReplaced", env: anEnvironment({ bank: 6 }) });
    expect(next.selection).toEqual(undefined);
    expect(next.env.bank).toEqual(6);
  });

  it("drops the selection when the sidecar changes", () => {
    const state = aState({ selection: { anchorIndex: 1, activeIndex: 1 } });
    const next = reduce(state, {
      type: "envReplaced",
      env: anEnvironment({ annotationPath: "/other/Other.nex.dis" })
    });
    expect(next.selection).toEqual(undefined);
  });
});

describe("reduce: sessionSnapshotReceived", () => {
  it("takes the annotations, dirty flag and errors from the session", () => {
    const annotations = anAnnotationModel();
    const next = reduce(aState(), {
      type: "sessionSnapshotReceived",
      snapshot: aSnapshot({ annotations, dirty: true, saveError: "disk full" })
    });
    expect(next.annotations).toBe(annotations);
    expect(next.dirty).toEqual(true);
    expect(next.saveError).toEqual("disk full");
  });

  it("returns the same state object for an unchanged snapshot", () => {
    // --- The session broadcasts to every subscriber of a sidecar, so an unchanged snapshot arrives
    // --- whenever a *sibling* bank document edits another bank.
    const annotations = anAnnotationModel();
    const state = aState({ annotations, dirty: false, loading: false });
    const same = reduce(state, {
      type: "sessionSnapshotReceived",
      snapshot: aSnapshot({ annotations })
    });
    expect(same).toBe(state);
  });

  it("notices a load error arriving", () => {
    const next = reduce(aState(), {
      type: "sessionSnapshotReceived",
      snapshot: aSnapshot({ annotations: undefined, loadError: "bad json" })
    });
    expect(next.loadError).toEqual("bad json");
    expect(next.annotations).toEqual(undefined);
  });
});

describe("reduce: listing", () => {
  it("takes the rows it is given", () => {
    const settled = reduce(aState(), { type: "listingSettled", items: aListing(3) });
    expect(settled.items.length).toEqual(3);
  });

  it("returns the same state object for the same rows", () => {
    // --- The surrounding component regenerates on every display change, and an unchanged listing
    // --- must not re-render the editor.
    const items = aListing(3);
    const state = aState({ items });
    expect(reduce(state, { type: "listingSettled", items })).toBe(state);
  });

  it("clamps a selection that the new listing is too short for", () => {
    // --- Marking a range as `skip` collapses many rows into one, so the listing can shrink under a
    // --- selection that was made against the old one.
    const state = aState({ items: aListing(10), selection: { anchorIndex: 7, activeIndex: 9 } });
    const next = reduce(state, { type: "listingSettled", items: aListing(4) });
    expect(next.selection).toEqual({ anchorIndex: 3, activeIndex: 3 });
  });

  it("drops the selection when the new listing is empty", () => {
    const state = aState({ items: aListing(4), selection: { anchorIndex: 1, activeIndex: 2 } });
    const next = reduce(state, { type: "listingSettled", items: [] });
    expect(next.selection).toEqual(undefined);
  });

  it("leaves a selection the new listing still covers", () => {
    const selection = { anchorIndex: 1, activeIndex: 2 };
    const state = aState({ items: aListing(10), selection });
    expect(reduce(state, { type: "listingSettled", items: aListing(10) }).selection).toBe(
      selection
    );
  });

  it("drops a context target the new listing is too short for", () => {
    const state = aState({ items: aListing(10), contextTarget: { rowIndex: 8, isRange: false } });
    expect(reduce(state, { type: "listingSettled", items: aListing(4) }).contextTarget).toEqual(
      undefined
    );
  });
});

describe("reduce: writing", () => {
  /*
   * The editor no longer models a save at all.
   *
   * Annotations are written by the session as they are made, so `dirty` and `saveError` arrive
   * through its snapshot like everything else. There is no local save lifecycle to keep in step
   * with it — which is the disagreement the old `saveStarted`/`saveSettled` pair existed to avoid.
   */
  it("takes the write state from the session's snapshot", () => {
    const failed = reduce(aState(), {
      type: "sessionSnapshotReceived",
      snapshot: {
        annotations: anAnnotationModel(),
        dirty: true,
        loading: false,
        saveError: "read-only"
      }
    });
    expect(failed.dirty).toEqual(true);
    expect(failed.saveError).toEqual("read-only");

    const landed = reduce(failed, {
      type: "sessionSnapshotReceived",
      snapshot: { annotations: anAnnotationModel(), dirty: false, loading: false }
    });
    expect(landed.dirty).toEqual(false);
    expect(landed.saveError).toEqual(undefined);
  });
});

describe("reduce: selection", () => {
  it("returns the same state object for an unchanged selection", () => {
    const state = aState({ selection: { anchorIndex: 1, activeIndex: 3 } });
    const same = reduce(state, {
      type: "selectionChanged",
      selection: { anchorIndex: 1, activeIndex: 3 }
    });
    expect(same).toBe(state);
  });

  it("clearing also drops the context target", () => {
    // --- A menu that was opened on a selection means nothing once the selection is gone.
    const state = aState({
      selection: { anchorIndex: 1, activeIndex: 3 },
      contextTarget: { rowIndex: 2, isRange: true }
    });
    const next = reduce(state, { type: "selectionCleared" });
    expect(next.selection).toEqual(undefined);
    expect(next.contextTarget).toEqual(undefined);
  });

  it("clearing nothing is a no-op", () => {
    const state = aState();
    expect(reduce(state, { type: "selectionCleared" })).toBe(state);
  });
});

describe("selectedRange", () => {
  it("orders the span, whichever way the selection was dragged", () => {
    expect(selectedRange(aState({ selection: { anchorIndex: 2, activeIndex: 5 } }))).toEqual({
      start: 2,
      end: 5
    });
    // --- Dragged upwards: the anchor is the higher index.
    expect(selectedRange(aState({ selection: { anchorIndex: 5, activeIndex: 2 } }))).toEqual({
      start: 2,
      end: 5
    });
  });

  it("is undefined when nothing is selected", () => {
    expect(selectedRange(aState())).toEqual(undefined);
  });
});

describe("actionRange", () => {
  const selected = aState({ items: aListing(10), selection: { anchorIndex: 2, activeIndex: 5 } });

  it("acts on the whole selection when the named row is inside it", () => {
    // --- This is what makes "mark as bytes" work on a dragged range.
    expect(actionRange(selected, 3)).toEqual({ start: 2, end: 5 });
    expect(actionRange(selected, 2)).toEqual({ start: 2, end: 5 });
    expect(actionRange(selected, 5)).toEqual({ start: 2, end: 5 });
  });

  it("acts on the named row alone when it is outside the selection", () => {
    expect(actionRange(selected, 7)).toEqual({ start: 7, end: 7 });
  });

  it("acts on the selection when no row is named", () => {
    // --- The toolbar route: there is no row, only whatever is selected.
    expect(actionRange(selected, undefined)).toEqual({ start: 2, end: 5 });
  });

  it("has nothing to act on with neither a row nor a selection", () => {
    expect(actionRange(aState(), undefined)).toEqual(undefined);
  });
});

describe("offsetSpanOf", () => {
  it("covers every byte of the rows in the range", () => {
    // --- Inclusive of the last row's bytes: a 3-byte instruction at offset 4 ends at offset 6.
    const state = aState({
      items: [aRow(0), aRow(1), aRow(2), aRow(4, { byteLength: 3 })]
    });
    expect(offsetSpanOf(state, { start: 0, end: 3 })).toEqual({ start: 0, end: 6 });
  });

  it("treats a byteless row as one byte", () => {
    const state = aState({
      items: [{ address: 0, annotation: { bank: BANK, bankOffset: 8 } } as any]
    });
    expect(offsetSpanOf(state, { start: 0, end: 0 })).toEqual({ start: 8, end: 8 });
  });

  it("takes min/max over the annotated rows, ignoring prefix rows at the edges", () => {
    // --- A synopsis comment renders as a prefix row with no annotation. Reading the *boundary*
    // --- rows would find no offset at all and abandon the action.
    const state = aState({ items: [aPrefixRow(), aRow(4), aRow(5), aPrefixRow()] });
    expect(offsetSpanOf(state, { start: 0, end: 3 })).toEqual({ start: 4, end: 5 });
  });

  it("is undefined without a range, or when no row in it carries an offset", () => {
    expect(offsetSpanOf(aState({ items: aListing(3) }), undefined)).toEqual(undefined);
    const state = aState({ items: [aPrefixRow()] });
    expect(offsetSpanOf(state, { start: 0, end: 0 })).toEqual(undefined);
  });
});

describe("offsetIndexOf", () => {
  it("maps the display offset to the sidecar's offset index", () => {
    expect(offsetIndexOf(aState({ env: anEnvironment({ disassOffset: 0x0000 }) }))).toEqual(0);
    expect(offsetIndexOf(aState({ env: anEnvironment({ disassOffset: 0x4000 }) }))).toEqual(1);
    expect(offsetIndexOf(aState({ env: anEnvironment({ disassOffset: 0xc000 }) }))).toEqual(3);
  });
});

describe("isAnnotationEnabled", () => {
  it("needs a sidecar, a bank and a loaded model", () => {
    expect(isAnnotationEnabled(aState({ annotations: anAnnotationModel() }))).toEqual(true);
    // --- A loading screen dump has no sidecar at all.
    expect(
      isAnnotationEnabled(
        aState({ env: anEnvironment({ annotationPath: undefined }), annotations: anAnnotationModel() })
      )
    ).toEqual(false);
    expect(
      isAnnotationEnabled(
        aState({ env: anEnvironment({ bank: undefined }), annotations: anAnnotationModel() })
      )
    ).toEqual(false);
    // --- Sidecar named but not yet loaded, or failed to load.
    expect(isAnnotationEnabled(aState({ annotations: undefined }))).toEqual(false);
  });

  it("uses the sidecar the environment names", () => {
    expect(anEnvironment().annotationPath).toEqual(SIDECAR);
  });
});
