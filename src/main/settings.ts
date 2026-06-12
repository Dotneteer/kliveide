import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { cloneDeep, get, set } from "lodash";
import type { Setting } from "../common/settings/Setting";
import { KliveGlobalSettings, getDefaultGlobalSettings } from "../common/settings/setting-definitions";
import { SETTING_EMU_MACHINE_TYPE } from "../common/settings/setting-const";
import { resolveMachineSelection } from "../common/machines/machine-registry";
import {
  setGlobalSettingAction,
  initGlobalSettingsAction,
  setThemeAction,
  setMachineTypeAction,
  setTapeMediaAction,
  clearTapeMediaAction,
  setClockMultiplierAction,
  setSoundLevelAction
} from "../common/state/actions";
import type { MediaState } from "../common/state/AppState";
import type { WindowState } from "./WindowState";
import { mainStore } from "./main-store";

export const KLIVE_HOME_FOLDER = "Klive";
export const SETTINGS_FILE_NAME = "klive2.settings";

export type AppSettings = {
  windowStates?: {
    emuWindow?: WindowState;
    ideWindow?: WindowState;
    showIdeOnStartup?: boolean;
  };
  folders?: Record<string, string>;
  theme?: string;
  globalSettings?: Record<string, unknown>;
  media?: MediaState;
  emulatorState?: {
    clockMultiplier?: number;
    soundLevel?: number;
    savedSoundLevel?: number;
  };
};

export let appSettings: AppSettings = {};
let lastSavedGlobalSettings = "";
let lastSavedEmulatorState = "";
let unsubscribeSettingsPersistence: (() => void) | undefined;

export function loadAppSettings(): void {
  try {
    const settingsPath = getSettingsFilePath();
    if (!fs.existsSync(settingsPath)) {
      appSettings = {
        globalSettings: getDefaultGlobalSettings()
      };
      return;
    }

    appSettings = normalizeAppSettings(JSON.parse(fs.readFileSync(settingsPath, "utf8")) as AppSettings);
  } catch {
    appSettings = {
      globalSettings: getDefaultGlobalSettings()
    };
  }
}

export function saveAppSettings(): void {
  try {
    refreshAppSettingsFromStore();
    const settingsPath = getSettingsFilePath();
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(appSettings, null, 2));
    lastSavedGlobalSettings = stableJson(selectPersistedGlobalSettings(appSettings.globalSettings ?? {}));
    lastSavedEmulatorState = stableJson(selectPersistedEmulatorState(appSettings.emulatorState ?? {}));
  } catch {
    // Settings persistence is best-effort; window closing should never fail on it.
  }
}

export function applyPersistedSettingsToStore(): void {
  const globalSettings = normalizeGlobalSettings(appSettings.globalSettings ?? {});
  const machineSelection = getMachineSelectionFromSettings(globalSettings);

  mainStore.dispatch(setThemeAction(appSettings.theme ?? "dark"), "main");
  mainStore.dispatch(initGlobalSettingsAction(globalSettings), "main");
  mainStore.dispatch(
    setClockMultiplierAction(normalizeClockMultiplier(appSettings.emulatorState?.clockMultiplier)),
    "main"
  );
  mainStore.dispatch(
    setSoundLevelAction(
      normalizeSoundLevel(appSettings.emulatorState?.soundLevel),
      normalizeSavedSoundLevel(appSettings.emulatorState?.savedSoundLevel)
    ),
    "main"
  );
  if (appSettings.media?.tape?.fileName) {
    mainStore.dispatch(setTapeMediaAction(appSettings.media.tape), "main");
  } else {
    mainStore.dispatch(clearTapeMediaAction(), "main");
  }
  mainStore.dispatch(
    setMachineTypeAction(
      machineSelection.machineId,
      machineSelection.modelId,
      machineSelection.config
    ),
    "main"
  );
  lastSavedGlobalSettings = stableJson(selectPersistedGlobalSettings(globalSettings));
  lastSavedEmulatorState = stableJson(selectPersistedEmulatorState(appSettings.emulatorState ?? {}));
}

export function startSettingsPersistence(): void {
  unsubscribeSettingsPersistence?.();
  lastSavedGlobalSettings = stableJson(selectPersistedGlobalSettings(mainStore.getState().globalSettings ?? {}));
  lastSavedEmulatorState = stableJson(selectPersistedEmulatorState(mainStore.getState().emulatorState ?? {}));

  unsubscribeSettingsPersistence = mainStore.subscribe(() => {
    const state = mainStore.getState();
    const nextGlobalSettings = state.globalSettings ?? {};
    const nextPersistedGlobalSettings = selectPersistedGlobalSettings(nextGlobalSettings);
    const nextGlobalSignature = stableJson(nextPersistedGlobalSettings);
    const nextPersistedEmulatorState = selectPersistedEmulatorState(state.emulatorState ?? {});
    const nextEmulatorSignature = stableJson(nextPersistedEmulatorState);

    if (
      nextGlobalSignature !== lastSavedGlobalSettings ||
      nextEmulatorSignature !== lastSavedEmulatorState
    ) {
      appSettings.globalSettings = nextPersistedGlobalSettings;
      appSettings.emulatorState = nextPersistedEmulatorState;
      saveAppSettings();
    }
  });
}

export function stopSettingsPersistence(): void {
  unsubscribeSettingsPersistence?.();
  unsubscribeSettingsPersistence = undefined;
}

export function getSettingDefinition(id: string): Setting | null {
  const setting = KliveGlobalSettings[id];
  return setting ? { ...setting } : null;
}

export function getSettingValue(id: string): unknown {
  const setting = getSettingDefinition(id);
  if (!setting) {
    return undefined;
  }

  return get(mainStore.getState().globalSettings ?? {}, setting.id, setting.defaultValue);
}

export function setSettingValue(id: string, value: unknown): void {
  const setting = getSettingDefinition(id);
  if (!setting) {
    throw new Error(`Unknown setting: ${id}`);
  }

  validateSettingValue(setting, value);

  const currentValue = get(mainStore.getState().globalSettings ?? {}, setting.id, setting.defaultValue);
  if (Object.is(currentValue, value)) {
    return;
  }

  mainStore.dispatch(setGlobalSettingAction(setting.id, value), "main");
}

export function getAllSettingValues(): Record<string, unknown> {
  return normalizeGlobalSettings(mainStore.getState().globalSettings ?? {});
}

export function getSettingsFilePath(): string {
  return path.join(app.getPath("home"), KLIVE_HOME_FOLDER, SETTINGS_FILE_NAME);
}

function normalizeAppSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    theme: settings.theme ?? "dark",
    globalSettings: normalizeGlobalSettings(settings.globalSettings ?? {}),
    media: selectPersistedMedia(settings.media ?? {}),
    emulatorState: {
      clockMultiplier: normalizeClockMultiplier(settings.emulatorState?.clockMultiplier),
      soundLevel: normalizeSoundLevel(settings.emulatorState?.soundLevel),
      savedSoundLevel: normalizeSavedSoundLevel(settings.emulatorState?.savedSoundLevel)
    }
  };
}

function refreshAppSettingsFromStore(): void {
  const state = mainStore.getState();
  appSettings.theme = state.theme;
  appSettings.globalSettings = selectPersistedGlobalSettings(state.globalSettings ?? {});
  appSettings.media = selectPersistedMedia(state.media ?? {});
  appSettings.emulatorState = selectPersistedEmulatorState(state.emulatorState ?? {});
}

function selectPersistedGlobalSettings(globalSettings: Record<string, unknown>): Record<string, unknown> {
  const selected: Record<string, unknown> = {};

  for (const setting of Object.values(KliveGlobalSettings)) {
    if (!setting.persist || setting.volatile) {
      continue;
    }

    const value = get(globalSettings, setting.id, setting.defaultValue);
    set(selected, setting.id, cloneDeep(value));
  }

  return selected;
}

function normalizeGlobalSettings(globalSettings: Record<string, unknown>): Record<string, unknown> {
  const normalized = cloneDeep(getDefaultGlobalSettings());

  for (const setting of Object.values(KliveGlobalSettings)) {
    const value = get(globalSettings, setting.id, globalSettings[setting.id] ?? setting.defaultValue);
    set(normalized, setting.id, cloneDeep(value));
  }

  return normalized;
}

function selectPersistedMedia(media: MediaState): MediaState {
  if (!media.tape?.fileName) {
    return {};
  }

  return {
    tape: {
      fileName: media.tape.fileName,
      displayName: media.tape.displayName,
      size: media.tape.size,
      blockCount: media.tape.blockCount,
      sourceFormat: media.tape.sourceFormat,
      currentBlockIndex: 0,
      status: "rewound",
      warnings: media.tape.warnings
    }
  };
}

function selectPersistedEmulatorState(emulatorState: AppSettings["emulatorState"]): NonNullable<AppSettings["emulatorState"]> {
  return {
    clockMultiplier: normalizeClockMultiplier(emulatorState?.clockMultiplier),
    soundLevel: normalizeSoundLevel(emulatorState?.soundLevel),
    savedSoundLevel: normalizeSavedSoundLevel(emulatorState?.savedSoundLevel)
  };
}

function getMachineSelectionFromSettings(globalSettings: Record<string, unknown>) {
  const value = get(globalSettings, SETTING_EMU_MACHINE_TYPE);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return resolveMachineSelection();
  }

  const selection = value as {
    machineId?: string;
    modelId?: string;
    config?: Record<string, unknown>;
  };
  return resolveMachineSelection(selection.machineId, selection.modelId, selection.config);
}

function normalizeClockMultiplier(value: unknown): number {
  return typeof value === "number" && [1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64].includes(value)
    ? value
    : 1;
}

function normalizeSoundLevel(value: unknown): number {
  return typeof value === "number" && [0.0, 0.2, 0.4, 0.8, 1.0].includes(value)
    ? value
    : 0.8;
}

function normalizeSavedSoundLevel(value: unknown): number {
  return typeof value === "number" && [0.2, 0.4, 0.8, 1.0].includes(value)
    ? value
    : 0.8;
}

function validateSettingValue(setting: Setting, value: unknown): void {
  switch (setting.type) {
    case "string":
      if (typeof value !== "string") {
        throw new Error(`Invalid value for setting ${setting.id}: expected string.`);
      }
      break;
    case "number":
      if (typeof value !== "number") {
        throw new Error(`Invalid value for setting ${setting.id}: expected number.`);
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        throw new Error(`Invalid value for setting ${setting.id}: expected boolean.`);
      }
      break;
    case "array":
      if (!Array.isArray(value)) {
        throw new Error(`Invalid value for setting ${setting.id}: expected array.`);
      }
      break;
    case "object":
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`Invalid value for setting ${setting.id}: expected object.`);
      }
      break;
    case "any":
      break;
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}
