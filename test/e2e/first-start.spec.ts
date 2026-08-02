import fs from "fs";
import { expect, test } from "./fixtures/kliveApp";

test.use({
  kliveSettingsFile: "missing",
  kliveStartup: "default"
});

test("shows the Welcome to Klive dialog when no settings file exists", async ({ kliveApp }) => {
  const dialog = kliveApp.emuPage.getByRole("dialog", { name: "Welcome to Klive!" });
  await expect(dialog).toBeVisible();
  expect(fs.existsSync(kliveApp.settingsFilePath)).toBe(false);
  await dialog.getByRole("button", { name: "Ok" }).click();
  await expect(dialog).toBeHidden();
});

test("shows only the emulator window on first start", async ({ kliveApp }) => {
  const visibility = await kliveApp.electronApp.evaluate(({ BrowserWindow }) => {
    const windowVisibility = (urlDiscriminator: string) => {
      const window = BrowserWindow.getAllWindows().find((candidate) =>
        candidate.webContents.getURL().includes(urlDiscriminator)
      );
      if (!window) throw new Error(`Klive window '${urlDiscriminator}' is not available.`);
      return window.isVisible();
    };

    return { emulator: windowVisibility("?emu"), ide: windowVisibility("?ide") };
  });

  expect(visibility).toEqual({ emulator: true, ide: false });
});
