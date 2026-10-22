import type { MachineMenuRenderer } from "@common/machines/info-types";

import { MachineControllerState } from "@common/abstractions/MachineControllerState";
import { getEmuApi } from "@common/messaging/MainToEmuMessenger";
import { mainStore } from "@main/main-store";
import { t } from "@common/i18n/i18n";

/**
 * The HT-1080Z's hardware items (`.plans/HT1080Z_PLAN.md` §7, §11): the RESET key on the back panel,
 * an NMI that takes BASIC back to READY with the memory kept. It is not the IDE's reset, which
 * powers the machine on again. The video switches and the tape join in Phases 6 and 8.
 */
export const ht1080zHardwareRenderer: MachineMenuRenderer = () => {
  const execState = mainStore.getState()?.emulatorState?.machineState;
  return [
    { type: "separator" },
    {
      id: "ht1080z_reset_key",
      label: t("menu.ht1080z.resetKey"),
      enabled: execState === MachineControllerState.Running,
      click: async () => {
        await getEmuApi().issueMachineCommand("custom", "reset_key");
      }
    }
  ];
};
