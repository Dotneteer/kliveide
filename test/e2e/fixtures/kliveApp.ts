import fs from "fs";
import path from "path";
import {
  _electron as electron,
  test as base,
  type ElectronApplication,
  type Page
} from "@playwright/test";
import type { AppSettings } from "../../../src/main/settings";
import { ABOUT_DIALOG } from "../../../src/common/messaging/dialog-ids";
import { createE2eSettingsFile, type E2eSettingsFile } from "./settings";

const appEntryPath = path.resolve(process.cwd(), "out/main/index.js");

export type KliveApp = {
  electronApp: ElectronApplication;
  idePage: Page;
  emuPage: Page;
  settingsFilePath: string;
  close: () => Promise<void>;
  readSettings: () => AppSettings;
  openAboutDialog: () => Promise<string>;
  triggerMenuItem: (id: string) => Promise<void>;
};

type KliveFixtures = {
  kliveApp: KliveApp;
  kliveSettings: Partial<AppSettings>;
  kliveSettingsFile: "present" | "missing";
  kliveStartup: "show-ide" | "default";
};

export const test = base.extend<KliveFixtures>({
  kliveSettings: [{}, { option: true }],
  kliveSettingsFile: ["present", { option: true }],
  kliveStartup: ["show-ide", { option: true }],
  kliveApp: async ({ kliveSettings, kliveSettingsFile, kliveStartup }, use) => {
    const settingsFile = createE2eSettingsFile(kliveSettings, kliveSettingsFile === "present");
    let app: KliveApp | undefined;

    try {
      app = await launchKlive(settingsFile, kliveStartup);
      await use(app);
    } finally {
      await app?.close();
      settingsFile.cleanup();
    }
  }
});

export { expect } from "@playwright/test";

async function launchKlive(
  settingsFile: E2eSettingsFile,
  startup: KliveFixtures["kliveStartup"]
): Promise<KliveApp> {
  if (!fs.existsSync(appEntryPath)) {
    throw new Error(`Klive's Electron bundle is missing at ${appEntryPath}. Run npm run build:e2e first.`);
  }

  const electronApp = await electron.launch({
    args: [appEntryPath, ...(startup === "show-ide" ? ["--showide"] : [])],
    env: settingsFile.environment
  });

  try {
    const idePage = await waitForWindow(electronApp, "?ide");
    const emuPage = await waitForWindow(electronApp, "?emu");
    await Promise.all([
      idePage.locator('#appMain[data-app-ready="true"]').waitFor(),
      emuPage.locator('#appMain[data-app-ready="true"]').waitFor(),
      idePage.locator('[data-dialog-bridge-ready="true"]').waitFor({ state: "attached" }),
      emuPage.locator('[data-dialog-bridge-ready="true"]').waitFor({ state: "attached" })
    ]);

    let closePromise: Promise<void> | undefined;
    const close = async () => {
      closePromise ??= closeElectronApp(electronApp);
      await closePromise;
    };

    return {
      electronApp,
      idePage,
      emuPage,
      settingsFilePath: settingsFile.settingsFilePath,
      close,
      readSettings: () => JSON.parse(fs.readFileSync(settingsFile.settingsFilePath, "utf8")) as AppSettings,
      openAboutDialog: async () =>
        await electronApp.evaluate(({ app, BrowserWindow }, dialogId) => {
          const emuWindow = BrowserWindow.getAllWindows().find((window) =>
            window.webContents.getURL().includes("?emu")
          );
          if (!emuWindow) throw new Error("Klive emulator window is not available.");

          const version = app.getVersion();
          emuWindow.webContents.send("MainToEmu", {
            type: "ApiMethodRequest",
            method: "displayDialog",
            targetId: "emu",
            args: [dialogId, {
              version,
              electronVersion: process.versions.electron,
              osVersion: process.platform
            }],
            correlationId: 0
          });
          return version;
        }, ABOUT_DIALOG),
      triggerMenuItem: async (id: string) => {
        await electronApp.evaluate(async ({ BrowserWindow, Menu }, menuItemId) => {
          const item = Menu.getApplicationMenu()?.getMenuItemById(menuItemId);
          if (!item?.click) {
            throw new Error(`Application menu item not found: ${menuItemId}`);
          }
          let clickError: unknown;
          const focusedWindow = BrowserWindow.getFocusedWindow();
          void Promise.resolve(item.click.call(item, {}, focusedWindow, focusedWindow?.webContents)).catch(
            (error) => (clickError = error)
          );
          await new Promise((resolve) => setTimeout(resolve, 50));
          if (clickError) throw clickError;
        }, id);
      }
    };
  } catch (error) {
    await electronApp.close();
    throw error;
  }
}

async function closeElectronApp(electronApp: ElectronApplication): Promise<void> {
  const closedGracefully = await Promise.race([
    electronApp.close().then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 5_000))
  ]);

  if (!closedGracefully) {
    electronApp.process().kill("SIGKILL");
  }
}

async function waitForWindow(electronApp: ElectronApplication, discriminator: string): Promise<Page> {
  const timeoutAt = Date.now() + 30_000;
  while (Date.now() < timeoutAt) {
    const page = electronApp.windows().find((window) => window.url().includes(discriminator));
    if (page) return page;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Klive did not create a renderer window with '${discriminator}'.`);
}
