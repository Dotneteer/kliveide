import os from "os";
import { app } from "electron";

import type {
  BorielInstallResult,
  BorielSetupDecision,
  BorielSetupStatus
} from "@common/messaging/BorielIntegration";
import { createSettingsReader } from "@common/utils/SettingsReader";
import { applyProjectSettingAction } from "@state/actions";
import { mainStore } from "../main-store";
import { saveKliveProject } from "../projects";
import { appSettings, applyUserSetting, saveAppSettings } from "../settings-utils";
import { get } from "lodash";
import { ZXBC_COMPILER, ZXBC_EXECUTABLE_PATH } from "../zxb-integration/zxb-config";
import { BORIEL_INSTALL_FOLDER, BORIEL_VERSION } from "./boriel-config";
import {
  decideBorielStartup,
  getBorielSetupStatus,
  installBoriel,
  useExistingBoriel,
  type BorielServiceDeps
} from "./boriel-install-service";
import { borielKitLocation, borielPlatformKey, locateBundledKit } from "./boriel-kit";

/*
 * The Electron side of the Boriel BASIC setup: builds the service's dependencies from the running
 * app and writes what an installation decided into the settings (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md`
 * §3.2-§3.4). Everything with logic in it lives in `boriel-install-service.ts`, which the tests drive.
 */

export function borielServiceDeps(): BorielServiceDeps {
  return {
    kitLocation: borielKitLocation(app.isPackaged, process.resourcesPath, app.getAppPath()),
    platformKey: borielPlatformKey(),
    platform: process.platform,
    homeDir: os.homedir(),
    protectedFolders: app.isPackaged ? [process.resourcesPath, app.getAppPath()] : [],
    settings: createSettingsReader(mainStore.getState()),
    setupRecord: appSettings.borielSetup,
    compilerFromProject: get(mainStore.getState().projectSettings, ZXBC_COMPILER) !== undefined
  };
}

/** Makes Klive BASIC or Boriel BASIC the user's compiler of BASIC programs. */
function setBasicCompiler(choice: "klive" | "boriel"): void {
  applyUserSetting(ZXBC_COMPILER, choice);
}

/**
 * Makes `choice` the compiler that builds BASIC programs now (the Settings dialog's row): the open
 * project's setting when the project chooses one, which wins over the user's; else the user's.
 */
export async function setEffectiveBasicCompiler(choice: "klive" | "boriel"): Promise<void> {
  if (get(mainStore.getState().projectSettings, ZXBC_COMPILER) === undefined) {
    setBasicCompiler(choice);
    return;
  }
  mainStore.dispatch(applyProjectSettingAction(ZXBC_COMPILER, choice));
  await saveKliveProject();
}

export async function borielSetupStatus(): Promise<BorielSetupStatus> {
  return await getBorielSetupStatus(borielServiceDeps());
}

/** Installs the bundled kit and, when it works, makes it the Boriel BASIC Klive uses. */
export async function installBorielKit(folder: string): Promise<BorielInstallResult> {
  const result = await installBoriel(folder, borielServiceDeps());
  if (result.kind === "installed") recordInstallation(result);
  return result;
}

/** Accepts an installation the user already has, when it works. */
export async function useExistingBorielInstallation(itemPath: string): Promise<BorielInstallResult> {
  const result = await useExistingBoriel(itemPath, borielServiceDeps());
  if (result.kind === "installed") recordInstallation(result);
  return result;
}

/** Remembers the user's answer to the setup offer, per kit version. */
export function recordBorielSetupDecision(decision: BorielSetupDecision): void {
  const { kit } = locateBundledKit(borielServiceDeps().kitLocation);
  appSettings.borielSetup = {
    ...appSettings.borielSetup,
    offeredVersion: kit.kind === "available" ? kit.version : appSettings.borielSetup?.offeredVersion,
    declined: decision === "declined"
  };
  saveAppSettings();
}

/**
 * Called once at startup. A working installation in the default folder that the settings do not
 * know yet is recorded silently; otherwise the answer says whether to show the setup offer.
 */
export async function borielStartupCheck(): Promise<boolean> {
  try {
    const action = await decideBorielStartup(borielServiceDeps());
    if (action.kind === "adopt") {
      recordInstallation({ kind: "installed", folder: action.folder, executablePath: action.executablePath, version: action.version });
      return false;
    }
    return action.kind === "offer";
  } catch (error) {
    // --- The offer is a convenience; it must never stop Klive from starting
    console.error("Boriel BASIC startup check failed:", error);
    return false;
  }
}

/**
 * Shows the setup offer once per run, when the startup check says so, in the emulator window and
 * only after the welcome dialog is gone (`startScreenDisplayed`): never two dialogs at once.
 * The check starts at once, in the background, so it never delays the start.
 */
export function scheduleBorielSetupOffer(show: () => Promise<unknown>): void {
  const check = borielStartupCheck();
  let started = false;
  const consider = () => {
    const state = mainStore.getState();
    if (started || !state.emuLoaded || !state.startScreenDisplayed) return;
    started = true;
    unsubscribe();
    void (async () => {
      if (!(await check)) return;
      try {
        await show();
      } catch {
        // --- The emulator window may still be wiring its dialog opener: one more try
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await show().catch((error) => console.error("Cannot show the Boriel BASIC setup offer:", error));
      }
    })();
  };
  const unsubscribe = mainStore.subscribe(consider);
  consider();
}

function recordInstallation(result: Extract<BorielInstallResult, { kind: "installed" }>): void {
  applyUserSetting(BORIEL_INSTALL_FOLDER, result.folder);
  applyUserSetting(BORIEL_VERSION, result.version);
  // --- An explicit executable path wins over the folder, so one pointing elsewhere is dropped:
  // --- the user just chose this installation (the result names what it replaced)
  const explicit = createSettingsReader(mainStore.getState()).readSetting(ZXBC_EXECUTABLE_PATH);
  if (typeof explicit === "string" && explicit.trim() && explicit.trim() !== result.executablePath) {
    applyUserSetting(ZXBC_EXECUTABLE_PATH, undefined);
  }
  appSettings.borielSetup = { ...appSettings.borielSetup, installedVersion: result.version, declined: false };
  saveAppSettings();
}
