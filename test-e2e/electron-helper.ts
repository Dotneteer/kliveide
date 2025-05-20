import { _electron as electron, ElectronApplication, Page } from "@playwright/test";

/**
 * Launches the Electron app with the "--noide" option and returns the Page of the visible BrowserWindow.
 */
export async function launchElectronNoIde(
  electronAppPath: string
): Promise<{ electronApp: ElectronApplication; page: Page }> {
  const electronApp = await electron.launch({
    args: [electronAppPath, "--noide"]
  });
  const window = await electronApp.firstWindow();
  await window.waitForEvent("domcontentloaded");
  return { electronApp, page: window };
}

/**
 * Launches the Electron app with both EMU and IDE windows visible and returns their Page objects.
 */
export async function launchElectronWithIde(
  electronAppPath: string
): Promise<{ electronApp: ElectronApplication; emuPage: Page; idePage: Page }> {
  const electronApp = await electron.launch({
    args: [electronAppPath, "--showide"]
  });
  await electronApp.firstWindow(); // ensure at least one window is ready
  let windows = electronApp.windows();
  await Promise.all(windows.map((win) => win.waitForEvent("domcontentloaded")));
  windows = electronApp.windows();
  let emuPage: Page | undefined;
  let idePage: Page | undefined;
  for (const win of windows) {
    const title = await win.title();
    if (/Emulator/i.test(title)) {
      emuPage = win;
    } else if (/IDE/i.test(title)) {
      idePage = win;
    }
  }
  if (!emuPage) emuPage = windows[0];
  if (!idePage) idePage = windows[1] || windows[0];
  return { electronApp, emuPage, idePage };
}

/**
 * Clicks a menu item by its id in the Electron main process.
 */
export async function clickMenuItemById(
  electronApp: ElectronApplication,
  menuItemId: string
): Promise<void> {
  await electronApp.evaluate(( { Menu }, menuItemId ) => {
    const menu = Menu.getApplicationMenu();
    if (!menu) throw new Error("No application menu found");
    function findMenuItem(items: any[]): any | null {
      for (const item of items) {
        if (item.id === menuItemId) return item;
        if (item.submenu) {
          const found = findMenuItem(item.submenu.items as any[]);
          if (found) return found;
        }
      }
      return null;
    }
    const menuItem = findMenuItem(menu.items as any[]);
    if (!menuItem) throw new Error(`Menu item with id '${menuItemId}' not found`);
    if (menuItem.enabled) menuItem.click();
  }, menuItemId);
}

/**
 * Retrieves all menu items from the app's main menu as a flat array.
 */
export async function getAllMenuItems(
  electronApp: ElectronApplication
): Promise<Array<{ id: string; label: string; enabled: boolean; visible: boolean }>> {
  return await electronApp.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu();
    if (!menu) throw new Error("No application menu found");
    function collectItems(items: any[]): Array<{ id: string; label: string; enabled: boolean; visible: boolean }> {
      let result: Array<{ id: string; label: string; enabled: boolean; visible: boolean }> = [];
      for (const item of items) {
        result.push({
          id: item.id,
          label: item.label,
          enabled: item.enabled,
          visible: item.visible
        });
        if (item.submenu) {
          result = result.concat(collectItems(item.submenu.items as any[]));
        }
      }
      return result;
    }
    return collectItems(menu.items as any[]);
  });
}