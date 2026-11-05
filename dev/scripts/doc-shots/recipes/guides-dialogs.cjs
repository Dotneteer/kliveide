/**
 * Guides screenshots of IDE dialogs:
 *
 * - `customizing/settings/settings-dialog.webp` — the Settings dialog on its Editor page, the page
 *   list beside it;
 * - `languages/sjasmplus/integration-dialog.webp` — the SJASMPLUS integration dialog.
 *
 * Both open through the IDE's `settings <page>` command (the SjasmPlus dialog from Settings ›
 * Integrations' Configure button), never through the native menu.
 */
const { fixtureProjectFolder } = require("../harness.cjs");
const h = require("../guides-helpers.cjs");
const { step, reportFailures } = require("../guides-helpers-shot.cjs");

module.exports = {
  name: "guides-dialogs",
  window: { width: 1280, height: 860, toolPanelHeight: "160px" },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "DialogShots");
    try {
      await klive.cmd(`newp sp48 ${fixture.name} sjasmplus -p "${fixture.parent}" -o`, 8000);
      await klive.cmd("cls", 400);

      await step(klive, "settings", async () => {
        await klive.cmd("settings editor", 1800);
        const page = await h.pageWithDialog(klive);
        await h.park(page);
        await klive.shot('[role="dialog"]', "en/guides/customizing/settings/settings-dialog.webp", {
          displayWidth: 760,
          page,
          markers: {
            pages: { selector: '[data-testid="settings-page-editor"]', x: 0.8, y: 0.5 }
          }
        });
        await page.keyboard.press("Escape");
        await klive.sleep(600);
      });

      await step(klive, "sjasmplus", async () => {
        await h.focusIde(klive);
        // --- `display-dialog` is not interactive: Settings › Integrations › SjasmPlus › Configure
        await klive.cmd("settings integrations", 1800);
        let page = await h.pageWithDialog(klive);
        await page.locator('[role="dialog"]').getByRole("button", { name: "Configure" }).first().click();
        await klive.sleep(1800);
        page = await h.pageWithDialog(klive);
        await h.park(page);
        await klive.shot('[role="dialog"]', "en/guides/languages/sjasmplus/integration-dialog.webp", {
          displayWidth: 560,
          page
        });
        await page.keyboard.press("Escape");
        await klive.sleep(600);
      });
      reportFailures();
    } finally {
      fixture.cleanup();
    }
  }
};
