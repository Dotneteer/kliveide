import type { NextPaletteDeviceId } from "./nextPaletteDevices";

/*
 * `show-palettes <device>` asks the Palette document to show a device. The document may not be
 * mounted yet when the command runs, so the request is held until a listener takes it - the Next
 * Registers document's `nextRegReveal` pattern.
 */

type Listener = (device: NextPaletteDeviceId) => void;

let pending: NextPaletteDeviceId | undefined;
const listeners = new Set<Listener>();

/** Ask the Palette document to show a device. */
export function requestPaletteReveal(device: NextPaletteDeviceId): void {
  if (listeners.size === 0) {
    pending = device;
    return;
  }
  listeners.forEach((l) => l(device));
}

/** Subscribe the mounted document; a request made before it mounted is delivered at once. */
export function onPaletteReveal(listener: Listener): () => void {
  listeners.add(listener);
  if (pending !== undefined) {
    const device = pending;
    pending = undefined;
    listener(device);
  }
  return () => {
    listeners.delete(listener);
  };
}
