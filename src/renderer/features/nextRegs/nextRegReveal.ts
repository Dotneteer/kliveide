/*
 * `show-nextregs <reg>` (and the sidebar panel's pop-out, for the row the reader was looking at) asks
 * the Next Registers document to reveal a register. The document may not be mounted yet when the
 * command runs, so the request is held until a listener takes it — the Copper List's
 * `copperReveal` pattern.
 */

type Listener = (id: number) => void;

let pending: number | undefined;
const listeners = new Set<Listener>();

/** Ask the Next Registers document to select a register and scroll it into view. */
export function requestNextRegReveal(id: number): void {
  if (listeners.size === 0) {
    pending = id & 0xff;
    return;
  }
  listeners.forEach((l) => l(id & 0xff));
}

/** Subscribe the mounted document; a request made before it mounted is delivered at once. */
export function onNextRegReveal(listener: Listener): () => void {
  listeners.add(listener);
  if (pending !== undefined) {
    const id = pending;
    pending = undefined;
    listener(id);
  }
  return () => {
    listeners.delete(listener);
  };
}
