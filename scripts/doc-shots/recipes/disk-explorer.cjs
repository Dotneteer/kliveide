/**
 * Screenshots of the Disk Explorer (`.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md` B4/B5, C2): a +3
 * disk's files with a BASIC program's listing, its Layout view, a TR-DOS disk, and a FAT16
 * hard-disk image the `disk` command makes and fills (its folder and its volume map).
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

      // --- A hard-disk image (C2): made and filled with the `disk` command, then browsed
      const games = path.join(fixture.project, "card", "GAMES");
      fs.mkdirSync(games, { recursive: true });
      fs.copyFileSync(path.join(disks, "sample.trd"), path.join(games, "Pentagon disk.trd"));
      fs.copyFileSync(path.join(disks, "sample.dsk"), path.join(games, "Plus3 disk.dsk"));
      fs.writeFileSync(path.join(fixture.project, "card", "readme.txt"), "A card made by Klive's disk command\n");
      await klive.cmd("disk new card.img fat16 32", 6000);
      await klive.cmd("disk add card.img card/GAMES", 6000);
      await klive.cmd("disk add card.img card/readme.txt", 4000);
      await klive.sleep(1500);
      await klive.cmd(`nav "${path.join(fixture.project, "card.img")}"`, 3000);
      const hard = `${EXPLORER} >> nth=-1`;
      await klive.ide.locator(`${EXPLORER} [role="row"]`, { hasText: "GAMES" }).last().dblclick();
      await klive.sleep(800);
      await klive.ide.locator(`${EXPLORER} [role="row"]`, { hasText: "Pentagon disk.trd" }).last().click();
      await klive.sleep(800);
      await klive.shot(hard, "disk-explorer/hard-disk.png", { displayWidth: 720 });
      await klive.ide.locator(`${EXPLORER} [data-icon="spr-grid"]`).last().click();
      await klive.sleep(800);
      await klive.shot(hard, "disk-explorer/hard-disk-layout.png", { displayWidth: 720 });
    } finally {
      fixture.cleanup();
    }
  }
};
