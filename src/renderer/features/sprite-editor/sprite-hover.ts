/**
 * Where the pointer is on the sprite grid, as an external store.
 *
 * The position readout used to live in `SpriteEditor`'s own state: the grid called
 * `onPositionChange` from `onMouseEnter`, which set three `useState` values in the component that
 * also owns the palette, both toolbars and the sprite strip. Moving the pointer one pixel therefore
 * re-rendered all of them - and, because `currentColorIndex` was mirrored into the persisted view
 * state, it also dispatched into Redux once per pixel.
 *
 * A readout is not application state; it is a value one small component displays. Keeping it here
 * lets `SpriteStatusBar` subscribe on its own through `useSyncExternalStore` while the editor above
 * it renders exactly as often as the *document* changes, which is what §5 of the plan asks for.
 */

export type HoverInfo = {
  row: number;
  col: number;
  /** Palette index under the pointer. */
  colorIndex: number;
};

export type HoverStore = {
  get: () => HoverInfo | undefined;
  set: (value: HoverInfo | undefined) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createHoverStore(): HoverStore {
  let value: HoverInfo | undefined;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      // Identity matters: `useSyncExternalStore` re-renders whenever the snapshot changes, so a
      // repeated position must return the *same* object rather than an equal one.
      if (
        next === value ||
        (next &&
          value &&
          next.row === value.row &&
          next.col === value.col &&
          next.colorIndex === value.colorIndex)
      ) {
        return;
      }
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
