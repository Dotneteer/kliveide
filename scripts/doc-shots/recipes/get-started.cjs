/**
 * Screenshots for the Get Started pages (`docs/content/<lang>/get-started/`), in every UI language
 * (`localized: true`; run with `--lang all`). Shots go to `images/<lang>/get-started/`.
 *
 * The recipe walks the same path the reader does - the emulator, the IDE, a first assembly
 * program, debugging it, a BASIC program, a Next program, exporting - and photographs each step.
 * The programs are the tested fixtures in `scripts/doc-shots/fixtures/get-started/` (R5).
 *
 * Translated UIs change every label, so nothing here is selected by its text or aria-label:
 * selectors use CSS-module class prefixes, element order, and the application menu's item ids.
 *
 * `GS_ONLY=emulator,ide,asm,debug,basic,next,export` runs some of the sections (for iterating).
 */
const path = require("path");
const fs = require("fs");
const { fixtureProjectFolder, REPO } = require("../harness.cjs");

const FIXTURES = path.join(REPO, "scripts", "doc-shots", "fixtures", "get-started");
const ONLY = process.env.GS_ONLY ? process.env.GS_ONLY.split(",") : undefined;
const wants = (section) => !ONLY || ONLY.includes(section);

/** Clicks an application menu item by id, waiting for it to exist and be enabled. */
async function menu(klive, id) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const clicked = await klive.app.evaluate(({ Menu }, itemId) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById(itemId);
      if (!item || !item.enabled) return false;
      item.click();
      return true;
    }, id);
    if (clicked) return;
    await klive.sleep(400);
  }
  const ids = await klive.app.evaluate(({ Menu }) => {
    const out = [];
    const walk = (items) => items.forEach((i) => { out.push(`${i.id}${i.enabled ? "" : "(off)"}`); if (i.submenu) walk(i.submenu.items); });
    walk(Menu.getApplicationMenu()?.items ?? []);
    return out.filter((x) => !x.startsWith("null")).join(" ");
  });
  throw new Error(`Menu item ${id} never became available. The menu has: ${ids}`);
}

/** Presses keys in the EMU window; an array is a chord (["AltRight", "p"] is the quote). */
async function press(page, keys) {
  for (const key of keys) {
    const chord = Array.isArray(key) ? key : [key];
    for (const k of chord) await page.keyboard.down(k);
    await new Promise((r) => setTimeout(r, 90));
    for (const k of [...chord].reverse()) await page.keyboard.up(k);
    await new Promise((r) => setTimeout(r, 160));
  }
}

/** Waits until `fn` (evaluated in `page`) returns truthy. */
async function until(page, fn, arg, what, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.evaluate(fn, arg)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

/** The IDE's whole window, without the margin `body` has (see the doc-shots guide). */
const IDE = "#themeRoot";
/** The emulator's screen area and its toolbar. */
const EMU = "#themeRoot";

/** Puts the pointer somewhere harmless, so no tooltip or hover shows in a shot. */
async function park(page) {
  await page.mouse.move(5, 300);
  await new Promise((r) => setTimeout(r, 400));
}

/**
 * The user home the app sees. The ZX Spectrum Next boots NextZXOS from `~/Klive/ks2.cim` and
 * writes to it, so the run gets a throwaway home with a fresh copy of the bundled base image -
 * the same file a new installation starts from. (Klive copies it on its first start, but it
 * reads the home path before the harness redirects it, so the copy would land in the real home.)
 */
const USER_HOME = path.join(require("os").tmpdir(), "klive-get-started-home");
function seedUserHome() {
  const sd = path.join(USER_HOME, "Klive", "ks2.cim");
  fs.mkdirSync(path.dirname(sd), { recursive: true });
  fs.copyFileSync(path.join(REPO, "src", "public", "mmc", "ks2-base.cim"), sd);
}

/** Expands or collapses the Debug side bar's sections, by position (their titles are translated). */
async function debugSections(ide, open) {
  // --- Z80 CPU, Call Stack, ULA & I/O, Variables, Watch, Breakpoints
  const headers = ide.locator('[class*="_sideBarPanel_"] div[class*="_header_"]');
  const count = await headers.count();
  for (let i = 0; i < count; i++) {
    const expanded = await headers
      .nth(i)
      .evaluate((h) => !!h.nextElementSibling && h.nextElementSibling.getBoundingClientRect().height > 2);
    if (expanded !== open.includes(i)) {
      await headers.nth(i).click();
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

/** The fixture projects of the current run, removed when it ends even if it fails. */
const created = [];

/** Creates a project from a template and replaces its code file with a fixture's. */
async function createProject(klive, machine, template, fixtureName, codeFile) {
  const fx = fixtureProjectFolder(`GetStarted${fixtureName.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())}`);
  created.push(fx);
  // --- Create, replace the template's code with the fixture, then reopen the project: the new
  // --- project opens its build root at once, so the editor would keep the template's text
  await klive.cmd(`newp ${machine} ${fx.name} ${template} -p "${fx.parent}"`, 6000);
  fs.copyFileSync(path.join(FIXTURES, fixtureName, "code", codeFile), path.join(fx.project, "code", codeFile));
  await klive.cmd(`open "${fx.project}"`, 6000);
  await klive.cmd(`nav code/${codeFile}`, 2500);
  await klive.cmd("cls", 600);
  return fx;
}

/** The window (IDE or EMU) that shows a dialog now. */
async function pageWithDialog(klive) {
  for (const page of klive.app.windows()) {
    if (!(await page.locator('[role="dialog"]').count())) continue;
    // --- A dialog in the hidden EMU window never settles (no frames are drawn), so Playwright
    // --- would wait for it forever: show the window, large enough for the dialog
    if (page.url().includes("?emu")) return klive.emu({ width: 1180, height: 820 });
    return page;
  }
  throw new Error("No window shows a dialog");
}

/** Brings the IDE window to the front with the keyboard, so the full application menu is in place. */
async function focusIde(klive) {
  // --- On macOS the menu's submenus are installed only while a Klive window has the OS focus
  // --- (`setupMenu` in src/main/app-menu.ts), and a Playwright-launched app may not have it
  await klive.app.evaluate(({ app, BrowserWindow }) => {
    app.focus({ steal: true });
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("?ide"));
    win?.show();
    win?.focus();
    win?.webContents.focus();
  });
  await klive.sleep(600);
}

/** Clicks the editor's glyph margin on a line, which toggles a breakpoint there. */
async function toggleBreakpoint(ide, line) {
  const number = ide.locator(".monaco-editor .line-numbers", { hasText: new RegExp(`^${line}$`) }).first();
  const box = await number.boundingBox({ timeout: 8000 }).catch(async (e) => {
    await ide.screenshot({ path: path.join(require("os").tmpdir(), "klive-gs-breakpoint-fail.png") });
    throw e;
  });
  if (!box) throw new Error(`Line ${line} is not visible in the editor`);
  // --- The glyph margin sits left of the line numbers
  await ide.mouse.click(box.x - 12, box.y + box.height / 2);
  await new Promise((r) => setTimeout(r, 600));
}

module.exports = {
  name: "get-started",
  localized: true,
  // --- The ZX Spectrum Next writes its SD card image under the user's home: keep it out of the real one
  window: {
    width: 1280,
    height: 820,
    toolPanelHeight: "200px",
    sideBarWidth: "280px",
    userHome: USER_HOME
  },

  async run(klive) {
    seedUserHome();
    try {
      await steps(klive);
    } finally {
      while (created.length) created.pop().cleanup();
    }
  }
};

async function steps(klive) {
    const shot = klive.shot;

    // ------------------------------------------------------------------ Meet the emulator
    if (wants("emulator")) {
      const emu = await klive.emu({ width: 860, height: 660 });
      await park(emu);
      await shot(EMU, "get-started/emulator-off.webp", {
        displayWidth: 620,
        page: emu,
        markers: {
          toolbar: { selector: '[class*="_primaryButton_"]', x: 0.5, y: 0.5 },
          screen: { selector: "canvas", x: 0.5, y: 0.5 }
        }
      });

      await klive.cmd("em-start", 4500);
      await park(emu);
      await shot(EMU, "get-started/emulator-running.webp", { displayWidth: 620, page: emu });

      // --- 10 PRINT "HELLO", then RUN: P is PRINT in K mode, Symbol Shift (right Alt) + P the quote
      await emu.locator("canvas").first().click();
      await press(emu, ["1", "0", "p", ["AltRight", "p"], "h", "e", "l", "l", "o", ["AltRight", "p"], "Enter"]);
      await klive.sleep(700);
      await shot(EMU, "get-started/emulator-basic-line.webp", { displayWidth: 620, page: emu });
      await press(emu, ["r", "Enter"]);
      await klive.sleep(1200);
      await park(emu);
      await shot(EMU, "get-started/emulator-hello.webp", { displayWidth: 620, page: emu });

      // --- The machine selector. While the emulator has the keyboard, Klive swaps in a reduced
      // --- application menu (so typing cannot fire menu shortcuts); focus the IDE first, and the
      // --- dialog opens there
      // --- (The status bar's machine chip opens it, as the menu item does; the menu cannot be
      // --- clicked reliably from a script: see focusIde)
      await emu.locator('button[class*="_chip_"]').first().click();
      await klive.sleep(1500);
      const dialogPage = await pageWithDialog(klive);
      await park(dialogPage);
      await shot('[role="dialog"]', "get-started/select-machine.webp", { displayWidth: 760, page: dialogPage });
      await dialogPage.keyboard.press("Escape");
      await klive.sleep(600);
      await klive.cmd("em-stop", 1500);
    }

    // ------------------------------------------------------------------ Meet the IDE
    let asm;
    if (wants("ide") || wants("asm") || wants("debug")) {
      asm = await createProject(klive, "sp48", "default", "border-colours", "code.kz80.asm");
    }
    if (wants("ide")) {
      await focusIde(klive);
      await park(klive.ide);
      await shot(IDE, "get-started/ide-tour.webp", {
        displayWidth: 900,
        markers: {
          toolbar: { selector: '[class*="_primaryButton_"]' },
          activities: { selector: '[class*="_activityButton_"]' },
          explorer: { selector: '[class*="_sideBarPanel_"]', x: 0.5, y: 0.35 },
          editor: { selector: ".monaco-editor", x: 0.55, y: 0.45 },
          buildbar: { selector: '[class*="_documentsHeader_"] [class*="_tabButton_"]', x: 0.5, y: 0.5 },
          tools: { selector: '[class*="_toolsHeader_"]', x: 0.12, y: 0.5 },
          prompt: { selector: 'input[class*="_prompt_"]', x: 0.3, y: 0.5 },
          status: { selector: '[class*="_ideStatusBar_"]', x: 0.15, y: 0.5 }
        }
      });

      // --- Settings, Language page
      await klive.cmd("settings language", 1500);
      const settingsPage = await pageWithDialog(klive);
      await park(settingsPage);
      await shot('[role="dialog"]', "get-started/settings-language.webp", {
        displayWidth: 760,
        page: settingsPage,
        markers: { language: { selector: '[role="dialog"] select, [role="dialog"] [role="combobox"], [role="dialog"] [class*="_dropdown"]' } }
      });
      await settingsPage.keyboard.press("Escape");
      await klive.sleep(500);
    }

    // ------------------------------------------------------------------ Your first assembly program
    if (wants("asm")) {
      // --- No folder open: the Explorer offers New Project and Open Folder
      await focusIde(klive);
      await klive.cmd("close", 2500);
      await klive.cmd("cls", 500);
      await park(klive.ide);
      await shot(IDE, "get-started/ide-no-project.webp", {
        displayWidth: 900,
        // --- The empty state's buttons: Open Folder, then Create a Klive Project
        markers: { newproject: { selector: '[class*="_sideBarPanel_"] button >> nth=1' } }
      });
      await klive.ide.locator('[class*="_sideBarPanel_"] button').nth(1).click();
      await klive.sleep(1500);
      const newProjectPage = await pageWithDialog(klive);
      // --- The project name is the dialog's last text field; filled, the dialog shows no error
      await newProjectPage.locator('[role="dialog"] input[type="text"], [role="dialog"] input:not([type])').last().fill("BorderColours");
      await klive.sleep(400);
      await park(newProjectPage);
      await shot('[role="dialog"]', "get-started/new-project.webp", { displayWidth: 620, page: newProjectPage });
      await newProjectPage.keyboard.press("Escape");
      await klive.sleep(600);
      await klive.cmd(`open "${asm.project}"`, 6000);
      await klive.cmd("nav code/code.kz80.asm", 2500);

      await klive.cmd("cls", 500);
      await park(klive.ide);
      await shot(IDE, "get-started/first-program.webp", {
        displayWidth: 900,
        markers: {
          buildroot: { selector: '[class*="_sideBarPanel_"] [class*="_nodeIconGroup_"]' },
          run: { selector: '[class*="_documentsHeader_"] button[data-icon="play"]' },
          debug: { selector: '[class*="_documentsHeader_"] button[data-icon="debug"]' }
        }
      });

      await klive.cmd("run", 6000);
      const emu = await klive.emu({ width: 860, height: 660 });
      await park(emu);
      await shot(EMU, "get-started/first-program-running.webp", { displayWidth: 620, page: emu });
      await focusIde(klive);
      await shot(IDE, "get-started/first-program-output.webp", {
        displayWidth: 900,
        markers: { output: { selector: '[class*="_outputWrapper_"]', x: 0.3, y: 0.3 } }
      });
      await klive.cmd("em-stop", 1500);
    }

    // ------------------------------------------------------------------ Debug your program
    if (wants("debug")) {
      await klive.cmd("nav code/code.kz80.asm", 2500);
      await klive.cmd("cls", 500);
      await toggleBreakpoint(klive.ide, 13);
      await klive.ide.locator('[class*="_activityButton_"] >> nth=1').click();
      await klive.sleep(800);
      await klive.cmd("debug", 7000);
      await focusIde(klive);
      await park(klive.ide);
      await shot(IDE, "get-started/debug-paused.webp", {
        displayWidth: 900,
        markers: {
          breakpoint: { selector: ".monaco-editor .line-numbers >> text=/^13$/", x: -0.6, y: 0.5 },
          stepover: { selector: 'button[data-icon="step-over"]' },
          registers: { selector: '[class*="_sideBarPanel_"]', x: 0.5, y: 0.2 }
        }
      });
      await focusIde(klive);
      await klive.ide.locator('button[data-icon="step-over"]').click();
      await klive.sleep(800);
      await klive.ide.locator('button[data-icon="step-over"]').click();
      await klive.sleep(800);
      await park(klive.ide);
      await shot(IDE, "get-started/debug-stepped.webp", {
        displayWidth: 900,
        markers: { current: { selector: ".monaco-editor .line-numbers >> text=/^16$/", x: 3, y: 0.5 } }
      });
      const emu = await klive.emu({ width: 860, height: 660 });
      await park(emu);
      await shot(EMU, "get-started/debug-emulator.webp", { displayWidth: 620, page: emu });
      await klive.cmd("em-stop", 1500);
      await toggleBreakpoint(klive.ide, 13);
    }

    if (asm) asm.cleanup();

    // ------------------------------------------------------------------ Your first BASIC program
    if (wants("basic")) {
      const basic = await createProject(klive, "sp48", "zx-basic", "bouncing-ball", "program.zxbas");
      try {
        await klive.cmd("run", 8000);
        const emu = await klive.emu({ width: 860, height: 660 });
        await klive.sleep(1500);
        await park(emu);
        await shot(EMU, "get-started/basic-running.webp", { displayWidth: 620, page: emu });
        await klive.cmd("em-stop", 1500);

        await focusIde(klive);
        // --- Reopen the source: the editor may have no document after the run
        await klive.cmd("nav code/program.zxbas", 2500);
        await klive.cmd("cls", 500);
        await toggleBreakpoint(klive.ide, 9);
        await klive.ide.locator('[class*="_activityButton_"] >> nth=1').click();
        await klive.sleep(800);
        await klive.cmd("debug", 9000);
        await focusIde(klive);
        await debugSections(klive.ide, [1, 3]);
        await park(klive.ide);
        await shot(IDE, "get-started/basic-debug.webp", {
          displayWidth: 900,
          markers: {
            breakpoint: { selector: ".monaco-editor .line-numbers >> text=/^9$/", x: -0.6, y: 0.5 },
            callstack: { selector: '[class*="_sideBarPanel_"] div[class*="_header_"] >> nth=1', x: 0.75, y: 0.5 },
            variables: { selector: '[class*="_sideBarPanel_"] div[class*="_header_"] >> nth=3', x: 0.75, y: 0.5 }
          }
        });
        await debugSections(klive.ide, [0, 4, 5]);
        await klive.cmd("em-stop", 1500);
        await toggleBreakpoint(klive.ide, 9);
      } finally {
        basic.cleanup();
      }
    }

    // ------------------------------------------------------------------ Your first Next program
    if (wants("next")) {
      const next = await createProject(klive, "zxnext", "default", "next-sprite", "code.kz80.asm");
      try {
        await park(klive.ide);
        await klive.cmd("run", 30000);
        const emu = await klive.emu({ width: 860, height: 700 });
        // --- The sprite moves a pixel a frame from the left edge: let it reach the middle
        await klive.sleep(3500);
        await park(emu);
        await shot(EMU, "get-started/next-running.webp", { displayWidth: 620, page: emu });
        await klive.cmd("em-stop", 2000);
      } finally {
        next.cleanup();
      }
    }

    // ------------------------------------------------------------------ Save and share your work
    if (wants("export")) {
      const share = await createProject(klive, "sp48", "default", "border-colours", "code.kz80.asm");
      try {
        await focusIde(klive);
        await klive.cmd("run-build-function exportCode", 2500);
        const exportPage = await pageWithDialog(klive);
        // --- File name and program name: the dialog's second and third text fields
        const fields = exportPage.locator('[role="dialog"] input[type="text"], [role="dialog"] input:not([type])');
        await fields.nth(1).fill("border-colours");
        await fields.nth(2).fill("colours");
        await klive.sleep(400);
        await park(exportPage);
        await shot('[role="dialog"]', "get-started/export-dialog.webp", { displayWidth: 620, page: exportPage });
        await exportPage.keyboard.press("Escape");
        await klive.sleep(500);
      } finally {
        share.cleanup();
      }
    }
}
