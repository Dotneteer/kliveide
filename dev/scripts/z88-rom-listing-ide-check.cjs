#!/usr/bin/env node

/*
 * The Z88 OZ 4.7 ROM page listings in the running IDE (`dev/plans/Z88_OZ47_ROM_ANNOTATIONS_PLAN.md`,
 * Phase 3, "Across banks"): a ROM page document names an absolute operand where its run runs, and from
 * the pages paged in with it (`romRunNaming.ts`), not as if the whole page ran where it is listed.
 *
 * Launches the built Klive under Playwright (`dev/scripts/doc-shots/harness.cjs`) with a throwaway home
 * whose ROM annotation working copy is the current import, opens the ROM annotation editor
 * (`rom-ann-open`), opens three pages' listings from it, scrolls each listing through and checks:
 *
 *   - bank $0A: the Filer (run at $E400, listed with EazyLink at $8000) names its own calls
 *     (`call PrntDotClose`);
 *   - bank 5: PipeDream's calls into its other half, bank 6, are named (`call L_D631`);
 *   - bank 2: LOWRAM (stored at $0800, run at $0000) names its restart jumps (`jp FPPmain`).
 *
 *   node dev/scripts/import-oz-source.cjs --all                          # .local/oz-import/ current
 *   npx electron-vite build --config build/electron.vite.config.ts   # out/ must be current
 *   node dev/scripts/z88-rom-listing-ide-check.cjs
 *
 * Output (screenshots, the throwaway home) goes to `.local/z88-rom-listing-ide-check/`.
 */

const fs = require("node:fs");
const path = require("node:path");
const { launchKlive, REPO } = require("./doc-shots/harness.cjs");

const OUT = path.join(REPO, ".local", "z88-rom-listing-ide-check");
const IMPORT = path.join(REPO, ".local", "oz-import", "z88v47.rom.dis");
const CASES = [
  { page: 10, text: "call PrntDotClose", what: "bank $0A: the Filer names its own calls (run at $E400)" },
  { page: 5, text: "call L_D631", what: "bank 5: PipeDream names its calls into bank 6" },
  { page: 2, text: "jp FPPmain", what: "bank 2: LOWRAM names its jumps at its RAM address" }
];

(async () => {
  if (!fs.existsSync(IMPORT)) {
    console.log(`FAIL ${IMPORT} is missing: run node dev/scripts/import-oz-source.cjs --all`);
    process.exit(1);
  }
  fs.rmSync(OUT, { recursive: true, force: true });
  const userHome = path.join(OUT, "home");
  const working = path.join(userHome, "Klive", "RomAnnotations", "z88v47.rom.dis");
  fs.mkdirSync(path.dirname(working), { recursive: true });
  fs.copyFileSync(IMPORT, working);
  const failures = [];
  const check = (ok, what) => {
    console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
    if (!ok) failures.push(what);
  };

  const klive = await launchKlive({
    home: path.join(OUT, "klive"),
    userHome,
    height: 900,
    sessionSettings: { machineId: "z88", modelId: "OZ47" }
  });
  const { app, ide, cmd, sleep } = klive;

  try {
    await cmd("rom-ann-open z88v47.rom -page 0", 3000);
    for (const { page, text, what } of CASES) {
      // --- The editor lists one row per page ("OZ 4.7, bank 0Ah"); its first icon button opens the
      // --- page's disassembly, the second its memory
      const name = `bank ${page.toString(16).toUpperCase().padStart(2, "0")}h`;
      // --- Back to the editor's tab: the previous page's listing took the focus
      await ide.getByText("z88v47.rom.dis", { exact: true }).first().click();
      await sleep(800);
      const clicked = await ide.evaluate((wanted) => {
        // --- `data-icon` is IconButton's language-neutral handle; the row is the nearest ancestor that
        // --- names its page
        // --- names exactly one page (a toolbar's `logs` button has no such ancestor short of the window)
        for (const button of document.querySelectorAll('button[data-icon="logs"]')) {
          let row = button.parentElement;
          while (row && !/bank [0-9A-F]{2}h/.test(row.textContent ?? "")) row = row.parentElement;
          const pages = (row?.textContent ?? "").match(/bank [0-9A-F]{2}h/g) ?? [];
          if (pages.length === 1 && pages[0] === wanted) {
            button.click();
            return true;
          }
        }
        return false;
      }, name);
      if (!clicked) {
        await ide.screenshot({ path: path.join(OUT, "editor.png") });
        check(false, `${what} (no row for ${name} in the ROM annotation editor)`);
        continue;
      }
      await sleep(2500);
      const found = await ide.evaluate(async (wanted) => {
        // --- The listing is virtual: scroll its tallest scroller through and read each screen
        const scrollers = [...document.querySelectorAll("*")].filter(
          (e) => e.scrollHeight > e.clientHeight + 100 && getComputedStyle(e).overflowY !== "visible"
        );
        const list = scrollers.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
        if (!list) return { found: false, why: "no scroller" };
        for (let top = 0; top <= list.scrollHeight; top += Math.max(200, list.clientHeight - 40)) {
          list.scrollTop = top;
          await new Promise((r) => setTimeout(r, 30));
          if (list.innerText.includes(wanted)) return { found: true, top };
        }
        return { found: false, why: `scrolled ${list.scrollHeight}px` };
      }, text);
      await ide.screenshot({ path: path.join(OUT, `page-${page}.png`) });
      check(found.found, `${what}: "${text}"${found.found ? "" : ` (${found.why})`}`);
    }
  } catch (err) {
    failures.push(String(err));
    console.log(`FAIL ${err}`);
  } finally {
    await app.close();
  }
  if (failures.length > 0) {
    console.log(`\n${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log("\nAll Z88 ROM listing IDE checks passed.");
})();
