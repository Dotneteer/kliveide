import path from "path";
import fs from "fs";

import { app, BrowserWindow, dialog } from "electron";
import { mainStore } from "@main/main-store";
import { logEmuEvent, setMachineType } from "@main/registeredMachines";
import { getSettingValue, saveAppSettings, setSettingValue } from "@main/settings-utils";
import { incMenuVersionAction } from "@state/actions";
import { SETTING_EMU_SCORPION_ROM } from "@common/settings/setting-const";
import { SCORPION_ROM_SIZE } from "@emu/machines/zxSpectrum128/ScorpionWasmV2Machine";
import { t } from "@common/i18n/i18n";

/**
 * The Scorpion ZS-256's 64K ROM (`.plans/TIMEX_SCORPION_PLAN.md` P5): Klive cannot ship it, so the
 * user names their own copy; without one the Scorpion boots the 128K ROMs and takes TR-DOS from the
 * TR-DOS ROM setting. Chosen in Settings › Machine; choosing or forgetting it restarts the machine.
 */
export async function forgetScorpionRom(): Promise<void> {
  setSettingValue(SETTING_EMU_SCORPION_ROM, "");
  await restartForScorpionRom("Scorpion ROM cleared: the 128K ROMs boot");
}

/** Asks for the Scorpion ROM and restarts the machine with it */
export async function selectScorpionRomFile(emuWindow: BrowserWindow): Promise<void> {
  const current = getSettingValue(SETTING_EMU_SCORPION_ROM) as string | undefined;
  const dialogResult = await dialog.showOpenDialog(emuWindow, {
    title: t("messages.rom.selectScorpion"),
    defaultPath: current ? path.dirname(current) : app.getPath("home"),
    filters: [
      { name: t("common.filter.romFiles"), extensions: ["rom", "bin"] },
      { name: t("common.filter.allFiles"), extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;
  const filename = dialogResult.filePaths[0];
  const size = fs.statSync(filename).size;
  if (size !== SCORPION_ROM_SIZE) {
    dialog.showErrorBox(
      t("messages.rom.notScorpion"),
      t("messages.rom.wrongScorpionSize", { size: SCORPION_ROM_SIZE, file: filename, actual: size })
    );
    return;
  }
  setSettingValue(SETTING_EMU_SCORPION_ROM, filename);
  await restartForScorpionRom(`Scorpion ROM set to ${filename}`);
}

/** Rebuilds the machine, which reads the ROM setting when it starts */
async function restartForScorpionRom(message: string): Promise<void> {
  const emulatorState = mainStore.getState()?.emulatorState;
  await setMachineType(emulatorState?.machineId, emulatorState?.modelId, emulatorState?.config ?? {});
  mainStore.dispatch(incMenuVersionAction());
  saveAppSettings();
  await logEmuEvent(message);
}
