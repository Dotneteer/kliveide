/**
 * Screenshots of the disks tutorial (`docs/content/en/guides/emulator/disks-tutorial.mdx`), taken
 * by following the tutorial's own steps on a ZX Spectrum +3:
 *
 * - the Create Disk File dialog proposing the project's `disks` folder, which makes the blank disk;
 * - a BASIC program and a loading screen put on it with `disk add` (the commands pane);
 * - the disk in the Disk Explorer: the program's listing, the screen's preview;
 * - the disk in drive A, booted through the +3's Loader: the program loads the screen and saves a
 *   copy, and the open explorer shows the file the +3 wrote;
 * - the copy's sectors in the Layout view;
 * - a FAT16 SD card image made and filled with `disk`, browsed, and its volume map;
 * - the esxDOS ROM row of Settings › Machine.
 *
 * Verifies before it photographs: every shot waits for the text it must show. The native dialogs are
 * stubbed: Machine › Disks › Insert Disk's file dialog answers with the tutorial's disk, and the
 * "Disk created" message box is dismissed.
 */
const fs = require("fs");
const path = require("path");
const { fixtureProjectFolder, REPO } = require("../harness.cjs");

const EXPLORER = '[class*="_explorer_"]';
const ROWS = `${EXPLORER} [role="row"]`;

const PROGRAM = [
  "10 BORDER 0: PAPER 0: INK 7: CLS",
  '20 LOAD "title.scr" SCREEN$',
  '30 PRINT AT 21,0; INK 6;"Hello from drive A!"',
  '40 SAVE "copy.scr" SCREEN$',
  '50 PRINT AT 21,0; INK 4;"Saved COPY.SCR      "',
  ""
].join("\n");

/** A 6912-byte loading screen: rainbow bands, and a title in the 48K ROM's font at twice its size */
function titleScreen() {
  const rom = fs.readFileSync(path.join(REPO, "src/public/roms/sp48.rom"));
  const scr = new Uint8Array(6912);
  const plot = (x, y) => {
    const offset = ((y & 0xc0) << 5) | ((y & 0x07) << 8) | ((y & 0x38) << 2) | (x >> 3);
    scr[offset] |= 0x80 >> (x & 7);
  };
  const text = (s, col, row) => {
    for (let i = 0; i < s.length; i++) {
      const glyph = 0x3d00 + (s.charCodeAt(i) - 32) * 8;
      for (let gy = 0; gy < 8; gy++) {
        const bits = rom[glyph + gy];
        for (let gx = 0; gx < 8; gx++) {
          if (!(bits & (0x80 >> gx))) continue;
          for (let d = 0; d < 4; d++) plot((col + i * 2) * 8 + gx * 2 + (d & 1), row * 8 + gy * 2 + (d >> 1));
        }
      }
    }
  };
  text("KLIVE DISKS", 5, 8);
  text("TUTORIAL", 8, 11);
  const bands = [2, 6, 4, 5, 3, 1];
  for (let row = 0; row < 24; row++) {
    for (let col = 0; col < 32; col++) {
      const inTitle = row >= 8 && row < 14;
      const paper = inTitle ? 0 : bands[Math.floor(row / 4) % bands.length];
      scr[6144 + row * 32 + col] = 0x40 | (paper << 3) | 7;
    }
  }
  return scr;
}

async function waitForText(locator, text, what, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const all = await locator.allTextContents().catch(() => []);
    if (all.some((t) => t.replace(/\s+/g, " ").includes(text))) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  // --- What was there instead, for the failure report
  const page = locator.page();
  await page.screenshot({ path: path.join(REPO, ".doc-shots", "disks-tutorial-failure.png") }).catch(() => {});
  throw new Error(`${what}: "${text}" never appeared (see .doc-shots/disks-tutorial-failure.png)`);
}

/**
 * Clicks an application-menu item by id. On macOS the menu's submenus are filled in for the focused
 * window only, so the IDE window (or the EMU window, `emu: true`) is focused first; the app also
 * rebuilds its menu after a machine change, so the item is waited for.
 */
async function menu(klive, id, wait = 800, { emu = false } = {}) {
  const deadline = Date.now() + 40000;
  while (Date.now() < deadline) {
    await klive.app.evaluate(({ app, BrowserWindow }, wantEmu) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("?emu") === wantEmu);
      if (win && !win.isFocused()) {
        app.focus({ steal: true });
        win.show();
        win.focus();
      }
    }, emu);
    const clicked = await klive.app.evaluate(({ Menu }, itemId) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById(itemId);
      if (!item || !item.enabled) return false;
      item.click();
      return true;
    }, id);
    if (clicked) {
      await klive.sleep(wait);
      return;
    }
    await klive.sleep(400);
  }
  throw new Error(`The menu item ${id} never appeared`);
}

module.exports = {
  name: "disks-tutorial",
  window: { width: 1280, height: 860, toolPanelHeight: "300px" },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "DiskTutorial");
    try {
      // --- 1. A +3 project, the program and the screen
      await klive.cmd(`newp spp3e:plus3-fdd1 ${fixture.name} -p "${fixture.parent}" -o`, 9000);
      fs.writeFileSync(path.join(fixture.project, "hello.bas"), PROGRAM);
      fs.writeFileSync(path.join(fixture.project, "title.scr"), titleScreen());
      await klive.sleep(1500);

      // --- 2. A blank disk, with Machine › Disks › Create Disk File... (in the EMU window). The folder
      // --- field proposes the project's disks folder; the "Disk created" message box is native
      const disk = path.join(fixture.project, "disks", "game.dsk");
      await klive.app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
      });
      const dialogPage = await klive.emu({ width: 900, height: 700 });
      await menu(klive, "create_disk_file", 1500, { emu: true });
      const dialogBox = dialogPage.locator('[role="dialog"]');
      // --- The folder is the first field's value: wait for the default to arrive there
      const inputs = dialogBox.locator("input");
      const wanted = path.join(fixture.project, "disks");
      const until = Date.now() + 15000;
      let shown = "";
      while (Date.now() < until) {
        shown = await inputs.first().inputValue().catch(() => "");
        if (shown === wanted) break;
        await klive.sleep(300);
      }
      if (shown !== wanted) throw new Error(`The folder field shows "${shown}", not the project's disks folder`);
      await inputs.last().fill("game");
      await klive.sleep(500);
      await klive.shot('[role="dialog"]', "en/disks-tutorial/create-disk-dialog.webp", { displayWidth: 560, page: dialogPage });
      await dialogBox.getByRole("button", { name: "Create", exact: true }).click();
      const deadline = Date.now() + 10000;
      while (!fs.existsSync(disk) && Date.now() < deadline) await klive.sleep(300);
      if (!fs.existsSync(disk)) throw new Error(`The dialog did not create ${disk}`);
      await klive.ide.bringToFront();

      // --- 3. The program and the screen on it, with `disk`
      await klive.cmd("cls", 500);
      await klive.cmd("disk add disks/game.dsk hello.bas DISK -start 10", 3000);
      await klive.cmd("disk add disks/game.dsk title.scr", 3000);
      // --- The pane holds only a few lines: the shot is the listing
      await klive.cmd("cls", 500);
      await klive.cmd("disk ls disks/game.dsk", 2500);
      const commands = klive.ide.locator('[class*="_toolArea_"]');
      await waitForText(commands, "TITLE.SCR", "disk ls");
      await klive.shot('[class*="_toolArea_"]', "en/disks-tutorial/commands.webp", { displayWidth: 720 });

      // --- 4. The disk in the Disk Explorer
      await klive.cmd(`nav "${disk}"`, 3000);
      await klive.ide.locator(ROWS, { hasText: "DISK" }).first().click();
      await waitForText(klive.ide.locator(EXPLORER), "Hello from drive A", "the DISK listing");
      await klive.shot(EXPLORER, "en/disks-tutorial/explorer-listing.webp", {
        displayWidth: 720,
        markers: {
          program: { selector: `${ROWS}[aria-selected="true"] > span`, x: 0.6 },
          autorun: { selector: `${EXPLORER} dt:has-text("Auto-run line")`, x: 1 },
          listing: { selector: `${EXPLORER} :text("Hello from drive A")`, x: 0.8 }
        }
      });
      await klive.ide.locator(ROWS, { hasText: "TITLE.SCR" }).first().click();
      await klive.sleep(800);
      await klive.shot(EXPLORER, "en/disks-tutorial/explorer-screen.webp", { displayWidth: 720 });

      // --- 5. Into drive A (the file dialog answers with the disk), then boot it with the Loader
      await klive.app.evaluate(({ dialog }, file) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
      }, disk);
      await menu(klive, "insert_disk_a", 1500);
      await waitForText(klive.ide.locator(EXPLORER), "In drive A", "the drive badge");
      // --- A disk goes in write-protected: the program saves, so take the protection off
      await menu(klive, "protect_disk_a", 1000);
      await klive.cmd("em-start", 6000);
      const emu = await klive.emu({ width: 760, height: 700 });
      await emu.mouse.move(5, 650);
      // --- Enter on Loader. A focus change between the windows can leave the machine paused on its
      // --- menu, so resume it and press again until the program has started (Enter in BASIC is harmless)
      for (let attempt = 0; attempt < 4; attempt++) {
        const paused = await emu.locator("#themeRoot").innerText().then((t) => /Paused/.test(t)).catch(() => false);
        if (paused) {
          await klive.ide.bringToFront();
          await klive.cmd("em-start", 3000);
          await klive.emu({ width: 760, height: 700 });
        }
        await emu.keyboard.down("Enter");
        await klive.sleep(150);
        await emu.keyboard.up("Enter");
        await klive.sleep(4000);
        const text = (await klive.ide.locator(EXPLORER).allTextContents()).join(" ");
        if (text.includes("COPY.SCR")) break;
      }
      // --- The Loader loads DISK, which loads the screen and saves its copy
      try {
        await waitForText(klive.ide.locator(EXPLORER), "COPY.SCR", "the file the +3 wrote", 60000);
      } catch (err) {
        await emu.screenshot({ path: path.join(REPO, ".doc-shots", "disks-tutorial-emu.png") });
        throw err;
      }
      await klive.sleep(3000);
      await klive.shot('#themeRoot', "en/disks-tutorial/plus3-running.webp", {
        displayWidth: 640,
        page: emu
      });
      await klive.cmd("em-pause", 1500);

      await klive.ide.bringToFront();
      await klive.ide.locator(ROWS, { hasText: "COPY.SCR" }).first().click();
      await klive.sleep(1000);
      await klive.shot(EXPLORER, "en/disks-tutorial/explorer-written.webp", {
        displayWidth: 720,
        markers: {
          drive: '[class*="_mounted_"]',
          written: { selector: `${ROWS}[aria-selected="true"] > span`, x: 0.8 }
        }
      });

      // --- 6. The copy's sectors
      await klive.ide.locator(`${EXPLORER} [aria-label="Show the file's sectors"]`).first().click();
      await klive.sleep(1000);
      await klive.shot(EXPLORER, "en/disks-tutorial/layout.webp", { displayWidth: 720 });

      // --- 7. An SD card image
      const games = path.join(fixture.project, "card", "GAMES");
      fs.mkdirSync(games, { recursive: true });
      fs.copyFileSync(disk, path.join(games, "game.dsk"));
      fs.copyFileSync(path.join(fixture.project, "title.scr"), path.join(fixture.project, "card", "title.scr"));
      await klive.cmd("cls", 500);
      await klive.cmd("disk new card.img fat16 64", 6000);
      await klive.cmd("disk add card.img card/GAMES", 4000);
      await klive.cmd("disk add card.img card/title.scr", 3000);
      await klive.cmd(`nav "${path.join(fixture.project, "card.img")}"`, 3000);
      const card = `${EXPLORER} >> nth=-1`;
      await waitForText(klive.ide.locator(ROWS), "GAMES", "the card's root");
      await klive.ide.locator(ROWS, { hasText: "title.scr" }).last().click();
      await klive.sleep(1000);
      await klive.shot(card, "en/disks-tutorial/card-files.webp", { displayWidth: 720 });
      await klive.ide.locator(ROWS, { hasText: "GAMES" }).last().dblclick();
      await waitForText(klive.ide.locator(ROWS), "game.dsk", "the GAMES folder");
      await klive.ide.locator(ROWS, { hasText: "game.dsk" }).last().click();
      await klive.ide.locator(`${EXPLORER} [data-icon="spr-grid"]`).last().click();
      await klive.sleep(1000);
      await klive.shot(card, "en/disks-tutorial/card-layout.webp", { displayWidth: 720 });

      // --- 8. The esxDOS ROM row (Settings › Machine, in the EMU window)
      const settingsWindow = await klive.emu({ width: 900, height: 700 });
      await menu(klive, "open_settings", 1200, { emu: true });
      await settingsWindow.getByTestId("settings-page-machine").click();
      await klive.sleep(800);
      await waitForText(settingsWindow.locator("body"), "esxDOS ROM", "the esxDOS ROM row");
      await klive.shot('[role="dialog"]', "en/disks-tutorial/esxdos-setting.webp", { displayWidth: 640, page: settingsWindow });
    } finally {
      fixture.cleanup();
    }
  }
};
