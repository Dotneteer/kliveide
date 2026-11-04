/*
 * The main process's one `zxnext-rtc.json` (`.ai/zxnext-rtc.md` D5, D8), in the
 * Klive home, with the `nextRtcKept` app state following it.
 */

import path from "path";

import { MI_ZXNEXT } from "@common/machines/constants";
import { setNextRtcKeptAction } from "@common/state/actions";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { nextProfileOf } from "@emu/machines/zxNext/nextProfiles";

import { mainStore } from "./main-store";
import { getKliveHomeBase } from "./portable";
import { KLIVE_HOME_FOLDER } from "./settings";
import { NextRtcStoreFile } from "./zxnext-rtc-store";

export const nextRtcStore = new NextRtcStoreFile(
  () => path.join(getKliveHomeBase(), KLIVE_HOME_FOLDER),
  (state) => mainStore.dispatch(setNextRtcKeptAction(state), "main")
);

/** The running Next's model, or undefined when another machine runs */
function runningNextProfileId(): string | undefined {
  const emu = mainStore.getState()?.emulatorState;
  return emu?.machineId === MI_ZXNEXT ? nextProfileOf(emu.modelId).id : undefined;
}

/** The Kept clock row's "Set to host time" (D8): the running Next's clock shows the host's time */
export async function nextRtcSetToHost(): Promise<void> {
  if (!runningNextProfileId()) return;
  await getEmuApi().issueMachineCommand("custom", "rtcSetToHost");
}

/** The Kept clock row's "Forget" (D8): the model's entry goes; the running clock is cleared */
export async function nextRtcForget(): Promise<void> {
  const profileId = runningNextProfileId();
  if (!profileId) return;
  nextRtcStore.forget(profileId);
  await getEmuApi().issueMachineCommand("custom", "rtcForget");
}
