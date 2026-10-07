/**
 * Screenshot for the "Folding interrupts" section of
 * `docs/content/working-with-ide/execution-history.mdx`, and the running-app check of execution
 * history on the cores other than the Next (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` Phase 6).
 *
 * - The ZX81 boots in a debug session; paused at the editor, the history has 65,536 records, folds
 *   interrupt service by default (its NMIs and the display it draws from one), and a folded row
 *   opens with a click. Photographed: `working-with-ide/execution-history-fold.png`.
 * - The ZX Spectrum 48K the same way: it records, and does not fold by default - the ROM's IM 1
 *   interrupt is a separator row of its own.
 */
const os = require("os");
const path = require("path");
const fs = require("fs");
const { IMAGES } = require("../harness.cjs");

const fail = (what, state) => {
  throw new Error(`${what}: ${JSON.stringify(state)}`);
};

/** What the Execution History document shows */
const historyState = (ide) =>
  ide.evaluate(() => {
    const text = (sel) => document.querySelector(sel)?.textContent ?? "";
    const rows = [...document.querySelectorAll('[class*="_row_"]')].filter((r) => r.querySelector('[class*="_step_"]'));
    const fold = [...document.querySelectorAll("label, span")].find((e) => /^Fold interrupts:/.test(e.textContent ?? ""));
    return {
      count: text('[class*="_count_"]'),
      recording: text('[class*="_recording_"]'),
      empty: text('[class*="_emptyState_"]'),
      rows: rows.length,
      separators: rows.filter((r) => /_separatorRow_/.test(r.className)).map((r) => r.textContent),
      folds: document.querySelectorAll('[class*="_fold_"]').length,
      foldSwitch: fold?.parentElement?.textContent ?? "",
      instructions: [...document.querySelectorAll('[class*="_instruction_"]')].map((e) => e.textContent).slice(-6)
    };
  });

async function waitFor(ide, klive, pred, what) {
  for (let i = 0; i < 30; i++) {
    const s = await historyState(ide);
    if (pred(s)) return s;
    await klive.sleep(300);
  }
  fail(what, await historyState(ide));
}

/** Selects a machine model through its menu item (as `zx81.cjs` does) */
async function selectModel(klive, itemId) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const clicked = await klive.app.evaluate(({ Menu }, id) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById(id);
      if (!item || !item.enabled) return false;
      item.click();
      return true;
    }, itemId);
    if (clicked) return;
    await klive.sleep(500);
  }
  throw new Error(`The menu item ${itemId} never appeared`);
}

/** Forgets the fold choices a previous run stored, so each machine shows its default */
const forgetFoldChoices = (klive) =>
  klive.ide.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("klive.executionHistory.foldService.")) localStorage.removeItem(key);
    }
  });

/** Boots the current machine with debugging, pauses it, and opens the history */
async function debugAndPause(klive, bootMs) {
  await klive.cmd("em-debug", bootMs);
  await klive.cmd("em-pause", 1500);
  await klive.cmd("show-history", 2500);
}

module.exports = {
  name: "execution-history-cores",
  window: {
    width: 1200,
    height: 860,
    sideBarWidth: "200px",
    toolPanelHeight: "90px",
    panelFontFamily: "iosevka",
    panelFontSize: 12,
    userHome: path.join(os.tmpdir(), "klive-shots-history-cores-home")
  },

  async run(klive) {
    // --- The ZX Spectrum 48K (the machine Klive starts with): records, not folded by default
    await forgetFoldChoices(klive);
    await debugAndPause(klive, 4000);
    let state = await waitFor(klive.ide, klive, (s) => s.rows > 10, "No history rows on the 48K");
    console.log("  48K ·", JSON.stringify(state));
    if (!/^[\d,]+ of 65,536 recorded$/.test(state.count)) fail("The 48K does not hold 65,536 records", state.count);
    if (!/Recording/.test(state.recording)) fail("The 48K does not record", state.recording);
    if (state.separators.some((t) => /service/.test(t))) fail("The 48K folds by default", state.separators);
    await klive.cmd("em-stop", 1500);

    // --- The ZX81: folded by default
    await forgetFoldChoices(klive);
    await selectModel(klive, "machine_zx81_zx81-16k");
    await klive.sleep(2500);
    await debugAndPause(klive, 5000);
    state = await waitFor(klive.ide, klive, (s) => s.rows > 10 && s.separators.length > 0, "No history rows on the ZX81");
    console.log("  ZX81 ·", JSON.stringify(state));
    if (!/^[\d,]+ of 65,536 recorded$/.test(state.count)) fail("The ZX81 does not hold 65,536 records", state.count);
    if (!state.separators.some((t) => /service, [\d,]+ instructions?/.test(t))) fail("No folded service row on the ZX81", state.separators);
    if (!state.folds) fail("No fold glyph on the ZX81", state);

    const shot = path.join(IMAGES, "working-with-ide", "execution-history-fold.png");
    fs.mkdirSync(path.dirname(shot), { recursive: true });
    await klive.ide.screenshot({ path: shot });
    console.log(`  ✓ ${path.relative(process.cwd(), shot)}`);

    // --- Open the newest folded service: its instructions appear under it
    const glyphs = klive.ide.locator('[class*="_fold_"]');
    await glyphs.nth((await glyphs.count()) - 1).click();
    await klive.sleep(800);
    state = await historyState(klive.ide);
    console.log("  opened ·", JSON.stringify({ separators: state.separators.slice(-3), instructions: state.instructions }));
    if (!state.separators.some((t) => /▾/.test(t))) fail("The service did not open", state.separators);
    await klive.cmd("em-stop", 1500);
  }
};
