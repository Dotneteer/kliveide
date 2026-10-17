import { t } from "@common/i18n/i18n";
import {
  RAM_SIZES,
  showsRestartWarning,
  type RamSizeOption,
  type Z88ChangeRamState
} from "./Z88ChangeRamModel";

// ─── View model shape ────────────────────────────────────────────────────────

export type Z88ChangeRamViewModel = {
  ramSize: {
    options: RamSizeOption[];
    value: string;
  };
  // --- Undefined rather than an empty string: the row is absent, not blank.
  warning?: string;
  applyEnabled: boolean;
};

// ─── Formatters ──────────────────────────────────────────────────────────────

/** The warning shown when applying the new size would stop a running machine */
export function ramChangeWarning(): string {
  return t("dialog.z88.changeRam.warning");
}

// ─── Selector ────────────────────────────────────────────────────────────────

/**
 * Everything the view renders, derived from state alone.
 *
 * Pure and reference-compared: `UiController` memoizes it on state identity.
 */
export function selectViewModel(state: Z88ChangeRamState): Z88ChangeRamViewModel {
  return {
    ramSize: {
      options: RAM_SIZES,
      value: state.selectedSize
    },
    warning: showsRestartWarning(state) ? ramChangeWarning() : undefined,
    // --- Ok stays available for a no-op selection: it is how the user dismisses
    // --- the dialog having decided to change nothing.
    applyEnabled: !state.busy
  };
}
