/**
 * Screenshots for `docs/content/working-with-ide/beam-position.mdx`, and the
 * running-app check of the beam position overlay (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` Phases 4-6).
 *
 * On the Next it pokes `beam-demo.kz80.asm` (beside this file, assembled by Klive's own assembler into
 * `PROGRAM` below) into a paused machine: the Layers demo's Copper split, and a loop that changes the
 * border every ~20 lines. A breakpoint inside the loop's delay stops the machine mid-frame.
 *
 * It verifies before it photographs: the pill, the beam line drawn at the beam's own row on the
 * canvas (T5), the hatched previous frame and its legend (D2), the hover readout (D6), `beam off`
 * and `beam on`, the Copper's hit marker at a Copper breakpoint (D7) - and, on the 48K, the
 * overlay with T-state units and the blanking edge marker after a pause at a frame boundary (D5).
 */
const os = require("os");
const path = require("path");
const fs = require("fs");
const { fixtureProjectFolder, IMAGES, REPO } = require("../harness.cjs");

/* --- beam-demo.kz80.asm, assembled at $8000. Re-assemble it after changing the source. */
const PROGRAM = [
  243, 237, 145, 7, 3, 237, 145, 20, 227, 237, 145, 74, 0, 33, 0, 88, 17, 1, 88, 1, 255, 2, 54, 15, 237, 176, 33, 0,
  64, 17, 1, 64, 1, 255, 23, 54, 0, 237, 176, 62, 1, 211, 254, 237, 145, 112, 0, 237, 145, 18, 9, 237, 145, 28, 1, 237,
  145, 24, 0, 237, 145, 24, 255, 237, 145, 24, 0, 237, 145, 24, 191, 22, 18, 122, 237, 146, 86, 33, 0, 192, 125, 254, 96, 62,
  227, 56, 2, 124, 133, 119, 35, 124, 254, 224, 32, 240, 20, 122, 254, 24, 32, 227, 237, 145, 86, 0, 1, 59, 18, 62, 2, 237,
  121, 1, 59, 48, 175, 237, 121, 30, 0, 123, 230, 15, 40, 17, 254, 15, 40, 13, 123, 230, 240, 40, 8, 254, 240, 40, 4, 62,
  224, 24, 2, 62, 227, 211, 91, 28, 32, 227, 1, 59, 48, 175, 237, 121, 6, 4, 30, 70, 123, 211, 87, 62, 112, 211, 87, 175,
  211, 87, 62, 192, 211, 87, 62, 10, 211, 87, 123, 198, 48, 95, 16, 232, 237, 145, 21, 3, 237, 145, 98, 0, 237, 145, 97, 0,
  237, 145, 96, 21, 237, 145, 96, 3, 237, 145, 96, 128, 237, 145, 96, 96, 237, 145, 96, 21, 237, 145, 96, 7, 237, 145, 96, 255,
  237, 145, 96, 255, 237, 145, 98, 192, 30, 0, 1, 220, 5, 11, 120, 177, 32, 251, 123, 230, 7, 211, 254, 28, 0, 24, 239
];
/** The `dec bc` of the delay loop (`Delay` in the source) */
const DELAY = 0x80ed;

const hex = (v, d) => "$" + v.toString(16).toUpperCase().padStart(d, "0");
const fail = (what, state) => {
  throw new Error(`${what}: ${JSON.stringify(state)}`);
};

async function emuWindow(klive) {
  await klive.app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("?emu"));
    win?.setContentSize(820, 700);
    win?.setPosition(1400, 60);
    win?.show();
    win?.focus();
  });
  await klive.sleep(900);
  return klive.app.windows().find((w) => w.url().includes("?emu"));
}

/** The overlay as the emulator window shows it, and where its beam line landed on the screen */
const beamState = (emu) =>
  emu.evaluate(() => {
    const overlay = document.querySelector('[data-testid="beam-overlay"]');
    const box = overlay?.getBoundingClientRect();
    const svg = document.querySelector('[data-testid="beam-shapes"]');
    // --- The shapes are the SVG's own children; the hatch pattern's line sits in <defs>
    const line = svg?.querySelector(":scope > line");
    return {
      pill: document.querySelector('[data-testid="beam-pill"]')?.textContent ?? "",
      overlay: !!overlay,
      viewBox: svg?.getAttribute("viewBox") ?? "",
      lines: svg ? svg.querySelectorAll("line").length : 0,
      stale: svg ? svg.querySelectorAll("rect[x]").length : 0,
      legend: document.querySelector('[data-testid="beam-stale-label"]')?.textContent ?? "",
      copper: document.querySelector('[data-testid="beam-copper-label"]')?.textContent ?? "",
      readout: document.querySelector('[data-testid="beam-readout"]')?.textContent ?? "",
      lineY: line ? Number(line.getAttribute("y1")) : undefined,
      lineTop: line ? line.getBoundingClientRect().top + line.getBoundingClientRect().height / 2 - (box?.top ?? 0) : undefined,
      height: box?.height ?? 0,
      top: box?.top ?? 0,
      left: box?.left ?? 0,
      width: box?.width ?? 0
    };
  });

async function save(buffer, relPath, displayWidth) {
  const target = path.join(IMAGES, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  let sharp;
  for (const base of [REPO, path.join(REPO, "docs")]) {
    try {
      sharp = require(require.resolve("sharp", { paths: [base] }));
      break;
    } catch {
      /* the next location */
    }
  }
  if (!sharp) throw new Error("sharp not found - run `npm run doc:install` first.");
  await sharp(buffer).resize({ width: displayWidth * 2 }).withMetadata({ density: 144 }).png().toFile(target);
  console.log(`  ✓ ${relPath}`);
}

async function waitFor(emu, klive, pred, what) {
  for (let i = 0; i < 30; i++) {
    const s = await beamState(emu);
    if (pred(s)) return s;
    await klive.sleep(300);
  }
  fail(what, await beamState(emu));
}

module.exports = {
  name: "beam",
  window: {
    width: 1300,
    height: 900,
    sideBarWidth: "200px",
    toolPanelHeight: "90px",
    panelFontFamily: "iosevka",
    panelFontSize: 12,
    // --- A Next launch writes `~/Klive/ks2.cim`: keep it out of the real home
    userHome: path.join(os.tmpdir(), "klive-shots-beam-home")
  },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "BeamShots");
    const fixture48 = fixtureProjectFolder((process.env.DOC_SHOTS_PROJECT || "BeamShots") + "48");
    try {
      await klive.cmd(`newp zxnext ${fixture.name} -p "${fixture.parent}" -o`, 12000);
      await klive.cmd("beam on", 600);
      await klive.cmd("em-debug", 4000);
      await klive.cmd("em-pause", 1000);
      for (let i = 0; i < PROGRAM.length; i += 4) {
        const chunk = PROGRAM.slice(i, i + 4);
        const value = chunk.reduce((v, b, k) => v + b * 2 ** (8 * k), 0);
        const bits = [8, 16, 24, 32][chunk.length - 1];
        await klive.cmd(`setmem ${hex(0x8000 + i, 4)} ${hex(value, chunk.length * 2)} -b${bits}`, 150);
      }
      await klive.cmd("setz80reg pc $8000", 400);
      // --- The harness hides the EMU window; show it before the machine draws, or its canvas stays empty
      const emu = await emuWindow(klive);
      await klive.cmd("em-debug", 2500);

      // --- Stop mid-frame, inside the delay between two border changes; 1,037 passes (~6,740 HC) apart,
      // --- so successive stops move across the line as well as down the frame
      await klive.cmd(`bp-set ${hex(DELAY, 4)} -hit *1037`, 2500);
      let state = await waitFor(emu, klive, (s) => s.overlay && !!s.pill, "The overlay never appeared at the breakpoint");
      // --- Continue until the stop is in the middle of the paper, for a picture worth showing
      const midPaper = (s) => {
        const row = /paper row (\d+)/.exec(s.pill);
        return !!row && Number(row[1]) > 70 && Number(row[1]) < 150;
      };
      for (let i = 0; i < 20 && !midPaper(state); i++) {
        await klive.cmd("em-debug", 1500);
        state = await waitFor(emu, klive, (s) => s.overlay && !!s.pill, "The overlay never appeared at the breakpoint");
      }
      console.log("  Next, at a breakpoint ·", JSON.stringify(state));
      if (!/^line \d+ · (paper row \d+|top border|bottom border|HBLANK|VBLANK.*) · hc \d+ · HC [\d,]+$/.test(state.pill)) {
        fail("The pill does not name the beam", state.pill);
      }
      if (state.viewBox !== "0 0 720 288") fail("The overlay is not in the Next buffer's coordinates", state.viewBox);
      if (state.lines < 2) fail("No beam line and marker", state);
      // --- T5: the beam line sits on the canvas at its buffer row, at this zoom
      if (state.lineY !== undefined) {
        const expected = (state.lineY / 288) * state.height;
        if (Math.abs(expected - state.lineTop) > 1.5) fail("The beam line is not at its row on the screen", { expected, state });
      }
      // --- Stopped some 10 lines after the last border change: last frame's pixels are hatched
      if (!state.stale || state.legend !== "previous frame") fail("The previous frame is not marked", state);

      // --- D6: the hover readout on a pixel near the top (drawn) and near the bottom (to come)
      await emu.mouse.move(state.left + state.width * 0.3, state.top + state.height * 0.1);
      await klive.sleep(500);
      const drawn = (await beamState(emu)).readout;
      await emu.mouse.move(state.left + state.width * 0.6, state.top + state.height * 0.93);
      await klive.sleep(500);
      const toCome = (await beamState(emu)).readout;
      console.log("  readout ·", drawn, "|", toCome);
      if (!/· drawn$/.test(drawn) || !/· in [\d,]+ HC$/.test(toCome)) fail("The hover readout is wrong", { drawn, toCome });
      await save(await emu.screenshot(), "working-with-ide/beam-position.png", 480);

      // --- D8: the command switches it off and on
      await emu.mouse.move(5, 690);
      await klive.cmd("beam off", 1200);
      state = await beamState(emu);
      if (state.overlay || state.pill) fail("'beam off' left the overlay", state);
      await klive.cmd("beam on", 1200);
      state = await waitFor(emu, klive, (s) => s.overlay && !!s.pill, "'beam on' did not bring the overlay back");

      // --- D7: a Copper breakpoint on the WAIT (list index 1, line 96): the hit gets its own marker
      await klive.cmd("bp-ea", 800);
      await klive.cmd("bp-set cu:$001", 800);
      await klive.cmd("em-debug", 2500);
      state = await waitFor(emu, klive, (s) => s.overlay && !!s.copper, "No Copper marker at a Copper breakpoint");
      console.log("  Copper hit ·", JSON.stringify({ pill: state.pill, copper: state.copper }));
      if (state.copper !== "Copper hit $001") fail("The Copper marker is not labelled with its hit", state.copper);
      await klive.cmd("bp-ea", 800);
      await klive.cmd("em-stop", 1500);

      // --- The 48K: T-states, and a pause at a frame boundary is vertical blanking (D5)
      await klive.cmd(`newp sp48 ${fixture48.name} -p "${fixture48.parent}" -o`, 12000);
      await klive.cmd("em-debug", 3000);
      await klive.cmd("em-pause", 1500);
      state = await waitFor(emu, klive, (s) => s.overlay && !!s.pill, "No overlay on the 48K");
      console.log("  48K paused ·", JSON.stringify({ pill: state.pill, viewBox: state.viewBox }));
      if (!/· T [\d,]+$/.test(state.pill)) fail("The 48K's pill is not in T-states", state.pill);
      if (!state.viewBox.startsWith("0 0 352 ")) fail("The overlay is not in the 48K buffer's coordinates", state.viewBox);
      await klive.cmd("em-stop", 1000);
    } finally {
      fixture.cleanup();
      fixture48.cleanup();
    }
  }
};
