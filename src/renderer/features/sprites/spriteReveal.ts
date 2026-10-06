/*
 * `show-sprites <n>` and `show-patterns <n>` ask the Sprite Inspector to show a view and select a
 * sprite or a pattern (`.plans/SPRITE_INSPECTOR_PLAN.md` D11). The document may not be mounted yet
 * when the command runs, so the request is held until a listener takes it.
 */

export type SpriteRevealRequest = {
  view: "sprites" | "patterns";
  /** The sprite (`0..127`) or the 8-bit pattern slot (`0..63`) to select */
  index?: number;
};

type Listener = (request: SpriteRevealRequest) => void;

let pending: SpriteRevealRequest | undefined;
const listeners = new Set<Listener>();

/** Ask the Sprite Inspector to show a view, optionally selecting an item in it. */
export function requestSpriteReveal(request: SpriteRevealRequest): void {
  if (listeners.size === 0) {
    pending = request;
    return;
  }
  listeners.forEach((l) => l(request));
}

/** Subscribe the mounted document; a request made before it mounted is delivered at once. */
export function onSpriteReveal(listener: Listener): () => void {
  listeners.add(listener);
  if (pending !== undefined) {
    const request = pending;
    pending = undefined;
    listener(request);
  }
  return () => listeners.delete(listener);
}
