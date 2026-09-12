import { SPRITE_SIZE } from "./sprite-raster";
import { DEFAULT_SPRITE_TRANSPARENCY, createEmptySprite } from "./sprite-file";

/**
 * The sprite sheet and its undo history, as a value.
 *
 * Everything here is `(doc, ...) => SpriteDocument`: no React, no `context`, no persistence. The
 * editor previously spread this state over four places that had to be kept in step by hand -
 * `selectedSpriteIndex`, `spriteMap`, `editStack`/`editStackIndex`, and the live
 * `context.fileInfo.sprites` array - and every one of the bugs below is a place where they came
 * apart:
 *
 * - **An undone pixel edit landed on whichever sprite was selected at the time of the undo.** The
 *   edit record carried no sprite index, and undo wrote through the "current selection" path. Draw
 *   on sprite 1, click sprite 3, press undo, and sprite 3 was overwritten with sprite 1's old
 *   bitmap. `PixelEdit.index` is the fix, and it is why the edit type is a discriminated union
 *   rather than a bag of optional fields.
 * - **Undo, redo and Cut never reached the disk.** Each mutated the sprite array directly and
 *   returned without scheduling a write, so deleting a sprite did not persist until some unrelated
 *   later edit happened to rewrite the file. Here, *every* operation returns a new document and
 *   the caller has exactly one place to persist from.
 *
 * **Invariant: sprite buffers are immutable once stored.** Every operation that changes pixels
 * replaces the array element with a new `Uint8Array` rather than writing through the old one. The
 * shallow `slice()` copies of the sprite list in a `ListEdit` are only safe because of this, and
 * `sprite-raster.ts` is copy-on-write for the same reason.
 *
 * **Invariant: a sheet always holds at least one sprite.** `parseSprFile` establishes it and
 * `removeSprite` refuses to break it.
 */

/** A pixel change to one identified sprite. */
export type PixelEdit = {
  kind: "pixels";
  /** Which sprite this edit belongs to. Its absence was the cross-sprite corruption bug. */
  index: number;
  before: Uint8Array;
  after: Uint8Array;
};

/** A change to the sheet itself - add, duplicate, remove, reorder. */
export type ListEdit = {
  kind: "list";
  before: Uint8Array[];
  after: Uint8Array[];
  beforeSelected: number;
  afterSelected: number;
};

export type SpriteEdit = PixelEdit | ListEdit;

export type SpriteDocument = {
  sprites: Uint8Array[];
  selected: number;
  /** Oldest first. Everything after `undoIndex` is the redo tail. */
  edits: SpriteEdit[];
  /** Index of the last *applied* edit; -1 when there is nothing to undo. */
  undoIndex: number;
};

/**
 * How many edits are remembered.
 *
 * A pixel edit holds two 256-byte buffers, so the pixel history costs at most ~64 KB; a list edit
 * holds two arrays of references, which is negligible. The cap exists because the old stack had
 * none at all, not because the memory was a problem.
 */
export const UNDO_LIMIT = 128;

const clampIndex = (value: number, length: number): number =>
  Math.min(length - 1, Math.max(0, Number.isFinite(value) ? Math.round(value) : 0));

export function createDocument(sprites: Uint8Array[], selected = 0): SpriteDocument {
  const list = sprites?.length ? sprites : [createEmptySprite()];
  return { sprites: list, selected: clampIndex(selected, list.length), edits: [], undoIndex: -1 };
}

export const canUndo = (doc: SpriteDocument): boolean => doc.undoIndex >= 0;
export const canRedo = (doc: SpriteDocument): boolean => doc.undoIndex < doc.edits.length - 1;

/** The sprite currently being edited. Never undefined - see the at-least-one invariant. */
export const currentSprite = (doc: SpriteDocument): Uint8Array => doc.sprites[doc.selected];

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** Drop the redo tail, append, and cap. */
function pushEdit(doc: SpriteDocument, edit: SpriteEdit): SpriteEdit[] {
  const kept = doc.edits.slice(0, doc.undoIndex + 1);
  kept.push(edit);
  return kept.length > UNDO_LIMIT ? kept.slice(kept.length - UNDO_LIMIT) : kept;
}

const withEdit = (doc: SpriteDocument, edit: SpriteEdit, next: Partial<SpriteDocument>) => {
  const edits = pushEdit(doc, edit);
  return { ...doc, ...next, edits, undoIndex: edits.length - 1 };
};

/** Select a sprite. Not an undoable edit - navigation is not a change. */
export function selectSprite(doc: SpriteDocument, index: number): SpriteDocument {
  const selected = clampIndex(index, doc.sprites.length);
  return selected === doc.selected ? doc : { ...doc, selected };
}

/**
 * Record a completed pixel change to the selected sprite.
 *
 * A change that paints nothing returns the document untouched, so a click with a tool that draws
 * nothing - or a drag cancelled with Escape - cannot push an undo entry or trigger a write.
 */
export function applyPixels(doc: SpriteDocument, after: Uint8Array): SpriteDocument {
  const index = doc.selected;
  const before = doc.sprites[index];
  if (!before || sameBytes(before, after)) return doc;

  const sprites = doc.sprites.slice();
  sprites[index] = after;
  return withEdit(doc, { kind: "pixels", index, before, after }, { sprites });
}

/** Shared shape for the four operations that change the sheet. */
function applyList(
  doc: SpriteDocument,
  sprites: Uint8Array[],
  selected: number
): SpriteDocument {
  const afterSelected = clampIndex(selected, sprites.length);
  return withEdit(
    doc,
    {
      kind: "list",
      before: doc.sprites.slice(),
      after: sprites.slice(),
      beforeSelected: doc.selected,
      afterSelected
    },
    { sprites, selected: afterSelected }
  );
}

/**
 * Insert a copy of the selected sprite **after** it, and select the copy.
 *
 * Both this and `addSprite` used to insert *before* the selection, which is the opposite of every
 * list UI.
 */
export function duplicateSprite(doc: SpriteDocument): SpriteDocument {
  const sprites = doc.sprites.slice();
  const at = doc.selected + 1;
  sprites.splice(at, 0, new Uint8Array(doc.sprites[doc.selected]));
  return applyList(doc, sprites, at);
}

/** Insert a blank sprite after the selection, and select it. */
export function addSprite(
  doc: SpriteDocument,
  fillIndex = DEFAULT_SPRITE_TRANSPARENCY
): SpriteDocument {
  const sprites = doc.sprites.slice();
  const at = doc.selected + 1;
  sprites.splice(at, 0, createEmptySprite(fillIndex));
  return applyList(doc, sprites, at);
}

/** Remove the selected sprite. A no-op on the last one: a sheet always holds at least one. */
export function removeSprite(doc: SpriteDocument): SpriteDocument {
  if (doc.sprites.length < 2) return doc;
  const sprites = doc.sprites.slice();
  sprites.splice(doc.selected, 1);
  return applyList(doc, sprites, Math.min(doc.selected, sprites.length - 1));
}

function swap(doc: SpriteDocument, a: number, b: number): SpriteDocument {
  if (a < 0 || b < 0 || a >= doc.sprites.length || b >= doc.sprites.length) return doc;
  const sprites = doc.sprites.slice();
  [sprites[a], sprites[b]] = [sprites[b], sprites[a]];
  return applyList(doc, sprites, b);
}

export const moveSpriteLeft = (doc: SpriteDocument): SpriteDocument =>
  swap(doc, doc.selected, doc.selected - 1);

export const moveSpriteRight = (doc: SpriteDocument): SpriteDocument =>
  swap(doc, doc.selected, doc.selected + 1);

/**
 * Step back one edit.
 *
 * Undoing a pixel edit also **selects the sprite it belongs to**. That is the other half of the
 * cross-sprite fix: applying the change to the right sprite is not enough if the user is left
 * looking at a different one and sees nothing happen.
 */
export function undo(doc: SpriteDocument): SpriteDocument {
  if (!canUndo(doc)) return doc;
  const edit = doc.edits[doc.undoIndex];
  const next = { ...doc, undoIndex: doc.undoIndex - 1 };
  if (edit.kind === "pixels") {
    const sprites = doc.sprites.slice();
    sprites[edit.index] = edit.before;
    return { ...next, sprites, selected: clampIndex(edit.index, sprites.length) };
  }
  return { ...next, sprites: edit.before.slice(), selected: edit.beforeSelected };
}

export function redo(doc: SpriteDocument): SpriteDocument {
  if (!canRedo(doc)) return doc;
  const edit = doc.edits[doc.undoIndex + 1];
  const next = { ...doc, undoIndex: doc.undoIndex + 1 };
  if (edit.kind === "pixels") {
    const sprites = doc.sprites.slice();
    sprites[edit.index] = edit.after;
    return { ...next, sprites, selected: clampIndex(edit.index, sprites.length) };
  }
  return { ...next, sprites: edit.after.slice(), selected: edit.afterSelected };
}

/** Flatten to the bytes a `.spr` holds. `serializeSprFile` adds any preserved tail. */
export const totalBytes = (doc: SpriteDocument): number => doc.sprites.length * SPRITE_SIZE;
