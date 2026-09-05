import {
  RAM_CHANGE_WARNING,
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
    warning: showsRestartWarning(state) ? RAM_CHANGE_WARNING : undefined,
    // --- Ok stays available for a no-op selection: it is how the user dismisses
    // --- the dialog having decided to change nothing.
    applyEnabled: !state.busy
  };
}
