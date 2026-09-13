import { SpritePatch } from "./sprite-selection";

/**
 * What the sprite editor has on its clipboard.
 *
 * **Two clipboards, because they hold different things.** A whole 256-byte sprite goes into the
 * sheet; a rectangle of pixels goes into the current sprite. `Ctrl+X/C/V` act on whichever is
 * active - a pixel region if one is selected, the sprite otherwise - so there is one key set rather
 * than a modifier for each.
 *
 * **Module-level, not per-document**, so a sprite or a region can be carried from one open `.spr`
 * to another. It is deliberately *not* the system clipboard: moving pixels between two documents in
 * the same window is the case that actually comes up, and a real system-clipboard format would have
 * to answer what an outside application should receive, which is a separate design question (see
 * the plan's §4.7).
 *
 * A tiny store rather than a bare variable, so the Paste controls can enable themselves the moment
 * something is copied - including from another document.
 */

export type SpriteClipboard = {
  sprite?: Uint8Array;
  region?: SpritePatch;
};

let contents: SpriteClipboard = {};
const listeners = new Set<() => void>();

const publish = (next: SpriteClipboard) => {
  contents = next;
  listeners.forEach((l) => l());
};

export const spriteClipboard = {
  get: (): SpriteClipboard => contents,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Put a whole sprite on the clipboard. Copies, so a later edit cannot change what was copied. */
  putSprite: (sprite: Uint8Array) => publish({ sprite: new Uint8Array(sprite) }),
  /** Put a pixel rectangle on the clipboard. */
  putRegion: (region: SpritePatch) =>
    publish({ region: { ...region, pixels: new Uint8Array(region.pixels) } }),
  clear: () => publish({})
};

/** Test seam: the store is module state, so a suite has to be able to reset it. */
export const resetSpriteClipboard = () => publish({});
