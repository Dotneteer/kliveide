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
  accent
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
        theme,
        ...(accent ? { accent } : {}),
        windowStates: { showIdeOnStartup: true },
        globalSettings: {
          ideViewOptions: {
            showSidebar: true,
            showTools: true,
            maximizeTools: false,
            sideBarWidth,
            toolPanelHeight
          },
          editorOptions: { fontFamily: "iosevka", fontSize: 16 },
          panelOptions: { fontFamily: "jetbrains-mono", fontSize: 14 }
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
    env: { ...process.env, KLIVE_SETTINGS_FILE: settings },
    timeout: 60_000
  });

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
   * `displayWidth` is the width the MDX renders the image at; the PNG is written at
   * 2x that so it stays crisp on retina displays, matching the existing assets.
   */
  async function shot(selector, relPath, { displayWidth } = {}) {
    const target = path.join(IMAGES, relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const buffer = await ide.locator(selector).first().screenshot();
    const sharp = loadSharp();
    let pipeline = sharp(buffer);
    if (displayWidth) pipeline = pipeline.resize({ width: displayWidth * 2 });
    // --- 144 dpi marks the file as 2x, the same as the hand-captured screenshots.
    await pipeline.withMetadata({ density: 144 }).png().toFile(target);
    const meta = await sharp(target).metadata();
    console.log(`  ✓ ${relPath}  ${meta.width}x${meta.height}`);
    return target;
  }

  // --- Clear the prompt history so the Commands pane starts empty in every shot.
  await cmd("cls", 700);

  return { app, ide, cmd, shot, sleep, close: () => app.close() };
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

module.exports = { launchKlive, fixtureProjectFolder, IMAGES, REPO };
