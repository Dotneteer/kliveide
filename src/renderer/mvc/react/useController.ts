import { useEffect, useRef } from "react";

/**
 * Creates a controller once per component instance and disposes it on unmount.
 *
 * The factory runs during render, not in an effect, so the first render already
 * has a view model to paint — a controller created in `useEffect` would force
 * every view to handle an "undefined yet" state that never really exists.
 */
export function useController<
  TController extends { activate(): void; dispose(): void }
>(factory: () => TController): TController {
  const controllerRef = useRef<TController>();
  if (!controllerRef.current) {
    controllerRef.current = factory();
  }

  useEffect(() => {
    const controller = controllerRef.current;
    // --- Setup, not just cleanup. React re-runs effects after tearing them
    // --- down — always under StrictMode in development — and the controller
    // --- has to come back to life when it does, or every later intent is
    // --- silently dropped and the view freezes mid-operation.
    controller?.activate();
    return () => controller?.dispose();
  }, []);

  return controllerRef.current;
}
