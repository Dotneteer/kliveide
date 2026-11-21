import path from "path";

import type { MachineMenuItem, MachineMenuRenderer } from "@common/machines/info-types";

import { getEmuApi } from "@common/messaging/MainToEmuMessenger";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { SETTING_EMU_FAST_LOAD } from "@common/settings/setting-const";
import { MC_DISK_SUPPORT, MC_SAM_DRIVES, MC_SAM_MOUSE, MC_SAM_ROM } from "@common/machines/constants";
import { getModelConfig } from "@common/machines/machine-registry";
import { t } from "@common/i18n/i18n";
import { createBooleanSettingsMenu } from "@main/menus/menu-utils";
import { mainStore } from "@main/main-store";
import { saveKliveProject } from "@main/projects";
import { appSettings } from "@main/settings-utils";
import { logEmuEvent, setMachineType } from "@main/registeredMachines";
import { incMenuVersionAction } from "@state/actions";
import { dialog, app } from "electron";
import { diskMenuRenderer, ejectMediaFile, setSelectedTapeFile } from "./zx-specrum-menus";

const TAPE_FILE_FOLDER = "tapeFileFolder";

/** The machine's configuration as the menu shows it: the running one's, else the model's */
function effectiveConfig(model?: { config?: Record<string, any> }, config?: Record<string, any>): Record<string, any> {
  return config ?? mainStore.getState()?.emulatorState?.config ?? model?.config ?? {};
}

/** The internal drives fitted (`MC_SAM_DRIVES`, 0-2; one by default, as `resolveSamHardware` reads it) */
function drivesOf(config: Record<string, any>): number {
  const drives = Number(config[MC_SAM_DRIVES] ?? 1);
  return Number.isFinite(drives) ? Math.max(0, Math.min(2, Math.trunc(drives))) : 1;
}

/**
 * The SAM Coupé's tape (`dev/plans/SAM_COUPE_PLAN.md` §9.4): a `.tap` or `.tzx` goes in the deck, and plays
 * when the user presses Play or Load and Run types `LOAD ""` (the SAM has no motor control). Fast load
 * runs the machine faster while the tape plays.
 */
export const samTapeMenuRenderer: MachineMenuRenderer = (windowInfo) => {
  const emuWindow = windowInfo.emuWindow;
  const appState = mainStore.getState();
  const items: MachineMenuItem[] = [
    {
      id: "select_tape_file",
      label: t("menu.tape.insert"),
      click: async () => {
        const lastFile = mainStore.getState().media?.[MEDIA_TAPE];
        const defaultPath =
          appSettings?.folders?.[TAPE_FILE_FOLDER] || (lastFile ? path.dirname(lastFile) : app.getPath("home"));
        const result = await dialog.showOpenDialog(emuWindow, {
          title: t("messages.tape.select"),
          defaultPath,
          filters: [
            { name: t("common.filter.tapeFiles"), extensions: ["tap", "tzx"] },
            { name: t("common.filter.allFiles"), extensions: ["*"] }
          ],
          properties: ["openFile"]
        });
        if (result.canceled || result.filePaths.length < 1) return;
        await setSelectedTapeFile(result.filePaths[0]);
        await saveKliveProject();
      }
    },
    {
      id: "load_tape_program",
      label: t("menu.tape.loadAndRun"),
      enabled: !!appState.media?.[MEDIA_TAPE],
      click: async () => {
        await getEmuApi().startTapeLoad(false);
      }
    },
    {
      id: "rewind_tape",
      label: t("menu.tape.rewind"),
      click: async () => {
        await getEmuApi().issueMachineCommand("rewind");
      }
    },
    {
      id: "eject_tape",
      label: t("menu.tape.eject"),
      enabled: !!appState.media?.[MEDIA_TAPE],
      click: async () => {
        await ejectMediaFile(MEDIA_TAPE);
      }
    },
    { type: "separator" },
    createBooleanSettingsMenu(SETTING_EMU_FAST_LOAD, { label: t("menu.tape.fastLoad") }) as any
  ];
  return items;
};

/**
 * The internal disk drives (`dev/plans/SAM_COUPE_PLAN.md` §10): how many are fitted (`MC_SAM_DRIVES`, which
 * restarts the machine), and the fitted drives' items - the Spectrum's disk menu, without its "create a
 * disk" (that makes a +3 image).
 */
export const samDiskMenuRenderer: MachineMenuRenderer = (windowInfo, machine, model, config) => {
  const drives = drivesOf(effectiveConfig(model, config));
  const labels = [t("menu.sam.drivesNone"), t("menu.sam.drivesOne"), t("menu.sam.drivesTwo")];
  const items: MachineMenuItem[] = labels.map((label, count) => ({
    id: `sam_drives_${count}`,
    label,
    type: "radio",
    checked: drives === count,
    click: async () => {
      if (drives === count) return;
      await setSamConfig(MC_SAM_DRIVES, count === 1 ? undefined : count, `Disk drives fitted: ${count}`);
    }
  }));
  if (!drives) return items;
  const disks = diskMenuRenderer(windowInfo, machine, { ...model, config: { [MC_DISK_SUPPORT]: drives } } as any, config);
  const floppy = disks.find((item) => item.id === "floppy_menu");
  const driveItems = (floppy?.submenu ?? []).filter((item) => item.id !== "create_disk_file");
  while (driveItems[0]?.type === "separator") driveItems.shift();
  return [...items, { type: "separator" }, ...driveItems];
};

/**
 * The SAM Coupé's hardware items (`dev/plans/SAM_COUPE_PLAN.md` §4.3): the mouse interface (`MC_SAM_MOUSE`)
 * and the bundled ROM version (`MC_SAM_ROM`: 3.0, the default, or 3.1). Each restarts the machine.
 */
export const samHardwareRenderer: MachineMenuRenderer = (_windowInfo, _machine, model, config) => {
  const effective = effectiveConfig(model, config);
  const mouse = effective[MC_SAM_MOUSE] !== false;
  const rom31 = effective[MC_SAM_ROM] === "31";
  return [
    { type: "separator" },
    {
      id: "sam_mouse",
      label: t("menu.sam.mouse"),
      type: "checkbox",
      checked: mouse,
      click: async () => {
        await setSamConfig(MC_SAM_MOUSE, mouse ? false : undefined, mouse ? "SAM mouse removed" : "SAM mouse fitted");
      }
    },
    { type: "separator" },
    {
      id: "sam_rom_30",
      label: t("menu.sam.rom30"),
      type: "radio",
      checked: !rom31,
      click: async () => {
        if (rom31) await setSamConfig(MC_SAM_ROM, undefined, "SAM ROM 3.0");
      }
    },
    {
      id: "sam_rom_31",
      label: t("menu.sam.rom31"),
      type: "radio",
      checked: rom31,
      click: async () => {
        if (!rom31) await setSamConfig(MC_SAM_ROM, "31", "SAM ROM 3.1");
      }
    }
  ];
};

/** Sets one configuration key (undefined: the default) and restarts the machine with it */
async function setSamConfig(key: string, value: unknown, event: string): Promise<void> {
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
