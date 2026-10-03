/*
 * "Reveal this breakpoint in the Breakpoints panel" (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md`
 * W4): a Watch row's watchpoint indicator asks, the panel - when mounted - scrolls to the row and
 * marks it. A plain listener set: the request is a UI gesture, not state to persist or share.
 */

type RevealListener = (storageKey: string) => void;

const listeners = new Set<RevealListener>();

/** Ask the Breakpoints panel to show the breakpoint with this storage key. */
export function requestBreakpointReveal(storageKey: string): void {
  for (const listener of listeners) listener(storageKey);
}

/** Listen for reveal requests; returns the unsubscribe function. */
export function onBreakpointReveal(listener: RevealListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
