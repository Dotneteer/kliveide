import { _electron as electron, expect, test } from "@playwright/test";
import {
  clickMenuItemById,
  getAllMenuItems,
  launchElectronNoIde,
  launchElectronWithIde
} from "./electron-helper";

// You may need to adjust the path to your Electron app's main entry point
const ELECTRON_APP_PATH = "./out/main/index.js";

test("Electron app starts and displays the emulator window", async () => {
  // Launch the Electron app
  const { electronApp, page } = await launchElectronNoIde(ELECTRON_APP_PATH);

  await expect(page).toHaveTitle(/Klive Retro-Computer Emulator/);
  await electronApp.close();
});

test("Electron app starts and displays both windows", async () => {
  // Launch the Electron app
  const { electronApp, emuPage, idePage } = await launchElectronWithIde(ELECTRON_APP_PATH);

  await expect(emuPage).toHaveTitle(/Klive Retro-Computer Emulator/);
  await expect(idePage).toHaveTitle(/Klive IDE/);
  await electronApp.close();
});

test("Invokes a menu command", async () => {
  // Launch the Electron app with only the emulator window
  const { electronApp, page } = await launchElectronNoIde(ELECTRON_APP_PATH);

  // Wait for the window to be ready
  await expect(page).toHaveTitle(/Klive Retro-Computer Emulator/);
  const menuItems = await getAllMenuItems(electronApp);
  console.log(menuItems.map((item: { id: any }) => item.id));

  await clickMenuItemById(electronApp, "machine_sp48_ntsc");

  // Optionally, add an assertion to check for a dialog or UI change
  // For example, check if a new project dialog appears (update selector as needed)
  // await expect(page.locator('[data-testid="new-project-dialog"]')).toBeVisible();

  await electronApp.close();
});
