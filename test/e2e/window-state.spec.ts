import { expect, test } from "./fixtures/kliveApp";

test("saves emulator size and position to its isolated settings file", async ({ kliveApp }) => {
  const { bounds, isAlwaysOnTop } = await kliveApp.electronApp.evaluate(({ BrowserWindow }) => {
    const emuWindow = BrowserWindow.getAllWindows().find((window) =>
      window.webContents.getURL().includes("?emu")
    );
    if (!emuWindow) throw new Error("Klive emulator window is not available.");
    emuWindow.setBounds({ x: 80, y: 90, width: 810, height: 620 });

    return { bounds: emuWindow.getBounds(), isAlwaysOnTop: emuWindow.isAlwaysOnTop() };
  });

  expect(isAlwaysOnTop).toBe(false);
  await kliveApp.close();

  expect(kliveApp.readSettings()).toMatchObject({
    globalSettings: { emuOptions: { stayOnTop: false } },
    windowStates: {
      emuWindow: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: false,
        isFullScreen: false
      }
    }
  });
});

test("saves the IDE maximized state to its isolated settings file", async ({ kliveApp }) => {
  const isMaximized = await kliveApp.electronApp.evaluate(async ({ BrowserWindow }) => {
    const ideWindow = BrowserWindow.getAllWindows().find((window) =>
      window.webContents.getURL().includes("?ide")
    );
    if (!ideWindow) throw new Error("Klive IDE window is not available.");
    ideWindow.maximize();
    await new Promise((resolve) => setTimeout(resolve, 150));
    return ideWindow.isMaximized();
  });

  expect(isMaximized).toBe(true);
  await kliveApp.close();

  expect(kliveApp.readSettings().windowStates?.ideWindow).toMatchObject({
    isMaximized: true,
    isFullScreen: false
  });
});
