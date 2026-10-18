/**
 * Documentation screenshot harness.
 *
 * Launches Klive under Playwright's Electron driver, drives it through the IDE's own
 * interactive command prompt, and captures element-scoped PNGs. Scoping each shot to a
 * DOM element means there is no manual cropping step and no OS window chrome in the
 * image, and the crop follows the layout when the layout changes.
 *
 * Determinism comes from four things:
 *   - `KLIVE_SETTINGS_FILE` points at a throwaway settings file (see
 *     `src/main/settings-path.ts`), so a developer's own window geometry, theme and
 *     recent-project list never leak into a screenshot.
 *   - That file is *seeded* before launch, which pins theme, accent, panel sizes and
 *     fonts. See `.ai/doc-screenshots-guide.md` for why this works.
 *   - The IDE window's content size is set explicitly, so layout does not depend on the
 *     display the shots happen to be generated on.
 *   - The EMU window is hidden; only the IDE is photographed.
 *
 * Output goes to a staging folder for review, NOT over the committed assets. Publish
 * approved shots by pointing `DOC_SHOTS_OUT` at `docs/public/images`.
 */
const { _electron: electron } = require("playwright");
const path = require("path");
const fs = require("fs");

const REPO = path.join(__dirname, "..", "..");
const MAIN = path.join(REPO, "out", "main", "index.js");
// --- Staging by default: a recipe is eyeballed against the committed version before it
// --- replaces anything. `DOC_SHOTS_OUT=docs/public/images` publishes.
const IMAGES = process.env.DOC_SHOTS_OUT
  ? path.resolve(REPO, process.env.DOC_SHOTS_OUT)
  : path.join(REPO, ".doc-shots");

// --- `sharp` lives in the docs workspace; these scripts are docs tooling, so it is
// --- resolved from there rather than duplicated as a root dependency.
function loadSharp() {
  for (const base of [REPO, path.join(REPO, "docs")]) {
    try {
      return require(require.resolve("sharp", { paths: [base] }));
    } catch {
      /* try the next location */
    }
  }
  throw new Error("sharp not found — run `npm run doc:install` first.");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Launches Klive with an isolated home folder and returns a driver object.
 */
async function launchKlive({
  home,
  width = 1280,
  height = 820,
  sideBarWidth = "260px",
  toolPanelHeight = "260px",
  theme = "dark",
  accent,
  /*
   * The monitoring panels' font, which decides how much of a dense row fits in a given width.
   *
   * Defaults reproduce what every recipe written before this parameter existed already got, so
   * adding it changes no existing shot. A recipe photographing the disassembly view needs control
   * of it: that view swaps layouts on a container query measured in `ch`, so the font's advance
   * width and size together decide which layout the screenshot shows.
   */
  panelFontFamily = "jetbrains-mono",
  panelFontSize = 14,
  /*
   * The user home the app sees (`HOME`), for a run that must not touch the real one: Klive keeps
   * its SD card image (`~/Klive/ks2.cim`, written by every ZX Spectrum Next launch) and its exports
   * under it. Unset, the app uses the real home, as every recipe did before this option existed.
   */
  userHome,
  /*
   * User settings, as `set -u` would have stored them (nested: `{ features: { advancedDebugging:
   * "1" } }`). Read at startup, so a setting that needs a restart - the advanced-debugging switch -
   * is in force from the first frame. Unset, none.
   */
  userSettings,
  /*
   * More global `ideViewOptions` (`{ profilerInlays: true }`): IDE view settings are global, which
   * `set -u` does not reach. Unset, none.
   */
  ideViewOptions = {},
  /*
   * More global settings, merged at the top of `globalSettings` (`{ emuOptions: { machineFavorites:
   * [...] } }`, which lists a machine in the Machine type menu). Unset, none.
   */
  globalSettings = {},
  /*
   * The answer to the Boriel BASIC setup offer, as the settings file records it. The default declines
   * every version, so no offer covers the windows a recipe drives; `null` seeds nothing, so a run
   * that checks the offer itself sees it (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §3.2).
   */
  borielSetup = { declined: true, offeredVersion: "*" },
  /*
   * The UI language (an `id` from `src/common/i18n/languages.ts`). A localized recipe runs once per
   * language and its `shot()` paths get the language as their first folder
   * (`images/<lang>/...`), so a translated page shows the IDE in its own language (R4 of
   * `.plans/DOCS_SITE_MODERNIZATION_PLAN.md`). Unset, English, and paths are left as they are.
   */
  lang
}) {
  if (!fs.existsSync(MAIN)) {
    throw new Error(`No build at ${MAIN} — run \`npx electron-vite build --config build/electron.vite.config.ts\` first.`);
  }

  fs.rmSync(home, { recursive: true, force: true });
  fs.mkdirSync(home, { recursive: true });
  const settings = path.join(home, "klive.settings");

  // --- Pin everything a screenshot can see. Panel sizes and fonts are global
  // --- settings, so they are seeded here rather than set through `set`, which writes
  // --- user/project scope and would not reach the layout.
  fs.writeFileSync(
    settings,
    JSON.stringify(
      {
        startScreenDisplayed: true,
        ...(borielSetup ? { borielSetup } : {}),
        theme,
        ...(accent ? { accent } : {}),
        windowStates: { showIdeOnStartup: true },
        ...(userSettings ? { userSettings } : {}),
        globalSettings: {
          ideViewOptions: {
            showSidebar: true,
            showTools: true,
            maximizeTools: false,
            sideBarWidth,
            toolPanelHeight,
            // --- English, whatever the OS language, unless the recipe is localized: the docs
            // --- show the UI in the page's language (`.plans/LOCALIZATION_PLAN.md` step 2)
            language: lang ?? "en",
            i18nShowKeys: false,
            ...ideViewOptions
          },
          editorOptions: { fontFamily: "iosevka", fontSize: 16 },
          panelOptions: { fontFamily: panelFontFamily, fontSize: panelFontSize },
          ...globalSettings
        }
      },
      null,
      2
    )
  );

  const app = await electron.launch({
    executablePath: require(path.join(REPO, "node_modules", "electron")),
    args: [MAIN, "--showide"],
    cwd: REPO,
    env: { ...process.env, KLIVE_SETTINGS_FILE: settings, ...(userHome ? { HOME: userHome } : {}) },
    timeout: 60_000
  });

  // --- On macOS Electron's home path does not follow HOME: set it in the app itself, before any
  // --- command can reach the SD card image or the exports folder under it
  if (userHome) await app.evaluate(({ app: electronApp }, home) => electronApp.setPath("home", home), userHome);

  const deadline = Date.now() + 30_000;
  while (app.windows().length < 2 && Date.now() < deadline) await sleep(250);

  const ide = app.windows().find((w) => w.url().includes("?ide"));
  if (!ide) throw new Error("IDE window never appeared");
  await ide.waitForLoadState("domcontentloaded");
  await sleep(4000);

  await app.evaluate(
    async ({ BrowserWindow }, size) => {
      const wins = BrowserWindow.getAllWindows();
      const ideWin = wins.find((w) => w.webContents.getURL().includes("?ide"));
      const emuWin = wins.find((w) => w.webContents.getURL().includes("?emu"));
      // --- The emulator window is never photographed by these recipes and would
      // --- otherwise sit on top of the IDE while the shots are taken.
      emuWin?.hide();
      // --- View > Zoom persists per origin across runs (Chromium keeps it in the shared user
      // --- data), and a zoom other than 1 makes Playwright's element crops miss the element:
      // --- shots then gain a black margin on the right and bottom. Pin it.
      ideWin.webContents.setZoomFactor(1);
      emuWin?.webContents.setZoomFactor(1);
      ideWin.setPosition(60, 60);
      ideWin.setContentSize(size.width, size.height);
      ideWin.show();
      ideWin.focus();
      ideWin.webContents.focus();
    },
    { width, height }
  );
  await sleep(1200);

  const prompt = ide.locator('input[class*="_prompt_"]');

  /** Types a command into the IDE's interactive prompt and waits for it to settle. */
  async function cmd(text, wait = 2000) {
    await prompt.click();
    await prompt.fill(text);
    await prompt.press("Enter");
    await sleep(wait);
  }

  /**
   * Captures one element and writes it under docs/public/images.
   * `displayWidth` is the width the MDX renders the image at; the image is written at
   * 2x that so it stays crisp on retina displays, matching the existing assets.
   *
   * A `.webp` path is written as near-lossless WebP (about a third smaller than PNG for UI
   * shots); anything else as PNG.
   *
   * `markers` names points of interest for the `<Shot>` component's numbered badges:
   * `{ breakpoint: '[data-line="5"] [class*="_glyph_"]', ... }`. Each selector's box centre,
   * relative to the captured element, is written as a percentage to `<image>.json`, so the
   * badges follow the layout when it changes. A value may also be `{ selector, x, y }`, where
   * `x`/`y` (0..1) pick a point inside the selector's box instead of its centre, or
   * `{ page, selector, x, y }` to measure in another window (the EMU window).
   *
   * `page` captures another window instead of the IDE (pass `klive.emu()`).
   */
  async function shot(selector, relPath, { displayWidth, markers, page = ide } = {}) {
    if (lang) relPath = path.join(lang, relPath);
    const target = path.join(IMAGES, relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const element = page.locator(selector).first();
    const buffer = await element.screenshot();
    const sharp = loadSharp();
    let pipeline = sharp(buffer);
    if (displayWidth) pipeline = pipeline.resize({ width: displayWidth * 2 });
    // --- 144 dpi marks the file as 2x, the same as the hand-captured screenshots.
    pipeline = pipeline.withMetadata({ density: 144 });
    pipeline = target.endsWith(".webp") ? pipeline.webp({ nearLossless: true, quality: 90 }) : pipeline.png();
    await pipeline.toFile(target);
    const meta = await sharp(target).metadata();

    const sidecar = `${target}.json`;
    if (markers) {
      const box = await element.boundingBox();
      const points = {};
      for (const [name, spec] of Object.entries(markers)) {
        const m = typeof spec === "string" ? { selector: spec } : spec;
        const mbox = await (m.page ?? page).locator(m.selector).first().boundingBox();
        if (!mbox) throw new Error(`Marker "${name}": nothing matches ${m.selector}`);
        const px = mbox.x + mbox.width * (m.x ?? 0.5);
        const py = mbox.y + mbox.height * (m.y ?? 0.5);
        points[name] = {
          x: +(((px - box.x) / box.width) * 100).toFixed(1),
          y: +(((py - box.y) / box.height) * 100).toFixed(1)
        };
      }
      fs.writeFileSync(sidecar, JSON.stringify({ width: meta.width, height: meta.height, markers: points }, null, 2) + "\n");
    } else if (fs.existsSync(sidecar)) {
      fs.rmSync(sidecar);
    }
    console.log(`  ✓ ${relPath}  ${meta.width}x${meta.height}${markers ? `  (${Object.keys(markers).length} markers)` : ""}`);
    return target;
  }

  /**
   * The EMU window's page (shown, focused and sized), for recipes that photograph the emulator.
   * The window keeps whatever size it had otherwise, which depends on the display.
   */
  async function emu({ width: emuWidth = 900, height: emuHeight = 760 } = {}) {
    await app.evaluate(({ BrowserWindow }, size) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("?emu"));
      win?.setContentSize(size.width, size.height);
      win?.show();
      win?.focus();
    }, { width: emuWidth, height: emuHeight });
    await sleep(800);
    return app.windows().find((w) => w.url().includes("?emu"));
  }

  // --- Clear the prompt history so the Commands pane starts empty in every shot.
  await cmd("cls", 700);

  return { app, ide, cmd, shot, emu, sleep, lang: lang ?? "en", close: () => app.close() };
}

/**
 * Resolves the folder a recipe should create its fixture project in.
 *
 * Screenshots show absolute paths — script output, the project explorer and the editor
 * tab strip all print them — so a fixture generated in a temp folder puts
 * `/var/folders/6l/y2qnxq.../MyFirstKliveProject` in front of the reader. The fixture
 * therefore lives where a real user's would, under `~/KliveProjects`.
 *
 * The guard is what makes that safe: an existing folder is never opened, written to or
 * deleted. If the name is taken the run stops and the caller is asked to move it, rather
 * than a recipe quietly screenshotting — or overwriting — someone's actual project. This
 * is not hypothetical: the author's own `~/KliveProjects/MyFirstKliveProject` is the very
 * project the committed scripting screenshots were taken from.
 *
 * `DOC_SHOTS_PROJECT` renames the fixture for a run that must not disturb it. The cost is
 * that the name then differs from the one the prose uses, so published shots should be
 * generated with the documented name.
 */
function fixtureProjectFolder(name) {
  name = process.env.DOC_SHOTS_PROJECT || name;
  const parent = path.join(require("os").homedir(), "KliveProjects");
  const project = path.join(parent, name);
  if (fs.existsSync(project)) {
    throw new Error(
      `Refusing to touch ${project}: it already exists.\n` +
        "Doc-shot fixtures must be generated, never reused — an existing folder may be a real\n" +
        "project. Move or rename it, then re-run."
    );
  }
  fs.mkdirSync(parent, { recursive: true });
  return {
    name,
    parent,
    project,
    cleanup: () => fs.rmSync(project, { recursive: true, force: true })
  };
}

/**
 * The UI languages a localized recipe runs in: the enabled rows of
 * `src/common/i18n/languages.ts` (R1). Read as text, because that file is TypeScript.
 */
function enabledLanguages() {
  const source = fs.readFileSync(path.join(REPO, "src", "common", "i18n", "languages.ts"), "utf8");
  const ids = [];
  for (const m of source.matchAll(/\{\s*id:\s*"([^"]+)"[^}]*?enabled:\s*true/gs)) ids.push(m[1]);
  return ids;
}

module.exports = { launchKlive, fixtureProjectFolder, enabledLanguages, IMAGES, REPO };
