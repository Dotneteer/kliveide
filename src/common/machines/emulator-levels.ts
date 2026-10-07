/*
 * The clock multipliers and sound levels the emulator offers. Machine › Speed and Machine › Sound,
 * the status bar's speed popup and the toolbar's sound dropdown all read these, so they cannot drift
 * apart (`.plans/MENU_REDESIGN_PLAN.md` §5).
 */
export const CLOCK_MULTIPLIERS = [1, 2, 4, 6, 8, 10, 12, 16, 20, 24];

export const SOUND_LEVELS: { value: number; label: string }[] = [
  { value: 0.0, label: "Mute" },
  { value: 0.2, label: "Low" },
  { value: 0.4, label: "Medium" },
  { value: 0.8, label: "High" },
  { value: 1.0, label: "Highest" }
];

/** The label of a clock multiplier */
export function clockMultiplierLabel(multiplier: number): string {
  return multiplier === 1 ? "Normal" : `${multiplier}x`;
}
