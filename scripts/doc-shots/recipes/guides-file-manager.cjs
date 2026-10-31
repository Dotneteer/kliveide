/**
 * Guides screenshots of the File Manager (`docs/content/en/guides/media/file-manager.mdx`,
 * `.plans/FILE_MANAGER_PLAN.md` Phase 8):
 *
 * - `file-manager/panes.webp` — the project on the left (two files marked), a +3 disk entered on
 *   the right;
 * - `file-manager/copy.webp` — the copy dialog, showing what each file becomes on the disk;
 * - `file-manager/viewer.webp` — F3's viewer on the disk's BASIC program.
 *
 * Every pane is on the fixture project or the disk in it: nothing of this computer's own drives (or
 * its home folder) shows in a shot. The disk is `../fixtures/disks/sample.dsk`.
 */
const fs = require("fs");
const path = require("path");
const { fixtureProjectFolder } = require("../harness.cjs");
const { focusIde, park, press, sleep, waitFor } = require("../guides-helpers.cjs");

const FM = '[data-testid="file-manager"]';
const PANE = (side) => `[data-testid="fm-pane-${side}"]`;
const ROW = (side, name) => `${PANE(side)} [data-testid="fm-row"]:has-text("${name}")`;

module.exports = {
  name: "guides-file-manager",
  window: { width: 1280, height: 820, toolPanelHeight: "120px", sideBarWidth: "220px" },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "FileManagerShots");
    try {
      await klive.cmd(`newp spp3e ${fixture.name} -p "${fixture.parent}" -o`, 9000);
      const disks = path.join(__dirname, "../fixtures/disks");
      fs.copyFileSync(path.join(disks, "sample.dsk"), path.join(fixture.project, "game.dsk"));
      fs.mkdirSync(path.join(fixture.project, "assets"), { recursive: true });
      // --- A screen and a BASIC loader, both to be copied onto the disk
      const screen = Buffer.alloc(6912);
      for (let i = 0; i < 6144; i++) screen[i] = (i >> 5) % 2 ? 0x0f : 0xf0;
      screen.fill(0x38, 6144, 6912);
      fs.writeFileSync(path.join(fixture.project, "assets", "title.scr"), screen);
      fs.writeFileSync(path.join(fixture.project, "assets", "loader.bas"), '10 LOAD "" SCREEN$\n20 LOAD "" CODE\n30 RANDOMIZE USR 32768\n');
      await sleep(2000);

      await klive.cmd("fm", 2500);
      await focusIde(klive);
      const ide = klive.ide;
      await waitFor(async () => (await ide.locator(`${PANE(0)} [data-testid="fm-row"]`).count()) > 0, "the left pane's files");

      // --- The right pane: the project too, then into the disk
      await ide.locator(`[data-testid="fm-drive-1"]`).click();
      await ide.locator(`[data-testid="fm-drive-menu"] [role="menuitem"]:has-text("Project:")`).first().click();
      await waitFor(async () => (await ide.locator(ROW(1, "game.dsk")).count()) > 0, "the project in the right pane");
      await ide.locator(ROW(1, "game.dsk")).first().dblclick();
      await waitFor(async () => (await ide.locator(ROW(1, "DISK")).count()) > 0, "the disk's files");

      // --- The left pane: into assets, both files marked
      await ide.locator(ROW(0, "assets")).first().dblclick();
      await waitFor(async () => (await ide.locator(ROW(0, "title.scr")).count()) > 0, "the assets folder");
      await ide.locator(ROW(0, "loader.bas")).first().click();
      await press(ide, ["Insert", "Insert"]);
      await sleep(500);
      await park(ide);
      await klive.shot(FM, "en/guides/media/file-manager/panes.webp", { displayWidth: 900 });

      // --- F5: the copy dialog
      await press(ide, ["F5"]);
      await waitFor(async () => (await ide.locator('[data-testid="fm-transfer-dialog"]').count()) > 0, "the copy dialog");
      await sleep(600);
      await park(ide);
      await klive.shot('[role="dialog"]', "en/guides/media/file-manager/copy.webp", { displayWidth: 640 });
      await ide.locator('[role="dialog"] button[type="submit"]').click();
      await waitFor(async () => (await ide.locator('[data-testid="fm-notice"]').count()) > 0, "the copy's notice");
      await sleep(800);

      // --- F3 on the disk's BASIC program
      await ide.locator(ROW(1, "DISK")).first().click();
      await press(ide, ["F3"]);
      await waitFor(async () => (await ide.locator('[data-testid="fm-viewer"]').count()) > 0, "the viewer");
      await sleep(800);
      await park(ide);
      await klive.shot(PANE(1), "en/guides/media/file-manager/viewer.webp", { displayWidth: 520 });
    } finally {
      fixture.cleanup();
    }
  }
};
