/**
 * Screenshots of the Disk Explorer (`.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md` B4/B5): a +3
 * disk's files with a BASIC program's listing, its Layout view, and a TR-DOS disk.
 *
 * The sample disks are `../fixtures/disks/` (made with Klive's own disk file systems: a 173K +3
 * disk and a 40-track TR-DOS disk), or `DOC_SHOTS_DISKS`, copied into a fixture project.
 */
const fs = require("fs");
const path = require("path");
const { fixtureProjectFolder } = require("../harness.cjs");

const EXPLORER = '[class*="_explorer_"]';

module.exports = {
  name: "disk-explorer",
  window: { width: 1280, height: 820, toolPanelHeight: "120px" },

  async run(klive) {
    const disks = process.env.DOC_SHOTS_DISKS || path.join(__dirname, "../fixtures/disks");
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "DiskExplorerShots");
    try {
      await klive.cmd(`newp spp3e ${fixture.name} -p "${fixture.parent}" -o`, 9000);
      for (const file of ["sample.dsk", "sample.trd"]) {
        fs.copyFileSync(path.join(disks, file), path.join(fixture.project, file));
      }
      await klive.sleep(2500);

      await klive.cmd(`nav "${path.join(fixture.project, "sample.dsk")}"`, 3000);
      await klive.ide.locator(`${EXPLORER} [role="row"]`, { hasText: "DISK" }).first().click();
      await klive.sleep(800);
      await klive.shot(EXPLORER, "disk-explorer/files.png", { displayWidth: 720 });

      await klive.ide.locator(`${EXPLORER} [role="row"]`, { hasText: "GAME.BIN" }).first().click();
      await klive.ide.locator(`${EXPLORER} [data-icon="spr-grid"]`).last().click();
      await klive.sleep(800);
      await klive.shot(EXPLORER, "disk-explorer/layout.png", { displayWidth: 720 });

      await klive.cmd(`nav "${path.join(fixture.project, "sample.trd")}"`, 3000);
      await klive.ide.locator(`${EXPLORER} [data-icon="eye-off"]`).first().click();
      await klive.ide.locator(`${EXPLORER} [role="row"]`, { hasText: "screen.C" }).first().click();
      await klive.sleep(800);
      await klive.shot(`${EXPLORER} >> nth=-1`, "disk-explorer/trdos.png", { displayWidth: 720 });
    } finally {
      fixture.cleanup();
    }
  }
};
