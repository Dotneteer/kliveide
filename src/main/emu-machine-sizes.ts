import type { Size } from "@common/utils/emu-window-size";
import { isValidSize } from "@common/utils/emu-window-size";
import type { EmuMachineSizeStore } from "./emu-window-sizing";
import { appSettings, saveAppSettings } from "./settings-utils";

/**
 * Each machine's emulator window size, kept in `klive.settings` under
 * `windowStates.emuMachineSizes` (issue #1377): a Z88 reopens compact, a Spectrum at its own size.
 */
export const emuMachineSizeStore: EmuMachineSizeStore = {
  load(machineId: string): Size | undefined {
    const saved = appSettings.windowStates?.emuMachineSizes?.[machineId];
    return isValidSize(saved) ? { width: saved.width, height: saved.height } : undefined;
  },
  save(machineId: string, size: Size): void {
    if (!machineId || !isValidSize(size)) return;
    appSettings.windowStates ??= {};
    appSettings.windowStates.emuMachineSizes ??= {};
    appSettings.windowStates.emuMachineSizes[machineId] = { width: size.width, height: size.height };
    saveAppSettings();
  }
};
