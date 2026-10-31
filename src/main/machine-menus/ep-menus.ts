import fs from "fs";
import path from "path";

import type { MachineMenuItem, MachineMenuRenderer } from "@common/machines/info-types";

import { MC_EP_CARTRIDGE, MC_EP_HOSTFS, MC_EP_PALETTE } from "@common/machines/constants";
import { getModelConfig } from "@common/machines/machine-registry";
import { t } from "@common/i18n/i18n";
import { EP_FILEIO_HOME_FOLDER } from "@emu/machines/enterprise/EpMainFileStore";
import { mainStore } from "@main/main-store";
import { saveKliveProject } from "@main/projects";
import { getKliveHomeBase } from "@main/portable";
import { KLIVE_HOME_FOLDER } from "@main/settings";
import { logEmuEvent, setMachineType } from "@main/registeredMachines";
import { incMenuVersionAction } from "@state/actions";
import { shell } from "electron";

/**
 * The Enterprise 64/128's hardware items (`.plans/ENTERPRISE_PLAN.md` §4.3, §11): the IS-BASIC
 * cartridge in its slot (`MC_EP_CARTRIDGE`; without it EXOS boots to the word processor), Klive's
 * FILE: device ROM (`MC_EP_HOSTFS`) and the folder its files live in, and the palette's levels
 * (`MC_EP_PALETTE`: the board's resistor DAC, or the guide's linear formula). Each switch restarts
 * the machine with the new configuration.
 */
export const epHardwareRenderer: MachineMenuRenderer = (_windowInfo, _machine, model, config) => {
  const effective = config ?? mainStore.getState()?.emulatorState?.config ?? model?.config;
  const cartridge = effective?.[MC_EP_CARTRIDGE] !== false;
  const hostFs = effective?.[MC_EP_HOSTFS] !== false;
  const linear = effective?.[MC_EP_PALETTE] === "linear";
  const items: MachineMenuItem[] = [
    { type: "separator" },
    {
      id: "ep_cartridge",
      label: t("menu.ep.cartridge"),
      type: "checkbox",
      checked: cartridge,
      click: async () => {
        await setEpConfig(MC_EP_CARTRIDGE, cartridge ? false : undefined, cartridge ? "IS-BASIC cartridge removed" : "IS-BASIC cartridge inserted");
      }
    },
    {
      id: "ep_hostfs",
      label: t("menu.ep.hostFs"),
      type: "checkbox",
      checked: hostFs,
      click: async () => {
        await setEpConfig(MC_EP_HOSTFS, hostFs ? false : undefined, hostFs ? "FILE: device removed" : "FILE: device fitted");
      }
    },
    {
      id: "ep_hostfs_folder",
      label: t("menu.ep.openFileFolder"),
      enabled: hostFs,
      click: async () => {
        const folder = path.join(getKliveHomeBase(), KLIVE_HOME_FOLDER, EP_FILEIO_HOME_FOLDER);
        fs.mkdirSync(folder, { recursive: true });
        await shell.openPath(folder);
      }
    },
    { type: "separator" },
    {
      id: "ep_linear_palette",
      label: t("menu.ep.linearPalette"),
      type: "checkbox",
      checked: linear,
      click: async () => {
        await setEpConfig(MC_EP_PALETTE, linear ? undefined : "linear", linear ? "Resistor DAC palette" : "Linear palette");
      }
    }
  ];
  return items;
};

/** Sets one configuration key (undefined: the default) and restarts the machine with it */
async function setEpConfig(key: string, value: unknown, event: string): Promise<void> {
  const emulatorState = mainStore.getState()?.emulatorState;
  const machineId = emulatorState?.machineId;
  const modelId = emulatorState?.modelId;
  if (!machineId) return;
  const config = { ...(emulatorState?.config ?? getModelConfig(machineId, modelId) ?? {}) };
  if (value === undefined) delete config[key];
  else config[key] = value;
  await setMachineType(machineId, modelId, config);
  mainStore.dispatch(incMenuVersionAction());
  await saveKliveProject();
  await logEmuEvent(event);
}
