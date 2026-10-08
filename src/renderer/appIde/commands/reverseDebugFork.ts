import type { AppState } from "@common/state/AppState";
import type { Store } from "@common/state/redux-light";
import type { EmuApi } from "@common/messaging/EmuApi";
import type { MainApi } from "@common/messaging/MainApi";
import { forkConfirmation } from "@common/history/reverseDebugText";

/** What the fork confirmation needs: the store, and the two APIs */
export type ForkDeps = {
  store: Store<AppState>;
  emuApi: EmuApi;
  mainApi: MainApi;
};

/** The machine stands in the past of a reverse-debugging timeline (not replaying, not live) */
export function isInThePast(store: Store<AppState>): boolean {
  const state = store.getState().emulatorState?.reverseDebug;
  return !!state?.active && state.mode === "navigating";
}

/**
 * Asks before forking (`.plans/REVERSE_DEBUGGING_PLAN.md` D12, T4) - naming what the discarded future
 * takes with it - and forks when the user agrees
 * @param action What forks: "Take over here", or an edit ("Edit a register")
 * @returns true when the machine forked, false when the user declined
 */
export async function confirmAndTakeOver(deps: ForkDeps, action = "Take over here"): Promise<boolean> {
  const text = forkConfirmation(await deps.emuApi.getForkPreview(), action);
  if (!(await deps.mainApi.confirmAction(text.title, text.message, text.detail, text.confirmLabel))) return false;
  return await deps.emuApi.takeOverHere();
}

/**
 * An edit in the past (D12): the edit changes the past, so the point becomes the present first - after
 * a confirmation. At the present, or without a timeline, there is nothing to ask.
 * @returns false when the user declined: the edit must not happen
 */
export async function takeOverBeforeEdit(deps: ForkDeps, action: string): Promise<boolean> {
  if (!isInThePast(deps.store)) return true;
  if (!(await confirmAndTakeOver(deps, action))) return false;
  return true;
}
