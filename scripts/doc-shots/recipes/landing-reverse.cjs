/**
 * The landing page's first carousel item (step 3 of .plans/HALLMARK_SITE_POLISH_PLAN.md): a short
 * loop of reverse debugging, recorded with Klive's own IDE + Emulator recording
 * (Machine › Record › Start IDE + Emulator recording), not with a screen grabber.
 *
 * A 48K program paints the screen's attributes one row at a time and stops at a breakpoint on its
 * last instruction. The recording then starts and Reverse Continue, with a breakpoint at the top of
 * the row loop, walks back one row at a time: the stripes disappear from the bottom, the editor's
 * execution line returns to the loop, and the CPU panel counts the steps into the past. Return to
 * Present puts the whole screen back at once, which is also where the loop starts again.
 *
 * Output: `images/landing/reverse-debugging.mp4` (H.264, silent, fast start) and its first frame
 * as `images/landing/reverse-debugging.webp`, the poster. FFmpeg (on PATH) trims and re-encodes
 * Klive's recording; Klive's own encoder writes the source file.
 *
 * Everything is driven through the IDE's commands and the application menu (the reverse-stepping
 * items and the recording item), so no command text shows in the video once it starts.
 */
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");
const { fixtureProjectFolder, IMAGES, REPO } = require("../harness.cjs");

const USER_HOME = path.join(os.tmpdir(), "klive-landing-reverse-home");
const ROW_LOOP = "$8010";
const DONE = "$8040";
const ROWS_BACK = 12;

const PROGRAM = `; Paints the screen's colours one row at a time
    .model Spectrum48
    .org #8000
Main:
    ei
    ld hl,#5800      ; the attribute area
    ld c,0           ; the row number
    jp RowLoop

    .org #8010       ; a fixed address for the recipe's breakpoint
RowLoop:
    ld a,c
    inc a
    and 7            ; paper colour 1 to 7, then 0
    add a,a
    add a,a
    add a,a
    or #40           ; bright
    ld b,32          ; 32 cells in a row
Cell:
    ld (hl),a
    inc hl
    djnz Cell
    halt             ; three frames for each row
    halt
    halt
    inc c
    ld a,c
    cp 24
    jp nz,RowLoop
    jp Done

    .org #8040       ; a fixed address for the recipe's breakpoint
Done:
    jr Done
`;

/** Clicks an application menu item, keeping a Klive window focused so macOS fills the menu in. */
async function menu(klive, id, wait = 600) {
  const deadline = Date.now() + 40000;
  while (Date.now() < deadline) {
    await klive.app.evaluate(({ app, BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("?ide"));
      if (win && !win.isFocused()) {
        app.focus({ steal: true });
        win.show();
        win.focus();
      }
    });
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
    await klive.sleep(300);
  }
  throw new Error(`The menu item ${id} never appeared or stayed disabled`);
}

/** The newest recording Klive wrote under the run's home */
function newestRecording() {
  const dir = path.join(USER_HOME, "KliveExports", "video");
  if (!fs.existsSync(dir)) return undefined;
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^recording_.*\.mp4$/.test(f))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0];
}

module.exports = {
  name: "landing-reverse",
  window: {
    width: 800,
    height: 820,
    sideBarWidth: "230px",
    toolPanelHeight: "90px",
    panelFontFamily: "iosevka",
    panelFontSize: 13,
    userHome: USER_HOME,
    userSettings: { features: { advancedDebugging: "1" } },
    // --- Playwright's clicks never move the system pointer, so a drawn pointer would sit still
    sessionSettings: { windowRecording: { idePosition: "left", pointer: false, clicks: false, hiDpi: false } }
  },

  async run(klive) {
    fs.rmSync(path.join(USER_HOME, "KliveExports"), { recursive: true, force: true });
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "RewindDemo");
    try {
      await klive.cmd(`newp sp48 ${fixture.name} -p "${fixture.parent}" -o`, 9000);
      // --- The IDE keeps the template's text for a file it has opened, even across closing the
      // --- project: the demo goes into a file it has never seen, made the build root while closed
      await klive.cmd("close", 2500);
      fs.writeFileSync(path.join(fixture.project, "code", "rewind.kz80.asm"), PROGRAM);
      fs.rmSync(path.join(fixture.project, "code", "code.kz80.asm"));
      const projectFile = path.join(fixture.project, "klive.project");
      const project = JSON.parse(fs.readFileSync(projectFile, "utf8"));
      project.builder = { ...project.builder, roots: ["code/rewind.kz80.asm"] };
      fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
      await klive.cmd(`open "${fixture.project}"`, 5000);
      await klive.cmd("nav code/rewind.kz80.asm", 2500);
      await klive.ide.locator('button[aria-label="Debug"]').click({ force: true });

      // --- Run to the end: the screen is fully striped and the machine paused at Done
      await klive.cmd(`bp-set ${DONE}`, 600);
      await klive.cmd("debug", 9000);
      await klive.cmd(`bp-set ${ROW_LOOP}`, 600);
      await klive.cmd("cls", 600);

      // --- The emulator beside the IDE, both visible: the recording composes the two windows
      await klive.emu({ width: 520, height: 440 });
      await klive.app.evaluate(({ BrowserWindow }) => {
        const wins = BrowserWindow.getAllWindows();
        const ide = wins.find((w) => w.webContents.getURL().includes("?ide"));
        const emu = wins.find((w) => w.webContents.getURL().includes("?emu"));
        const [x, y] = ide.getPosition();
        emu.setPosition(x + ide.getSize()[0] + 12, y);
        ide.focus();
      });
      await klive.ide.mouse.move(5, 300);
      await klive.sleep(800);

      if (process.env.LANDING_REVERSE_DIAG) {
        // --- Does the emulator's picture follow the machine into the past?
        const emu = klive.app.windows().find((w) => w.url().includes("?emu"));
        const diag = path.join(IMAGES, "landing", "diag");
        fs.mkdirSync(diag, { recursive: true });
        await emu.screenshot({ path: path.join(diag, "present.png") });
        for (let i = 1; i <= 3; i++) {
          await menu(klive, "reverse_continue", 1200);
          await emu.screenshot({ path: path.join(diag, `back-${i}.png`) });
        }
        const out = await klive.ide.evaluate(() =>
          [...document.querySelectorAll('[class*="_outputLine_"], [class*="_outputWrapper_"]')].map((e) => e.textContent).join("\n").slice(-1500)
        );
        console.log(out);
        await menu(klive, "history_present", 1500);
        await emu.screenshot({ path: path.join(diag, "present-again.png") });
        return;
      }

      await menu(klive, "recording_ide_emu_start_stop", 2000);
      for (let i = 0; i < ROWS_BACK; i++) await menu(klive, "reverse_continue", 450);
      await klive.sleep(1200);
      await menu(klive, "history_present", 2000);
      await menu(klive, "recording_ide_emu_start_stop", 2500);

      // --- Klive writes the file as the recording stops; give the encoder a moment to close it
      let source;
      for (let i = 0; i < 40 && !source; i++) {
        source = newestRecording();
        if (!source) await klive.sleep(500);
      }
      if (!source) throw new Error("Klive wrote no recording under KliveExports/video");
      console.log(`  recording · ${source} (${(fs.statSync(source).size / 1024).toFixed(0)} KB)`);

      const out = path.join(IMAGES, "landing", "reverse-debugging.mp4");
      fs.mkdirSync(path.dirname(out), { recursive: true });
      // --- Start at the first rewind (the menu-driven start leaves about a second of stillness),
      // --- silent, small and streamable: the page autoplays it muted in a loop
      execFileSync("ffmpeg", [
        "-y", "-loglevel", "error", "-ss", "1.2", "-i", source,
        "-an", "-vf", "scale=1440:-2:flags=lanczos,format=yuv420p",
        "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-movflags", "+faststart", out
      ]);
      // --- The poster: the first frame, through PNG, as WebP by sharp (FFmpeg builds often lack libwebp)
      const poster = path.join(IMAGES, "landing", "reverse-debugging.webp");
      const frame = path.join(os.tmpdir(), "klive-landing-reverse-poster.png");
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", out, "-frames:v", "1", frame]);
      const sharp = require(path.join(REPO, "docs", "node_modules", "sharp"));
      await sharp(frame).webp({ quality: 82 }).toFile(poster);
      fs.rmSync(frame, { force: true });
      console.log(`  ✓ ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
      console.log(`  ✓ ${path.relative(process.cwd(), poster)} (${(fs.statSync(poster).size / 1024).toFixed(0)} KB)`);

      await klive.cmd("bp-ea", 600);
      await klive.cmd("em-stop", 1500);
    } finally {
      fixture.cleanup();
    }
  }
};
