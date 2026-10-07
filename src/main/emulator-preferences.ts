/*
 * Emulator preferences that live in the app state and the project, changed from the menu, the
 * Settings dialog, the toolbar and the status bar alike (`.plans/MENU_REDESIGN_PLAN.md` §5).
 */
import { CLOCK_MULTIPLIERS, SOUND_LEVELS } from "@common/machines/emulator-levels";
import { setClockMultiplierAction, setSoundLevelAction } from "@state/actions";
import { mainStore } from "./main-store";
import { saveKliveProject } from "./projects";
import { logEmuEvent } from "./registeredMachines";

/** Sets the clock multiplier; values the emulator does not offer are ignored */
export async function setClockMultiplier(multiplier: number): Promise<void> {
  if (!CLOCK_MULTIPLIERS.includes(multiplier)) return;
  mainStore.dispatch(setClockMultiplierAction(multiplier));
  await logEmuEvent(`Clock multiplier set to ${multiplier}`);
  await saveKliveProject();
}

/** Sets the sound level; values the emulator does not offer are ignored */
export async function setSoundLevel(level: number): Promise<void> {
  const option = SOUND_LEVELS.find((l) => l.value === level);
  if (!option) return;
  mainStore.dispatch(setSoundLevelAction(level));
  await logEmuEvent(`Sound level set to ${option.label} (${level})`);
  await saveKliveProject();
}
