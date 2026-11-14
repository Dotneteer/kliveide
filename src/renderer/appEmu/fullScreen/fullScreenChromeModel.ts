/*
 * When the emulator's full screen mode shows its toolbar and status bar
 * (`dev/plans/EMU_FULL_SCREEN_MODE_PLAN.md` §2.3). Pure: no DOM, no timers, so every rule is tested
 * with a fake clock (`test/emu/full-screen-chrome-model.test.ts`). `useFullScreenChrome` feeds it.
 *
 * Each edge bar walks the same four phases:
 *
 *   hidden --(pointer in the edge zone)--> pending --(still there after the dwell)--> shown
 *   shown  --(pointer off the bar, nothing holding it)--> leaving --(after the grace)--> hidden
 *
 * A pending bar whose pointer leaves the zone drops back to hidden, so a mouse crossing the edge on
 * its way elsewhere does not flash the bar; a leaving bar the pointer returns to is shown again.
 */

/** How close to the window's edge the pointer must be, in CSS pixels */
export const REVEAL_ZONE_PX = 4;

/** How long the pointer must stay in the zone before the bar slides in, in ms */
export const REVEAL_DWELL_MS = 120;

/** How long a bar stays after the pointer left it, in ms */
export const HIDE_GRACE_MS = 600;

export type EdgePhase = "hidden" | "pending" | "shown" | "leaving";

export type EdgeState = {
  phase: EdgePhase;
  /** When the current phase started (the clock of the inputs) */
  since: number;
};

export type ChromeState = {
  toolbar: EdgeState;
  statusBar: EdgeState;
};

export type ChromeInputs = {
  /** The pointer's distance from the window's top, or `undefined` while it is outside the window */
  pointerY?: number;
  /** The window's height in CSS pixels */
  windowHeight: number;
  /** The pointer is over the toolbar (or a popup that belongs to it) */
  overToolbar: boolean;
  /** The pointer is over the status bar (or a popup that belongs to it) */
  overStatusBar: boolean;
  /** Something keeps the bars where they are: an open popup menu or a dialog */
  held: boolean;
  /** The machine has captured the mouse: no reveal, and a revealed bar goes */
  captured: boolean;
  /**
   * How far below the top edge the toolbar sits, in CSS pixels: the macOS menu bar slides down over
   * the top edge, and the toolbar is revealed under it. The pointer on the menu bar keeps the toolbar.
   */
  topInset?: number;
};

export const INITIAL_CHROME_STATE: ChromeState = {
  toolbar: { phase: "hidden", since: 0 },
  statusBar: { phase: "hidden", since: 0 }
};

/** Whether the pointer is in the top or the bottom reveal zone */
export function inRevealZone(edge: "top" | "bottom", inputs: ChromeInputs): boolean {
  const y = inputs.pointerY;
  if (y === undefined) return false;
  return edge === "top" ? y < REVEAL_ZONE_PX : y >= inputs.windowHeight - REVEAL_ZONE_PX;
}

function stepEdge(
  prev: EdgeState,
  inZone: boolean,
  over: boolean,
  inputs: ChromeInputs,
  now: number
): EdgeState {
  const to = (phase: EdgePhase): EdgeState =>
    phase === prev.phase ? prev : { phase, since: now };

  // --- A held bar (popup, dialog) stays as it is: shown stays shown, hidden stays hidden
  if (inputs.held) {
    if (prev.phase === "leaving") return to("shown");
    if (prev.phase === "pending") return to("hidden");
    return prev;
  }
  if (inputs.captured || inputs.pointerY === undefined) return to("hidden");

  const keep = inZone || over;
  switch (prev.phase) {
    case "hidden":
      return inZone ? to("pending") : prev;
    case "pending":
      if (!inZone) return to("hidden");
      return now - prev.since >= REVEAL_DWELL_MS ? to("shown") : prev;
    case "shown":
      return keep ? prev : to("leaving");
    case "leaving":
      if (keep) return to("shown");
      return now - prev.since >= HIDE_GRACE_MS ? to("hidden") : prev;
  }
}

/**
 * The next state of both bars
 * @param prev The current state
 * @param inputs What the pointer and the window are doing now
 * @param now The clock (ms)
 */
export function stepChrome(prev: ChromeState, inputs: ChromeInputs, now: number): ChromeState {
  // --- Above the toolbar is the macOS menu bar (or nothing): a pointer there is on its way to the bar
  const aboveToolbar = inputs.pointerY !== undefined && inputs.pointerY < (inputs.topInset ?? 0);
  const toolbar = stepEdge(
    prev.toolbar,
    inRevealZone("top", inputs),
    inputs.overToolbar || aboveToolbar,
    inputs,
    now
  );
  const statusBar = stepEdge(
    prev.statusBar,
    inRevealZone("bottom", inputs),
    inputs.overStatusBar,
    inputs,
    now
  );
  return toolbar === prev.toolbar && statusBar === prev.statusBar ? prev : { toolbar, statusBar };
}

/** Whether a bar in this phase is on screen (a leaving bar is still shown until its grace ends) */
export function isEdgeVisible(edge: EdgeState): boolean {
  return edge.phase === "shown" || edge.phase === "leaving";
}

/** When the state changes next with no new input, or `undefined` if it does not */
export function nextDeadline(state: ChromeState): number | undefined {
  const deadlineOf = (edge: EdgeState): number | undefined =>
    edge.phase === "pending"
      ? edge.since + REVEAL_DWELL_MS
      : edge.phase === "leaving"
        ? edge.since + HIDE_GRACE_MS
        : undefined;
  const deadlines = [deadlineOf(state.toolbar), deadlineOf(state.statusBar)].filter(
    (d): d is number => d !== undefined
  );
  return deadlines.length ? Math.min(...deadlines) : undefined;
}
