/**
 * Shared helpers for the `guides-*.cjs` recipes (the Guides screenshots,
 * `.plans/GUIDES_OVERHAUL_PLAN.md` Phase 2). Lives outside `recipes/` because `run.cjs` treats
 * every `.cjs` file there as a recipe.
 */
const path = require("path");
const fs = require("fs");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The IDE's (and the EMU window's) whole window, without the margin `body` has. */
const ROOT = "#themeRoot";

/** Clicks an application menu item by id, focusing the right window and polling for the item. */
async function menu(klive, id, { emu = false, wait = 800, timeout = 30000 } = {}) {
  const deadline = Date.now() + timeout;
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
      await sleep(wait);
      return;
    }
    await sleep(400);
  }
  throw new Error(`The menu item ${id} never became available`);
}

/** Presses keys in a window, each held for a few frames; an array is a chord. */
async function press(page, keys) {
  for (const key of keys) {
    const chord = Array.isArray(key) ? key : [key];
    for (const k of chord) await page.keyboard.down(k);
    await sleep(90);
    for (const k of [...chord].reverse()) await page.keyboard.up(k);
    await sleep(160);
  }
}

/** Waits until `check()` resolves truthy. */
async function waitFor(check, what, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${what}`);
}

/** Puts the pointer somewhere harmless, so no tooltip or hover shows in a shot. */
async function park(page) {
  await page.mouse.move(5, 300);
  await sleep(400);
}

/** Brings the IDE window to the front. */
async function focusIde(klive) {
  await klive.app.evaluate(({ app, BrowserWindow }) => {
    app.focus({ steal: true });
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("?ide"));
    win?.show();
    win?.focus();
    win?.webContents.focus();
  });
  await sleep(600);
}

/** Hides the EMU window again, so it cannot cover the IDE. */
async function hideEmu(klive) {
  await klive.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().includes("?emu"))
      ?.hide();
  });
  await sleep(300);
}

/** The window (IDE or EMU) that shows a dialog now. */
async function pageWithDialog(klive) {
  for (const page of klive.app.windows()) {
    if (!(await page.locator('[role="dialog"]').count())) continue;
    if (page.url().includes("?emu")) return klive.emu({ width: 1180, height: 820 });
    return page;
  }
  throw new Error("No window shows a dialog");
}

/** Text of the command panel. */
const outputText = (ide) => ide.evaluate(() => document.querySelector('[class*="_commandPanel_"]')?.textContent ?? "");

/**
 * Creates a project and makes `file` (project-relative, written with `source`) its build root,
 * then reopens the project. A new file rather than the template's: the template's file is open the
 * moment `newp` returns and its Monaco model outlives `close`/`open` (doc-shots guide).
 */
async function projectWithSource(klive, fixture, { machine, template = "", file, source, extraFiles = {} }) {
  await klive.cmd(`newp ${machine} ${fixture.name} ${template} -p "${fixture.parent}" -o`, machine === "zxnext" ? 12000 : 8000);
  const target = path.join(fixture.project, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
  for (const [rel, content] of Object.entries(extraFiles)) {
    const p = path.join(fixture.project, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  await klive.cmd("close", 2000);
  const projectFile = path.join(fixture.project, "klive.project");
  const project = JSON.parse(fs.readFileSync(projectFile, "utf8"));
  project.builder = { ...(project.builder ?? {}), roots: [file] };
  fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
  await klive.cmd(`open "${fixture.project}"`, 5000);
  await klive.cmd(`nav ${file}`, 2500);
  await klive.cmd("cls", 500);
}

/** Makes sure the editor shows `file`; retries `nav`, as the document area is sometimes empty. */
async function showFile(klive, file) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await klive.ide.locator(".monaco-editor .line-numbers").count()) return;
    await klive.cmd(`nav ${file}`, 2500);
  }
  if (!(await klive.ide.locator(".monaco-editor .line-numbers").count())) throw new Error(`The editor does not show ${file}`);
}

/** The selector of an editor line number. */
const lineNumber = (line) => `.monaco-editor .line-numbers >> text=/^${line}$/`;

/** Clicks the editor's glyph margin on a line, which toggles a breakpoint there. */
async function toggleBreakpoint(ide, line) {
  const box = await ide.locator(lineNumber(line)).first().boundingBox({ timeout: 8000 });
  if (!box) throw new Error(`Line ${line} is not visible in the editor`);
  await ide.mouse.click(box.x - 12, box.y + box.height / 2);
  await sleep(600);
}

/** Opens an activity of the side bar by its accessible name ("Explorer", "Debug", "Machine info"). */
async function activity(klive, name) {
  const tab = klive.ide.locator(`[role="tab"][aria-label="${name}"]`).first();
  // --- Clicking the selected activity hides the side bar: click only when it is not selected
  const selected = (await tab.getAttribute("aria-selected")) === "true";
  const visible = await klive.ide.locator('[class*="_sideBarPanel_"]').first().isVisible().catch(() => false);
  if (!selected || !visible) {
    await tab.click({ force: true });
    await sleep(900);
  }
}

/**
 * Expands only the side-bar sections whose header text matches one of `titles`, collapsing the
 * others.
 */
async function sections(ide, titles) {
  const headers = ide.locator('[class*="_sideBarPanel_"] div[class*="_header_"]');
  const count = await headers.count();
  for (let i = 0; i < count; i++) {
    const h = headers.nth(i);
    const text = (await h.innerText()).trim();
    const want = titles.some((t) => text.toUpperCase().includes(t.toUpperCase()));
    const expanded = await h.evaluate(
      (el) => !!el.nextElementSibling && el.nextElementSibling.getBoundingClientRect().height > 2
    );
    if (expanded !== want) {
      await h.click();
      await sleep(300);
    }
  }
}

/** The side-bar panel (section) whose header contains `title`: header plus content. */
function sectionLocator(ide, title) {
  return ide
    .locator('[class*="_sideBarPanel_"]')
    .filter({ has: ide.locator('div[class*="_header_"]', { hasText: new RegExp(title, "i") }) })
    .first();
}

module.exports = {
  ROOT,
  sleep,
  menu,
  press,
  waitFor,
  park,
  focusIde,
  hideEmu,
  pageWithDialog,
  outputText,
  projectWithSource,
  showFile,
  lineNumber,
  toggleBreakpoint,
  activity,
  sections,
  sectionLocator
};
