/*
 * `show-tilemap <col> <row>` and `show-tiles <n>` ask the Tilemap Inspector to show a view and select
 * a cell or a tile (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.4, Q2). The document may not be mounted yet
 * when the command runs, so the request is held until a listener takes it.
 */

export type TilemapRevealRequest =
  | { view: "map"; cell?: { col: number; row: number } }
  | { view: "tiles"; tile?: number };

type Listener = (request: TilemapRevealRequest) => void;

let pending: TilemapRevealRequest | undefined;
const listeners = new Set<Listener>();

/** Ask the Tilemap Inspector to show a view, optionally selecting an item in it. */
export function requestTilemapReveal(request: TilemapRevealRequest): void {
  if (listeners.size === 0) {
    pending = request;
    return;
  }
  listeners.forEach((l) => l(request));
}

/** Subscribe the mounted document; a request made before it mounted is delivered at once. */
export function onTilemapReveal(listener: Listener): () => void {
  listeners.add(listener);
  if (pending !== undefined) {
    const request = pending;
    pending = undefined;
    listener(request);
  }
  return () => listeners.delete(listener);
}
