/**
 * Guides screenshots of the Project Explorer (`docs/content/en/guides/projects/project-explorer.mdx`):
 *
 * - `project-explorer/tree.webp` — a 48K project with source, a tape and a screen file, its build
 *   root open in the editor; markers on the project's home icon and the build-root badge;
 * - `project-explorer/folder-menu.webp` — the context menu of the `code` folder;
 * - `project-explorer/tape-menu.webp` — the context menu of a `.tap` file, with the tape's own items.
 *
 * The extra files are written while the project is closed: a file written into an open project may
 * never reach the tree (doc-shots guide). The tape is a z88dk test fixture's `program.tap`.
 */
const path = require("path");
const fs = require("fs");
const { fixtureProjectFolder, REPO } = require("../harness.cjs");
const h = require("../guides-helpers.cjs");

const SIDE = '[class*="_sideBarPanel_"]';
const MENU = '[class*="_contextMenu_"]';

/** A 6912-byte screen: diagonal stripes in the pixels, a calm blue-on-white palette. */
function screenFile() {
  const bytes = Buffer.alloc(6912);
  for (let i = 0; i < 6144; i++) bytes[i] = i % 3 === 0 ? 0x81 : 0x18;
  bytes.fill(0x0f, 6144); // --- INK 7, PAPER 1
  return bytes;
}

/** Right-clicks a tree item and photographs the side bar with the menu, cropped to both. */
async function menuShot(klive, label, file) {
  const { ide } = klive;
  await ide.locator(SIDE).getByText(label, { exact: true }).first().click({ button: "right", timeout: 15000 });
  await h.sleep(900);
  const menu = ide.locator(MENU).first();
  await menu.waitFor({ timeout: 5000 });
  await h.park(ide);
  const side = await ide.locator('[class*="_sideBar_"]').first().boundingBox();
  const mbox = await menu.boundingBox();
  const right = Math.max(side.x + side.width, mbox.x + mbox.width + 12);
  const bottom = Math.max(mbox.y + mbox.height + 12, side.y + 360);
  await klive.shot(h.ROOT, file, {
    displayWidth: 520,
    crop: { x: 0, y: 0, width: Math.ceil(right), height: Math.ceil(bottom) }
  });
  await ide.keyboard.press("Escape");
  await h.sleep(500);
}

module.exports = {
  name: "guides-explorer",
  window: { width: 1280, height: 820, sideBarWidth: "300px", toolPanelHeight: "160px" },

  async run(klive) {
    const { ide } = klive;
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "MyGame");
    try {
      await klive.cmd(`newp sp48 ${fixture.name} -p "${fixture.parent}" -o`, 8000);
      await klive.cmd("close", 2000);
      const write = (rel, content) => {
        const p = path.join(fixture.project, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, content);
      };
      write("code/sprites.kz80.asm", "; Sprite data\n    .defb 0\n");
      write("tapes/hello.tap", fs.readFileSync(path.join(REPO, "test/z88dk/fixtures/zx-hello/program.tap")));
      write("gfx/title.scr", screenFile());
      await klive.cmd(`open "${fixture.project}"`, 5000);
      await h.activity(klive, "Explorer");
      // --- The reopened project shows its folders expanded: clicking one would collapse it
      await klive.cmd("nav code/code.kz80.asm", 2500);
      await h.showFile(klive, "code/code.kz80.asm");
      await klive.cmd("cls", 400);
      await h.park(ide);

      // --- The tree, with the start of the editor beside it
      const side = await ide.locator('[class*="_sideBar_"]').first().boundingBox();
      await klive.shot(h.ROOT, "en/guides/projects/project-explorer/tree.webp", {
        displayWidth: 760,
        crop: { x: 0, y: 0, width: Math.ceil(side.x + side.width + 460), height: 560 }
      });

      await menuShot(klive, "code", "en/guides/projects/project-explorer/folder-menu.webp");
      await menuShot(klive, "hello.tap", "en/guides/projects/project-explorer/tape-menu.webp");
    } finally {
      await klive.cmd("close", 1500).catch(() => {});
      fixture.cleanup();
    }
  }
};
