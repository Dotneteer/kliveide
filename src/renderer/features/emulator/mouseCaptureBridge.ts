/**
 * Lets the toolbar ask the emulator screen to capture the mouse.
 *
 * `useEmulatorMouse` lives in `EmulatorPanel`, and the toolbar is its sibling under `EmuApp` - so
 * the button cannot simply call the hook. A module-level registration is the shape this codebase
 * already uses for exactly that problem (`controls/overlay/dialogRequestBridge.ts`).
 *
 * It is deliberately *not* a round trip through the store. Pointer lock needs transient activation,
 * which belongs to the click being handled right now, so the request has to reach the hook
 * synchronously inside that handler rather than after a state update and a re-render.
 */

/** Captures the mouse. Returns false when nothing was attempted (capture switched off, no screen). */
export type MouseCaptureRequest = () => boolean;

let currentRequest: MouseCaptureRequest | undefined;

/** Called by `useEmulatorMouse` on mount. The returned function unregisters it. */
export function registerMouseCaptureRequest(request: MouseCaptureRequest): () => void {
  currentRequest = request;
  return () => {
    if (currentRequest === request) currentRequest = undefined;
  };
}

/**
 * Ask the screen to capture the mouse.
 *
 * Returns false when no screen is mounted, which is not an error: the toolbar can be on screen
 * while the emulator panel is not.
 */
export function requestMouseCapture(): boolean {
  return currentRequest?.() ?? false;
}
