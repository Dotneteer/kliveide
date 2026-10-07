import { describe, expect, it } from "vitest";
import type { AppState } from "@common/state/AppState";
import {
  SETTINGS_PAGES,
  SETTINGS_ROWS,
  isSettingsRowApplicable,
  isSettingsRowLocked,
  readSettingsRowValue,
  settingIdOf,
  settingsRowDefault,
  settingsRowMatches,
  settingsRowOptions
} from "@common/settings/settings-pages";
import { KliveGlobalSettings } from "@common/settings/setting-definitions";
import { machineRegistry } from "@common/machines/machine-registry";
import { MC_DISK_SUPPORT, MC_SCREEN_SIZE, MC_SP48_ROM_FILE, MC_TIMEX_MODEL } from "@common/machines/constants";
import {
  SETTING_EMU_MOUSE_CAPTURE,
  SETTING_EMU_TC2068_ROM,
  SETTING_IDE_SIDEBAR_TO_RIGHT
} from "@common/settings/setting-const";

/*
 * The Settings dialog's content (`.plans/MENU_REDESIGN_PLAN.md` §4): what each row reads, where it
 * applies, and what the search finds.
 */

const row = (id: string) => {
  const found = SETTINGS_ROWS.find((r) => r.id === id);
  if (!found) throw new Error(`No row ${id}`);
  return found;
};

const stateOf = (partial: Record<string, unknown>) => partial as unknown as AppState;
const running = (machineId: string, modelId?: string, config: Record<string, unknown> = {}) =>
  stateOf({ emulatorState: { machineId, modelId, config } });

describe("the settings rows", () => {
  it("have unique ids, and every page has rows", () => {
    expect(new Set(SETTINGS_ROWS.map((r) => r.id)).size).toBe(SETTINGS_ROWS.length);
    for (const page of SETTINGS_PAGES) {
      expect(SETTINGS_ROWS.some((r) => r.page === page.id), page.id).toBe(true);
    }
  });

  it("name only registered settings", () => {
    for (const r of SETTINGS_ROWS) {
      if (r.source?.kind === "setting") expect(KliveGlobalSettings[r.source.settingId], r.id).toBeDefined();
    }
  });

  it("give every select and accent its choices, and every value-less row a button", () => {
    for (const r of SETTINGS_ROWS) {
      if (r.editor === "select" || r.editor === "accent") {
        expect(settingsRowOptions(r, { isWindows: false }).length, r.id).toBeGreaterThan(1);
      }
      if (r.editor === "button" || r.editor === "file") expect(r.buttons?.length, r.id).toBeGreaterThan(0);
      if (r.editor !== "button") expect(r.source, r.id).toBeDefined();
    }
  });

  it("offer every registered setting's default among a select's choices", () => {
    for (const r of SETTINGS_ROWS.filter((x) => x.editor === "select" && x.source?.kind === "setting")) {
      const def = settingsRowDefault(r, undefined);
      const values = settingsRowOptions(r, { isWindows: false }).map((o) => o.value);
      expect(values, r.id).toContain(def);
    }
  });
});

describe("readSettingsRowValue", () => {
  it("reads a stored setting, and the default when none is stored", () => {
    expect(readSettingsRowValue(row("sidebarToRight"), stateOf({ globalSettings: {} }))).toBe(
      KliveGlobalSettings[SETTING_IDE_SIDEBAR_TO_RIGHT].defaultValue
    );
    const stored = stateOf({ globalSettings: { ideViewOptions: { sideBarToRight: true } } });
    expect(readSettingsRowValue(row("sidebarToRight"), stored)).toBe(true);
  });

  it("reads the app-state values", () => {
    const state = stateOf({
      theme: "light",
      accent: "ember",
      keyMappingFile: "/k/my.keymap",
      emulatorState: {
        config: { [MC_SCREEN_SIZE]: "640x256", [MC_SP48_ROM_FILE]: "/r/48.rom" },
        screenRecordingFormat: "webm",
        windowRecordingPointer: false
      }
    });
    expect(readSettingsRowValue(row("theme"), state)).toBe("light");
    expect(readSettingsRowValue(row("accent"), state)).toBe("ember");
    expect(readSettingsRowValue(row("keyMapping"), state)).toBe("/k/my.keymap");
    expect(readSettingsRowValue(row("z88Lcd"), state)).toBe("640x256");
    expect(readSettingsRowValue(row("sp48Rom"), state)).toBe("/r/48.rom");
    expect(readSettingsRowValue(row("recordingFormat"), state)).toBe("webm");
    expect(readSettingsRowValue(row("windowRecordingPointer"), state)).toBe(false);
  });

  it("falls back to the defaults the old menus showed ticked", () => {
    const empty = stateOf({});
    expect(readSettingsRowValue(row("theme"), empty)).toBe("dark");
    expect(readSettingsRowValue(row("recordingQuality"), empty)).toBe("good");
    expect(readSettingsRowValue(row("recordingFps"), empty)).toBe("native");
    expect(readSettingsRowValue(row("windowRecordingIdePosition"), empty)).toBe("left");
    expect(readSettingsRowValue(row("windowRecordingClicks"), empty)).toBe(true);
    expect(readSettingsRowValue(row("windowRecordingHiDpi"), empty)).toBe(false);
  });

  it("reads the running Timex model's own ROM setting", () => {
    const tc2068 = running("timex", undefined, { [MC_TIMEX_MODEL]: "tc2068" });
    expect(settingIdOf(row("timexRom"), tc2068)).toBe(SETTING_EMU_TC2068_ROM);
  });
});

describe("isSettingsRowApplicable", () => {
  it("shows a machine's rows only while it runs", () => {
    expect(isSettingsRowApplicable(row("sp48Rom"), running("sp48"))).toBe(true);
    expect(isSettingsRowApplicable(row("sp48Rom"), running("zxnext"))).toBe(false);
    expect(isSettingsRowApplicable(row("z88Lcd"), running("z88"))).toBe(true);
    expect(isSettingsRowApplicable(row("mouseCapture"), running("zxnext"))).toBe(true);
    expect(isSettingsRowApplicable(row("mouseCapture"), running("sp48"))).toBe(false);
  });

  it("shows the TR-DOS ROM only for a model with a Beta 128", () => {
    const sp128 = machineRegistry.find((m) => m.machineId === "sp128")!;
    const withDisks = sp128.models!.find((m) => (m.config?.[MC_DISK_SUPPORT] ?? 0) > 0)!;
    const withoutDisks = sp128.models!.find((m) => !(m.config?.[MC_DISK_SUPPORT] ?? 0))!;
    expect(isSettingsRowApplicable(row("trdosRom"), running("sp128", withDisks.modelId))).toBe(true);
    expect(isSettingsRowApplicable(row("trdosRom"), running("sp128", withoutDisks.modelId))).toBe(false);
    expect(isSettingsRowApplicable(row("trdosRom"), running("sp48"))).toBe(false);
  });

  it("shows the excluded items only for a Klive project", () => {
    expect(isSettingsRowApplicable(row("excludedItems"), stateOf({ project: { isKliveProject: true } }))).toBe(true);
    expect(isSettingsRowApplicable(row("excludedItems"), stateOf({ project: {} }))).toBe(false);
  });
});

describe("isSettingsRowLocked", () => {
  it("locks the IDE + Emulator options while that recording runs", () => {
    const recording = stateOf({ emulatorState: { windowRecordingState: "recording" } });
    expect(isSettingsRowLocked(row("windowRecordingHiDpi"), recording)).toBe(true);
    expect(isSettingsRowLocked(row("windowRecordingHiDpi"), stateOf({}))).toBe(false);
  });

  it("locks the video options while a video recording runs", () => {
    const recording = stateOf({ emulatorState: { screenRecordingState: "recording" } });
    expect(isSettingsRowLocked(row("recordingFormat"), recording)).toBe(true);
    expect(isSettingsRowLocked(row("recordingFormat"), stateOf({ emulatorState: { screenRecordingState: "idle" } }))).toBe(false);
  });

  it("locks the pointer and sensitivity while mouse capture is off", () => {
    const off = stateOf({ globalSettings: { emuOptions: { mouseCapture: false } } });
    const on = stateOf({ globalSettings: { emuOptions: { mouseCapture: true } } });
    expect(SETTING_EMU_MOUSE_CAPTURE).toBe("emuOptions.mouseCapture");
    expect(isSettingsRowLocked(row("mouseSensitivity"), off)).toBe(true);
    expect(isSettingsRowLocked(row("mouseSensitivity"), on)).toBe(false);
  });
});

describe("settingsRowMatches", () => {
  it("finds a row by its title, its group and its page", () => {
    expect(settingsRowMatches(row("tabSize"), "tab")).toBe(true);
    expect(settingsRowMatches(row("tabSize"), "indentation")).toBe(true);
    expect(settingsRowMatches(row("tabSize"), "editor")).toBe(true);
    expect(settingsRowMatches(row("tabSize"), "joystick")).toBe(false);
  });

  it("finds the new place by the old menu path", () => {
    expect(settingsRowMatches(row("scanlineEffect"), "machine scanline")).toBe(true);
    expect(settingsRowMatches(row("sjasmplus"), "integrations")).toBe(true);
  });

  it("matches everything for an empty search", () => {
    expect(settingsRowMatches(row("tabSize"), "  ")).toBe(true);
  });
});
