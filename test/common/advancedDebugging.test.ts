import { describe, expect, it } from "vitest";

import type { AppState } from "@common/state/AppState";
import {
  ADVANCED_DEBUGGING_OFF_MESSAGE,
  ADVANCED_DEBUGGING_SETTING,
  hasMachineFeature,
  isAdvancedDebuggingEnabled,
  readAdvancedDebuggingSetting
} from "@common/features/advancedDebugging";
import { MF_EXEC_HISTORY, MF_REVERSE_DEBUG, MF_TAPE_SUPPORT } from "@common/machines/constants";
import { createSettingsReader } from "@common/utils/SettingsReader";
import { emulatorStateReducer } from "@common/state/emulator-state-reducer";
import { setAdvancedDebuggingAction } from "@common/state/actions";
import { isSettingsRowApplicable, SETTINGS_ROWS } from "@common/settings/settings-pages";
import { historyEmptyMessage } from "@renderer/features/history/historyViewModel";

/*
 * The advanced-debugging feature switch (G4 + G5): one user setting, off unless set, read once at
 * startup into `emulatorState.advancedDebugging`; off, the group's machine features read as absent.
 */

const state = (advancedDebugging?: boolean) => ({ emulatorState: { advancedDebugging } }) as AppState;
const userSetting = (value: unknown) =>
  createSettingsReader({ userSettings: value === undefined ? {} : { features: { advancedDebugging: value } } } as AppState);

describe("advanced-debugging switch - the setting", () => {
  it("is named features.advancedDebugging", () => {
    expect(ADVANCED_DEBUGGING_SETTING).toBe("features.advancedDebugging");
  });

  it("is off unless the user turns it on", () => {
    expect(readAdvancedDebuggingSetting(userSetting(undefined))).toBe(false);
    for (const off of ["0", "false", "no", 0, false, ""]) expect(readAdvancedDebuggingSetting(userSetting(off))).toBe(false);
    for (const on of ["1", "true", "yes", 1, true]) expect(readAdvancedDebuggingSetting(userSetting(on))).toBe(true);
  });

  it("reaches the shared state through its action", () => {
    expect(emulatorStateReducer({} as any, setAdvancedDebuggingAction(true)).advancedDebugging).toBe(true);
    expect(isAdvancedDebuggingEnabled(state(true))).toBe(true);
    expect(isAdvancedDebuggingEnabled(state(false))).toBe(false);
    expect(isAdvancedDebuggingEnabled(state(undefined))).toBe(false);
    expect(isAdvancedDebuggingEnabled(undefined)).toBe(false);
  });

  it("tells the user how to turn it on", () => {
    expect(ADVANCED_DEBUGGING_OFF_MESSAGE).toContain("set -u features.advancedDebugging 1");
    expect(ADVANCED_DEBUGGING_OFF_MESSAGE).toMatch(/restart/i);
  });
});

describe("advanced-debugging switch - machine features", () => {
  const machine = { features: { [MF_EXEC_HISTORY]: true, [MF_REVERSE_DEBUG]: true, [MF_TAPE_SUPPORT]: true } };

  it("hides the group's features while off, and only those", () => {
    expect(hasMachineFeature(machine, MF_EXEC_HISTORY, state(false))).toBe(false);
    expect(hasMachineFeature(machine, MF_REVERSE_DEBUG, state(false))).toBe(false);
    expect(hasMachineFeature(machine, MF_TAPE_SUPPORT, state(false))).toBe(true);
  });

  it("leaves them to the machine while on", () => {
    expect(hasMachineFeature(machine, MF_EXEC_HISTORY, state(true))).toBe(true);
    expect(hasMachineFeature({ features: {} }, MF_EXEC_HISTORY, state(true))).toBe(false);
    expect(hasMachineFeature(undefined, MF_EXEC_HISTORY, state(true))).toBe(false);
  });
});

describe("advanced-debugging switch - the views", () => {
  it("hides the reverse-debugging settings rows while off", () => {
    const rows = SETTINGS_ROWS.filter((r) => r.group === "Reverse debugging");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(isSettingsRowApplicable(row, state(false))).toBe(false);
      expect(isSettingsRowApplicable(row, state(true))).toBe(true);
    }
  });

  it("the Execution History document says how to turn it on", () => {
    expect(historyEmptyMessage({ supported: false, running: false, debugging: false, switchedOff: true }, undefined)).toBe(
      ADVANCED_DEBUGGING_OFF_MESSAGE
    );
  });
});
