/**
 * THE single registry of the emulator screen's zoom steps, a sibling of `font-sizes.ts`.
 *
 * The emulator screen is not zoomed to a level the user picks: `useEmulatorScreen` fits it to the
 * panel and snaps that fit *down* to a multiple it is allowed to land on. This setting is the size
 * of that multiple - the granularity of the snap, not the zoom itself:
 *
 *   - `1`    -> 1x, 2x, 3x, ...      Every source pixel is a whole number of device pixels, on any
 *                                    display. The purist option, and the only one that is exact at
 *                                    a device pixel ratio of 1.
 *   - `0.5`  -> 1x, 1.5x, 2x, ...    The default. Fills a panel noticeably better than whole steps,
 *                                    and stays pixel-exact on a 2x (HiDPI) display.
 *   - `0.25` -> 1x, 1.25x, 1.5x, ... Finest fit. Exact only at a device pixel ratio of 4, so on
 *                                    lesser displays the quarter rungs resample and read slightly
 *                                    softer. That is the trade the option exists to offer.
 *
 * The View menu is built from this list by `main/app-menu.ts`, and the renderer reads the same
 * values through `SETTING_EMU_ZOOM_STEP`, so the two cannot drift.
 */

/** The zoom step sizes Klive offers. Persisted verbatim as the setting's value. */
export type ZoomStep = 1 | 0.5 | 0.25;

export type ZoomStepOption = {
  /** Label shown in View | Screen Zoom Steps. */
  label: string;
  /** The step size, persisted in the settings file. */
  value: ZoomStep;
};

/**
 * The ladder, coarsest first.
 *
 * The examples are part of the labels on purpose: "Half Steps" alone does not say whether the half
 * is of the zoom or of the screen, and the menu is the only place this is ever explained.
 */
export const ZOOM_STEPS: ZoomStepOption[] = [
  { label: "Whole Steps (1x, 2x, 3x)", value: 1 },
  { label: "Half Steps (1x, 1.5x, 2x)", value: 0.5 },
  { label: "Quarter Steps (1x, 1.25x, 1.5x)", value: 0.25 }
];

/** Half steps: a better fit than whole steps, still exact on the HiDPI displays most people use. */
export const DEFAULT_ZOOM_STEP: ZoomStep = 0.5;

/**
 * Coerce a persisted (or mocked, or hand-edited) setting value to a step this code can use.
 *
 * Settings files are editable by hand and older ones simply lack the key, so anything that is not
 * one of the three rungs falls back to the default rather than reaching the arithmetic below.
 * Strings are accepted because a hand-written `"0.5"` is the likeliest way this gets typed wrong.
 */
export function normalizeZoomStep(value: unknown): ZoomStep {
  const numeric = typeof value === "string" ? Number.parseFloat(value) : value;
  const match = ZOOM_STEPS.find((s) => s.value === numeric);
  return match ? match.value : DEFAULT_ZOOM_STEP;
}

/**
 * Snap the largest fit of `native` into `available` down to a multiple of `step`.
 *
 * Working in step units and dividing back is the same arithmetic the whole-pixel `Math.floor` did
 * before this setting existed - at `step === 1` it is that expression exactly - so the established
 * behaviour is the coarsest rung rather than a separate code path.
 *
 * **`native` is the size the picture occupies on screen, aspect ratio already applied** - not the
 * machine's raw pixel buffer. The Next's buffer is 640 wide at an `xRatio` of 0.5, so it occupies
 * 320: snapping the raw 640 multiple and dividing the aspect out afterwards doubles the grid back
 * and turns half steps into whole ones. The ratio the user watches stepping is the one that has to
 * land on the ladder.
 *
 * The result may be below 1 (a panel smaller than the machine's picture); clamping is the caller's,
 * because each axis is clamped on its own before the smaller of the two is taken.
 */
export function snapToZoomStep(available: number, native: number, step: ZoomStep): number {
  if (!Number.isFinite(available) || !(native > 0)) return 0;
  const perWhole = 1 / step;
  return Math.floor((available * perWhole) / native) / perWhole;
}
