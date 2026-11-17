import type { MachineFavorite } from "@common/machines/machine-favorites";

/**
 * What the main process hands the Select Machine dialog (`MACHINE_SELECT_DIALOG`).
 * The catalogue itself is read from `machineRegistry` in the renderer.
 */
export type MachineSelectDialogData = {
  /** The favourites now in the menu, normalised */
  favorites: MachineFavorite[];
  /** The machine running now */
  current?: { machineId: string; modelId?: string };
  /**
   * The models whose files must be downloaded before they run (a ZX Spectrum Next's SD card,
   * NEXT_SD_CARDS_PLAN phase 5): `favoriteKey` -> the download's size in bytes
   */
  downloadNeeded?: Record<string, number>;
};

/**
 * What the dialog returns; `undefined` means cancelled. The dialog has no side effects: the main
 * process stores `favorites` and performs `switchTo` (plan §5.3).
 */
export type MachineSelectDialogResult = {
  /** Present only when the favourites changed */
  favorites?: MachineFavorite[];
  /** Present when the user asked to switch machines */
  switchTo?: { machineId: string; modelId?: string };
};
