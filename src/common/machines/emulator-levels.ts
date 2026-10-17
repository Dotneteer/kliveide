/*
 * The clock multipliers and sound levels the emulator offers. Machine › Speed and Machine › Sound,
 * the status bar's speed popup and the toolbar's sound dropdown all read these, so they cannot drift
 * apart (`.plans/MENU_REDESIGN_PLAN.md` §5).
 */
import { t } from "@common/i18n/i18n";
import { withLabels } from "@common/i18n/labels";
import type { MessageKey } from "@common/i18n/keys.generated";
export const CLOCK_MULTIPLIERS = [1, 2, 4, 6, 8, 10, 12, 16, 20, 24];

export const SOUND_LEVELS = withLabels<{ value: number; labelKey: MessageKey }>([
  { value: 0.0, labelKey: "common.sound.mute" },
  { value: 0.2, labelKey: "common.sound.low" },
  { value: 0.4, labelKey: "common.sound.medium" },
  { value: 0.8, labelKey: "common.sound.high" },
  { value: 1.0, labelKey: "common.sound.highest" }
]);

/** The label of a clock multiplier */
export function clockMultiplierLabel(multiplier: number): string {
  return multiplier === 1 ? t("common.speed.normal") : t("common.speed.multiplier", { multiplier });
}
