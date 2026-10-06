/*
 * `show-copper <index>` asks the Copper List document to reveal a slot. The document may not be
 * mounted yet when the command runs, so the request is held until a listener takes it.
 */

type Listener = (index: number) => void;

let pending: number | undefined;
const listeners = new Set<Listener>();

/** Ask the Copper List to reveal (select and scroll to) a list index. */
export function requestCopperReveal(index: number): void {
  if (listeners.size === 0) {
    pending = index & 0x3ff;
    return;
  }
  listeners.forEach((l) => l(index & 0x3ff));
}

/** Subscribe the mounted document; a request made before it mounted is delivered at once. */
export function onCopperReveal(listener: Listener): () => void {
  listeners.add(listener);
  if (pending !== undefined) {
    const index = pending;
    pending = undefined;
    listener(index);
  }
  return () => listeners.delete(listener);
}
