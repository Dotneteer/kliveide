/*
 * `show-layer2 [displayed|shadow|window]` asks the Layer 2 Inspector to show a source
 * (`.plans/LAYER2_INSPECTOR_PLAN.md` §4.4). The document may not be mounted yet when the command runs,
 * so the request is held until a listener takes it.
 */

export type Layer2Source = "displayed" | "shadow" | "window";

export type Layer2RevealRequest = { source?: Layer2Source };

type Listener = (request: Layer2RevealRequest) => void;

let pending: Layer2RevealRequest | undefined;
const listeners = new Set<Listener>();

/** Ask the Layer 2 Inspector to show a source. */
export function requestLayer2Reveal(request: Layer2RevealRequest): void {
  if (listeners.size === 0) {
    pending = request;
    return;
  }
  listeners.forEach((l) => l(request));
}

/** Subscribe the mounted document; a request made before it mounted is delivered at once. */
export function onLayer2Reveal(listener: Listener): () => void {
  listeners.add(listener);
  if (pending !== undefined) {
    const request = pending;
    pending = undefined;
    listener(request);
  }
  return () => listeners.delete(listener);
}
