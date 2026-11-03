import { describe, expect, it } from "vitest";

import type { AppState } from "@common/state/AppState";
import { SETTINGS_ROWS } from "@common/settings/settings-pages";
import { rowViewModel } from "@renderer/appIde/dialogs/settings/SettingsViewModel";
import type { SettingsState } from "@renderer/appIde/dialogs/settings/SettingsModel";

/*
 * The Kept clock row as the Settings dialog shows it (`.plans/ZXNEXT_RTC_OPTIONS_PLAN.md` D8): the
 * last save as its description, Forget enabled only while the running model has a kept clock.
 */

const kept = SETTINGS_ROWS.find((r) => r.id === "nextRtcKept")!;
const stateOf = (appState: Record<string, unknown>): SettingsState => ({
  page: "machine",
  query: "",
  env: { appState: appState as unknown as AppState, platform: { isWindows: false } }
});

describe("the Kept clock row", () => {
  it("without a kept clock: says so, Forget disabled, Set to host time enabled", () => {
    const vm = rowViewModel(kept, stateOf({ emulatorState: { machineId: "zxnext", modelId: "ks2-30204" } }));
    expect(vm.description).toBe("No clock kept yet");
    expect(vm.buttons.map((b) => [b.label, b.enabled])).toEqual([
      ["Set to host time", true],
      ["Forget", false]
    ]);
  });

  it("with one: the last save and the model, both buttons enabled", () => {
    const vm = rowViewModel(
      kept,
      stateOf({
        emulatorState: { machineId: "zxnext", modelId: "ks2-30204" },
        nextRtcKept: { "ks2-30204": { savedAt: new Date(2026, 10, 3, 10, 42).getTime() } }
      })
    );
    expect(vm.description).toMatch(/^Last saved .* · ZX Spectrum Next \(KS2, core 3\.02\.04\)$/);
    expect(vm.buttons.every((b) => b.enabled)).toBe(true);
  });
});
