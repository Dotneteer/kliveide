/**
 * THE single registry of the emulator's mouse-capture settings, a sibling of `zoom-steps.ts`.
 *
 * Klive hands the host mouse to the emulated machine through the Pointer Lock API: while captured,
 * the host cursor is hidden and the browser reports only *relative* movement, which is the only
 * thing a Kempston mouse can use (its hardware counters are relative and wrap; the guest draws its
 * own pointer). Capture is off by default - turning it on changes what a click on the emulator
 * screen does, which is not something to spring on someone who never asked for a mouse.
 *
 * The Mouse menu is built from these values by `main/app-menu.ts` and the renderer reads the same
 * ids through `useGlobalSetting`, so the two cannot drift.
 */

/** Host-side multiplier applied to the raw pointer movement before it reaches the machine. */
export type MouseSensitivity = 0.25 | 0.5 | 1 | 1.5 | 2;

export type MouseSensitivityOption = {
  /** Label shown in the Mouse | Sensitivity submenu. */
  label: string;
  /** The multiplier, persisted in the settings file. */
  value: MouseSensitivity;
};

/**
 * The ladder, slowest first.
 *
 * This is a *host* multiplier and deliberately separate from the machine's own DPI setting
 * (NextReg `$0A` bits 1-0), which the emulated core applies to every packet on its own. Sensitivity
 * changes how far the user's hand has to travel; DPI is the guest's business and software may
 * change it at any moment. Conflating them would let a Klive setting silently alter what a program
 * believes its mouse is doing.
 *
 * **It stops at 2x, and that is not timidity.** The two multipliers compose: with DPI `00` - which
 * doubles, and which software sets freely - a host 2x already moves the machine's pointer four
 * times as far as the hand. A 4x rung was offered at first and was unusable in practice, because in
 * that pairing it means 8x. Anyone who genuinely wants more can reach for it through the guest's
 * own DPI, where the program can see it.
 */
export const MOUSE_SENSITIVITIES: MouseSensitivityOption[] = [
  { label: "Very Slow (0.25x)", value: 0.25 },
  { label: "Slow (0.5x)", value: 0.5 },
  { label: "Normal (1x)", value: 1 },
  { label: "Fast (1.5x)", value: 1.5 },
  { label: "Fastest (2x)", value: 2 }
];

/** 1:1 with the host pointer - the machine's own DPI setting does the rest. */
export const DEFAULT_MOUSE_SENSITIVITY: MouseSensitivity = 1;

/**
 * Capture is opt-in.
 *
 * Capture hides the host cursor and gives it to the machine until Esc is pressed, so it is never
 * something to spring on someone: it is off until asked for, and even then it only ever happens on
 * an explicit action - the toolbar button or Ctrl+M. Capturing on a click on the picture was tried
 * and removed, because clicking the screen is what someone does to focus the window or bring the
 * status pill back.
 */
export const DEFAULT_MOUSE_CAPTURE_ENABLED = false;

/**
 * When Klive draws its own pointer over the screen while the mouse is captured.
 *
 * `"unused"` hides it as soon as software starts reading the mouse ports, on the grounds that the
 * program is drawing its own pointer and two that disagree are worse than one. That is a nice idea
 * and a poor default: the two pointers drifting apart is exactly what someone wants to *see* when
 * checking whether movement is being delivered correctly, and a hidden indicator looks like a
 * broken one. `"always"` is therefore the default, and hiding is the option.
 */
export type MousePointerDisplay = "always" | "unused" | "never";

export type MousePointerDisplayOption = {
  label: string;
  value: MousePointerDisplay;
};

export const MOUSE_POINTER_DISPLAYS: MousePointerDisplayOption[] = [
  { label: "Always", value: "always" },
  { label: "Only while no program reads the mouse", value: "unused" },
  { label: "Never", value: "never" }
];

export const DEFAULT_MOUSE_POINTER_DISPLAY: MousePointerDisplay = "always";

/**
 * Coerce a persisted pointer-display setting.
 *
 * Booleans are accepted because this setting shipped as a checkbox first: `true` meant "show it",
 * which is `"always"`, and `false` meant `"never"`. Anything else falls back to the default.
 */
export function normalizeMousePointerDisplay(value: unknown): MousePointerDisplay {
  if (value === true) return "always";
  if (value === false) return "never";
  const match = MOUSE_POINTER_DISPLAYS.find((d) => d.value === value);
  return match ? match.value : DEFAULT_MOUSE_POINTER_DISPLAY;
}

/**
 * Coerce a persisted (or hand-edited, or missing) sensitivity to one this code can use.
 *
 * Settings files are editable by hand and older ones simply lack the key, so anything that is not
 * one of the rungs falls back to the default. Strings are accepted because a hand-written `"0.5"`
 * is the likeliest way this gets typed wrong.
 */
export function normalizeMouseSensitivity(value: unknown): MouseSensitivity {
  const numeric = typeof value === "string" ? Number.parseFloat(value) : value;
  const match = MOUSE_SENSITIVITIES.find((s) => s.value === numeric);
  return match ? match.value : DEFAULT_MOUSE_SENSITIVITY;
}
