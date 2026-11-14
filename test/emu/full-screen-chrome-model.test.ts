import { describe, expect, it } from "vitest";
import {
  ChromeInputs,
  ChromeState,
  HIDE_GRACE_MS,
  INITIAL_CHROME_STATE,
  isEdgeVisible,
  nextDeadline,
  REVEAL_DWELL_MS,
  REVEAL_ZONE_PX,
  stepChrome
} from "@renderer/appEmu/fullScreen/fullScreenChromeModel";

/*
 * When the emulator's full screen mode shows its toolbar and status bar
 * (`dev/plans/EMU_FULL_SCREEN_MODE_PLAN.md` §2.3), with a fake clock.
 */

const H = 800;

function inputs(over: Partial<ChromeInputs> = {}): ChromeInputs {
  return {
    pointerY: H / 2,
    windowHeight: H,
    overToolbar: false,
    overStatusBar: false,
    held: false,
    captured: false,
    ...over
  };
}

const AT_TOP = { pointerY: 0 };
const AT_BOTTOM = { pointerY: H - 1 };

/** Steps the model through `[time, inputs]` pairs and returns the final state */
function run(steps: [number, Partial<ChromeInputs>][], from: ChromeState = INITIAL_CHROME_STATE) {
  let state = from;
  for (const [now, over] of steps) state = stepChrome(state, inputs(over), now);
  return state;
}

/** A state with the toolbar fully revealed at t=1000 */
function toolbarShown(): ChromeState {
  return run([
    [1000, AT_TOP],
    [1000 + REVEAL_DWELL_MS, AT_TOP]
  ]);
}

describe("full screen chrome model", () => {
  it("starts with both bars hidden", () => {
    expect(INITIAL_CHROME_STATE.toolbar.phase).toBe("hidden");
    expect(INITIAL_CHROME_STATE.statusBar.phase).toBe("hidden");
    expect(nextDeadline(INITIAL_CHROME_STATE)).toBeUndefined();
  });

  it("reveals the toolbar after the dwell at the top edge", () => {
    const pending = run([[1000, AT_TOP]]);
    expect(pending.toolbar.phase).toBe("pending");
    expect(isEdgeVisible(pending.toolbar)).toBe(false);
    expect(nextDeadline(pending)).toBe(1000 + REVEAL_DWELL_MS);

    const early = stepChrome(pending, inputs(AT_TOP), 1000 + REVEAL_DWELL_MS - 1);
    expect(early.toolbar.phase).toBe("pending");

    const shown = stepChrome(pending, inputs(AT_TOP), 1000 + REVEAL_DWELL_MS);
    expect(shown.toolbar.phase).toBe("shown");
    expect(shown.statusBar.phase).toBe("hidden");
  });

  it("reveals the status bar after the dwell at the bottom edge", () => {
    const state = run([
      [1000, AT_BOTTOM],
      [1000 + REVEAL_DWELL_MS, AT_BOTTOM]
    ]);
    expect(state.statusBar.phase).toBe("shown");
    expect(state.toolbar.phase).toBe("hidden");
  });

  it("uses a zone of REVEAL_ZONE_PX at each edge", () => {
    expect(run([[0, { pointerY: REVEAL_ZONE_PX - 1 }]]).toolbar.phase).toBe("pending");
    expect(run([[0, { pointerY: REVEAL_ZONE_PX }]]).toolbar.phase).toBe("hidden");
    expect(run([[0, { pointerY: H - REVEAL_ZONE_PX }]]).statusBar.phase).toBe("pending");
    expect(run([[0, { pointerY: H - REVEAL_ZONE_PX - 1 }]]).statusBar.phase).toBe("hidden");
  });

  it("does not flash a bar when the pointer only crosses the edge", () => {
    const state = run([
      [1000, AT_TOP],
      [1050, { pointerY: 200 }],
      [1000 + REVEAL_DWELL_MS + 10, { pointerY: 200 }]
    ]);
    expect(state.toolbar.phase).toBe("hidden");
  });

  it("keeps a revealed bar while the pointer is over it", () => {
    const state = run(
      [
        [2000, { pointerY: 20, overToolbar: true }],
        [9000, { pointerY: 20, overToolbar: true }]
      ],
      toolbarShown()
    );
    expect(state.toolbar.phase).toBe("shown");
  });

  it("hides a bar after the grace once the pointer has left it", () => {
    const leaving = run([[2000, { pointerY: 300 }]], toolbarShown());
    expect(leaving.toolbar.phase).toBe("leaving");
    expect(isEdgeVisible(leaving.toolbar)).toBe(true);
    expect(nextDeadline(leaving)).toBe(2000 + HIDE_GRACE_MS);

    expect(stepChrome(leaving, inputs({ pointerY: 300 }), 2000 + HIDE_GRACE_MS - 1).toolbar.phase).toBe(
      "leaving"
    );
    expect(stepChrome(leaving, inputs({ pointerY: 300 }), 2000 + HIDE_GRACE_MS).toolbar.phase).toBe(
      "hidden"
    );
  });

  it("shows a leaving bar again when the pointer comes back", () => {
    const state = run(
      [
        [2000, { pointerY: 300 }],
        [2100, { pointerY: 10, overToolbar: true }]
      ],
      toolbarShown()
    );
    expect(state.toolbar.phase).toBe("shown");
  });

  it("holds a revealed bar while a popup or a dialog is open", () => {
    const held = run(
      [
        [2000, { pointerY: 300, held: true }],
        [9000, { pointerY: 300, held: true }]
      ],
      toolbarShown()
    );
    expect(held.toolbar.phase).toBe("shown");

    // --- Released: the usual grace follows
    const released = stepChrome(held, inputs({ pointerY: 300 }), 9500);
    expect(released.toolbar.phase).toBe("leaving");
  });

  it("does not reveal a bar while something holds the bars", () => {
    expect(run([[0, { ...AT_TOP, held: true }], [500, { ...AT_TOP, held: true }]]).toolbar.phase).toBe(
      "hidden"
    );
  });

  it("never reveals while the mouse is captured, and hides a revealed bar at once", () => {
    expect(
      run([
        [0, { ...AT_TOP, captured: true }],
        [500, { ...AT_TOP, captured: true }]
      ]).toolbar.phase
    ).toBe("hidden");
    expect(run([[2000, { pointerY: 10, overToolbar: true, captured: true }]], toolbarShown()).toolbar.phase).toBe(
      "hidden"
    );
  });

  it("hides at once when the pointer leaves the window", () => {
    const state = run([[2000, { pointerY: undefined }]], toolbarShown());
    expect(state.toolbar.phase).toBe("hidden");
  });

  it("runs the two bars independently", () => {
    const both = run(
      [
        [3000, AT_BOTTOM],
        [3000 + REVEAL_DWELL_MS, AT_BOTTOM]
      ],
      toolbarShown()
    );
    // --- The pointer went from the top to the bottom: the toolbar is on its way out
    expect(both.toolbar.phase).toBe("leaving");
    expect(both.statusBar.phase).toBe("shown");
    expect(nextDeadline(both)).toBe(3000 + HIDE_GRACE_MS);
  });

  it("keeps the toolbar while the pointer is on the macOS menu bar above it", () => {
    // --- The toolbar sits 30px down, under the menu bar; the pointer rests on the menu bar
    const state = run(
      [
        [2000, { pointerY: 12, topInset: 30 }],
        [9000, { pointerY: 12, topInset: 30 }]
      ],
      toolbarShown()
    );
    expect(state.toolbar.phase).toBe("shown");
    // --- Below the toolbar the usual grace applies
    expect(stepChrome(state, inputs({ pointerY: 300, topInset: 30 }), 9100).toolbar.phase).toBe("leaving");
  });

  it("reveals the toolbar only from the top edge, not from the menu bar's whole height", () => {
    expect(run([[0, { pointerY: 12, topInset: 30 }], [500, { pointerY: 12, topInset: 30 }]]).toolbar.phase).toBe(
      "hidden"
    );
  });

  it("returns the same object when nothing changes", () => {
    const state = toolbarShown();
    expect(stepChrome(state, inputs({ pointerY: 10, overToolbar: true }), 5000)).toBe(state);
  });
});
