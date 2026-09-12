import { describe, it, expect } from "vitest";
import {
  UNDO_LIMIT,
  addSprite,
  applyPixels,
  canRedo,
  canUndo,
  createDocument,
  currentSprite,
  duplicateSprite,
  moveSprite,
  moveSpriteLeft,
  moveSpriteRight,
  redo,
  removeSprite,
  selectSprite,
  undo
} from "@renderer/features/sprite-editor/sprite-document";
import { SPRITE_SIZE } from "@renderer/features/sprite-editor/sprite-raster";
import { DEFAULT_SPRITE_TRANSPARENCY } from "@renderer/features/sprite-editor/sprite-file";

/** A sprite filled with one recognisable value. */
const sprite = (v: number) => new Uint8Array(SPRITE_SIZE).fill(v);
const docOf = (...values: number[]) => createDocument(values.map(sprite));
/** The fill value of each sprite, as a readable summary of the whole sheet. */
const sheet = (d: { sprites: Uint8Array[] }) => d.sprites.map((s) => s[0]);

describe("sprite-document: selection", () => {
  it("selects, and clamps out-of-range indices", () => {
    const doc = docOf(1, 2, 3);
    expect(selectSprite(doc, 2).selected).toBe(2);
    expect(selectSprite(doc, 99).selected).toBe(2);
    expect(selectSprite(doc, -5).selected).toBe(0);
  });

  it("does not record selection as an undoable edit", () => {
    const doc = selectSprite(docOf(1, 2, 3), 2);
    expect(canUndo(doc)).toBe(false);
    expect(doc.edits.length).toBe(0);
  });
});

describe("sprite-document: pixel edits", () => {
  it("replaces the selected sprite and records the edit", () => {
    const doc = applyPixels(docOf(1, 2), sprite(9));
    expect(sheet(doc)).toEqual([9, 2]);
    expect(canUndo(doc)).toBe(true);
    expect(doc.edits[0]).toMatchObject({ kind: "pixels", index: 0 });
  });

  it("ignores a change that paints nothing", () => {
    const start = docOf(1, 2);
    const doc = applyPixels(start, sprite(1));
    expect(doc).toBe(start);
    expect(canUndo(doc)).toBe(false);
  });

  it("never mutates the buffer it replaces", () => {
    const start = docOf(1, 2);
    const original = start.sprites[0];
    applyPixels(start, sprite(9));
    expect(original[0]).toBe(1);
  });

  /*
   * THE regression. The old edit record carried no sprite index and undo wrote through the
   * "current selection" path, so this sequence overwrote sprite 3 with sprite 1's old bitmap.
   */
  it("undoes a pixel edit on the sprite it was made to, not the selected one", () => {
    let doc = docOf(11, 22, 33);
    doc = applyPixels(doc, sprite(99)); // edit sprite 0
    doc = selectSprite(doc, 2); // now look at sprite 2
    expect(sheet(doc)).toEqual([99, 22, 33]);

    doc = undo(doc);
    expect(sheet(doc)).toEqual([11, 22, 33]); // sprite 2 is untouched
  });

  it("navigates to the sprite an undo affected", () => {
    // Applying to the right sprite is not enough if the user is left looking at a different one.
    let doc = docOf(11, 22, 33);
    doc = applyPixels(doc, sprite(99));
    doc = selectSprite(doc, 2);
    expect(undo(doc).selected).toBe(0);
    expect(redo(undo(doc)).selected).toBe(0);
  });

  it("round-trips undo and redo", () => {
    let doc = docOf(1, 2);
    doc = applyPixels(doc, sprite(9));
    const after = sheet(doc);
    doc = undo(doc);
    expect(sheet(doc)).toEqual([1, 2]);
    doc = redo(doc);
    expect(sheet(doc)).toEqual(after);
  });
});

describe("sprite-document: sheet operations", () => {
  it("duplicates AFTER the selection and selects the copy", () => {
    // Both duplicate and add used to insert *before* the selection.
    const doc = duplicateSprite(selectSprite(docOf(1, 2, 3), 1));
    expect(sheet(doc)).toEqual([1, 2, 2, 3]);
    expect(doc.selected).toBe(2);
  });

  it("adds a blank sprite after the selection and selects it", () => {
    const doc = addSprite(selectSprite(docOf(1, 2), 0));
    expect(doc.sprites.length).toBe(3);
    expect(doc.selected).toBe(1);
    expect(currentSprite(doc).every((v) => v === DEFAULT_SPRITE_TRANSPARENCY)).toBe(true);
  });

  it("removes the selected sprite", () => {
    const doc = removeSprite(selectSprite(docOf(1, 2, 3), 1));
    expect(sheet(doc)).toEqual([1, 3]);
    expect(doc.selected).toBe(1);
  });

  it("keeps the selection in range after removing the last sprite in the sheet", () => {
    const doc = removeSprite(selectSprite(docOf(1, 2, 3), 2));
    expect(sheet(doc)).toEqual([1, 2]);
    expect(doc.selected).toBe(1);
  });

  it("refuses to remove the only sprite", () => {
    const start = docOf(1);
    expect(removeSprite(start)).toBe(start);
  });

  it("moves left and right, following the sprite", () => {
    let doc = selectSprite(docOf(1, 2, 3), 2);
    doc = moveSpriteLeft(doc);
    expect(sheet(doc)).toEqual([1, 3, 2]);
    expect(doc.selected).toBe(1);
    doc = moveSpriteRight(doc);
    expect(sheet(doc)).toEqual([1, 2, 3]);
    expect(doc.selected).toBe(2);
  });

  it("does not move past either end", () => {
    const first = docOf(1, 2);
    expect(moveSpriteLeft(first)).toBe(first);
    const last = selectSprite(docOf(1, 2), 1);
    expect(moveSpriteRight(last)).toBe(last);
  });

  it("undoes and redoes every sheet operation, restoring the selection", () => {
    for (const op of [duplicateSprite, addSprite, removeSprite, moveSpriteRight]) {
      const start = selectSprite(docOf(1, 2, 3), 1);
      const changed = op(start);
      const back = undo(changed);
      expect(sheet(back)).toEqual([1, 2, 3]);
      expect(back.selected).toBe(1);
      expect(sheet(redo(back))).toEqual(sheet(changed));
      expect(redo(back).selected).toBe(changed.selected);
    }
  });
});

describe("sprite-document: the undo stack", () => {
  it("reports what it can do", () => {
    const start = docOf(1);
    expect(canUndo(start)).toBe(false);
    expect(canRedo(start)).toBe(false);
    const one = applyPixels(start, sprite(2));
    expect(canUndo(one)).toBe(true);
    expect(canRedo(one)).toBe(false);
    expect(canRedo(undo(one))).toBe(true);
  });

  it("is a no-op at either end", () => {
    const start = docOf(1);
    expect(undo(start)).toBe(start);
    expect(redo(start)).toBe(start);
  });

  it("drops the redo tail when a new edit is made after an undo", () => {
    let doc = docOf(1);
    doc = applyPixels(doc, sprite(2));
    doc = applyPixels(doc, sprite(3));
    doc = undo(doc); // back to 2, with 3 on the redo tail
    expect(canRedo(doc)).toBe(true);
    doc = applyPixels(doc, sprite(4));
    expect(canRedo(doc)).toBe(false);
    expect(sheet(doc)).toEqual([4]);
    expect(sheet(undo(doc))).toEqual([2]);
  });

  it("walks a mixed history of pixel and sheet edits back to the start", () => {
    let doc = docOf(11, 22);
    doc = applyPixels(doc, sprite(99));
    doc = duplicateSprite(doc);
    doc = applyPixels(doc, sprite(77));
    doc = selectSprite(doc, 0);
    doc = removeSprite(doc);

    expect(sheet(doc)).toEqual([77, 22]);
    doc = undo(doc);
    expect(sheet(doc)).toEqual([99, 77, 22]);
    doc = undo(doc);
    expect(sheet(doc)).toEqual([99, 99, 22]);
    doc = undo(doc);
    expect(sheet(doc)).toEqual([99, 22]);
    doc = undo(doc);
    expect(sheet(doc)).toEqual([11, 22]);
    expect(canUndo(doc)).toBe(false);
  });

  it("caps the history", () => {
    let doc = docOf(0);
    for (let i = 1; i <= UNDO_LIMIT + 20; i++) doc = applyPixels(doc, sprite(i % 250));
    expect(doc.edits.length).toBe(UNDO_LIMIT);
    expect(doc.undoIndex).toBe(UNDO_LIMIT - 1);
  });
});

describe("sprite-document: construction", () => {
  it("guarantees at least one sprite", () => {
    expect(createDocument([]).sprites.length).toBe(1);
    expect(createDocument(undefined as unknown as Uint8Array[]).sprites.length).toBe(1);
  });

  it("clamps a restored selection that no longer exists", () => {
    expect(createDocument([sprite(1), sprite(2)], 77).selected).toBe(1);
  });
});

describe("sprite-document: moveSprite", () => {
  it("moves a sprite forward, and the selection follows it", () => {
    // `to` is an insertion point: "before the sprite currently at index 3".
    const doc = moveSprite(docOf(1, 2, 3, 4), 0, 3);
    expect(sheet(doc)).toEqual([2, 3, 1, 4]);
    expect(doc.selected).toBe(2);
  });

  it("moves a sprite backward", () => {
    const doc = moveSprite(docOf(1, 2, 3, 4), 3, 1);
    expect(sheet(doc)).toEqual([1, 4, 2, 3]);
    expect(doc.selected).toBe(1);
  });

  it("moves a sprite to the very end", () => {
    const doc = moveSprite(docOf(1, 2, 3), 0, 3);
    expect(sheet(doc)).toEqual([2, 3, 1]);
    expect(doc.selected).toBe(2);
  });

  it("moves a sprite to the very front", () => {
    const doc = moveSprite(docOf(1, 2, 3), 2, 0);
    expect(sheet(doc)).toEqual([3, 1, 2]);
    expect(doc.selected).toBe(0);
  });

  it("treats a drop on either side of itself as no move at all", () => {
    // The two cases a drag produces constantly, and neither should push an undo entry.
    const start = docOf(1, 2, 3);
    expect(moveSprite(start, 1, 1)).toBe(start);
    expect(moveSprite(start, 1, 2)).toBe(start);
  });

  it("ignores an out-of-range source and clamps the target", () => {
    const start = docOf(1, 2, 3);
    expect(moveSprite(start, 9, 0)).toBe(start);
    expect(moveSprite(start, -1, 0)).toBe(start);
    expect(sheet(moveSprite(start, 0, 99))).toEqual([2, 3, 1]);
  });

  it("is one undoable edit that restores both order and selection", () => {
    const start = selectSprite(docOf(1, 2, 3, 4), 3);
    const moved = moveSprite(start, 0, 3);
    expect(sheet(moved)).toEqual([2, 3, 1, 4]);
    const back = undo(moved);
    expect(sheet(back)).toEqual([1, 2, 3, 4]);
    expect(back.selected).toBe(3);
    expect(sheet(redo(back))).toEqual([2, 3, 1, 4]);
  });

  it("agrees with moveSpriteRight over a single step", () => {
    const start = selectSprite(docOf(1, 2, 3), 0);
    expect(sheet(moveSprite(start, 0, 2))).toEqual(sheet(moveSpriteRight(start)));
  });
});
