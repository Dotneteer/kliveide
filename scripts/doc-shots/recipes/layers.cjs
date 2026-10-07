/**
 * Screenshots for `docs/content/working-with-ide/layers.mdx`, and the running-app check of the ZX
 * Spectrum Next layer debug view (`.plans/LAYER_COMPOSITION_PLAN.md` Phases 3, 5 and 6).
 *
 * Like the inspector recipes, it pokes a program into a paused Next (no NextZXOS needed):
 * `layers-demo.kz80.asm` beside this file, assembled by Klive's own assembler into `PROGRAM` below. It
 * draws blue ULA paper, a Layer 2 ramp with a transparent band down its left 96 columns, four red
 * sprites, and runs a Copper list that shows sprites over Layer 2 (SLU) above line 96 and Layer 2
 * over the sprites (LSU) below it.
 *
 * It verifies before it photographs, in both windows: the strip and the D3 pill in the emulator, the
 * paused recompose (screen canvas pixels with sprites hidden and with Layer 2 solo), the probe's
 * explanation of a pixel under the Copper split, the four clip outlines, and the Layers document.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { fixtureProjectFolder, IMAGES, REPO } = require("../harness.cjs");

/* --- layers-demo.kz80.asm, assembled at $8000. Re-assemble it after changing the source. */
const PROGRAM = [
  243, 237, 145, 7, 3, 237, 145, 20, 227, 237, 145, 74, 0, 33, 0, 88, 17, 1, 88, 1, 255, 2, 54, 15, 237, 176, 33, 0,
  64, 17, 1, 64, 1, 255, 23, 54, 0, 237, 176, 62, 1, 211, 254, 237, 145, 112, 0, 237, 145, 18, 9, 237, 145, 28, 1,
  237, 145, 24, 0, 237, 145, 24, 255, 237, 145, 24, 0, 237, 145, 24, 191, 22, 18, 122, 237, 146, 86, 33, 0, 192,
  125, 254, 96, 62, 227, 56, 2, 124, 133, 119, 35, 124, 254, 224, 32, 240, 20, 122, 254, 24, 32, 227, 237, 145, 86,
  0, 1, 59, 18, 62, 2, 237, 121, 1, 59, 48, 175, 237, 121, 30, 0, 123, 230, 15, 40, 17, 254, 15, 40, 13, 123, 230,
  240, 40, 8, 254, 240, 40, 4, 62, 224, 24, 2, 62, 227, 211, 91, 28, 32, 227, 1, 59, 48, 175, 237, 121, 6, 4, 30,
  70, 123, 211, 87, 62, 112, 211, 87, 175, 211, 87, 62, 192, 211, 87, 62, 10, 211, 87, 123, 198, 48, 95, 16, 232,
  237, 145, 21, 3, 237, 145, 98, 0, 237, 145, 97, 0, 237, 145, 96, 21, 237, 145, 96, 3, 237, 145, 96, 128, 237,
  145, 96, 96, 237, 145, 96, 21, 237, 145, 96, 7, 237, 145, 96, 255, 237, 145, 96, 255, 237, 145, 98, 192, 24, 254
];

const DOC = '[class*="_documentContainer_"]';
const hex = (v, d) => "$" + v.toString(16).toUpperCase().padStart(d, "0");
const fail = (what, state) => {
  throw new Error(`${what}: ${JSON.stringify(state)}`);
};

/** The second sprite (sprite X 118) at buffer x = 32 + 2 * 118 + 20; rows above and below the split */
const SPRITE_X = 32 + 2 * 118 + 20;
const ABOVE_SPLIT_Y = 16 + 112 + 8; // paper line 88: SLU
const BELOW_SPLIT_Y = 16 + 112 + 24; // paper line 104: LSU
const BAND = { x: 32 + 2 * 32 + 40, y: 48 + 60 }; // inside Layer 2's transparent band, no sprite

async function emuWindow(klive) {
  await klive.app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("?emu"));
    win?.setContentSize(820, 760);
    win?.setPosition(1400, 60);
    win?.show();
    win?.focus();
  });
  await klive.sleep(900);
  return klive.app.windows().find((w) => w.url().includes("?emu"));
}

/** The screen canvas pixels (RGBA) at buffer coordinates, through the canvas's own scale */
const screenPixels = (emu, points) =>
  emu.evaluate((pts) => {
    const canvas = [...document.querySelectorAll("canvas")].find((c) => c.width > 300);
    const ctx = canvas.getContext("2d");
    const sx = canvas.width / 720;
    const sy = canvas.height / 288;
    return pts.map(([x, y]) => Array.from(ctx.getImageData(Math.floor((x + 0.5) * sx), Math.floor((y + 0.5) * sy), 1, 1).data));
  }, points);

const emuState = (emu) =>
  emu.evaluate(() => ({
    pill: document.querySelector('[data-testid="layer-debug-pill"]')?.textContent ?? "",
    strip: document.querySelector('[data-testid="next-layers-strip"]')?.textContent ?? "",
    chips: [...document.querySelectorAll('[data-testid^="layer-chip-"]')].map((e) => e.getAttribute("data-testid").slice(11)),
    probe: document.querySelector('[data-testid="next-layer-probe"]')?.textContent ?? "",
    clips: document.querySelectorAll('[data-testid="next-layer-clips"] rect').length
  }));

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

const isRed = (p) => p[0] > 200 && p[1] < 60 && p[2] < 60;

module.exports = {
  name: "layers",
  window: {
    width: 1300,
    height: 900,
    sideBarWidth: "200px",
    toolPanelHeight: "90px",
    panelFontFamily: "iosevka",
    panelFontSize: 12,
    // --- A Next launch writes `~/Klive/ks2.cim`: keep it out of the real home
    userHome: path.join(os.tmpdir(), "klive-shots-layers-home")
  },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "LayersShots");
    try {
      await klive.cmd(`newp zxnext ${fixture.name} -p "${fixture.parent}" -o`, 12000);
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
      await klive.cmd("em-pause", 1200);
      // --- The machine's own picture: a red sprite above the split, Layer 2 over it below
      const [above, below] = await screenPixels(emu, [
        [SPRITE_X, ABOVE_SPLIT_Y],
        [SPRITE_X, BELOW_SPLIT_Y]
      ]);
      console.log("  machine picture ·", JSON.stringify({ above, below }));
      if (!isRed(above) || isRed(below)) fail("The Copper split is not on the screen", { above, below });

      // --- `layers spr off` hides the sprites, shows the strip and announces it (D3, Q3)
      await klive.cmd("layers spr off", 1500);
      let state = await emuState(emu);
      console.log("  sprites hidden ·", JSON.stringify(state));
      if (!state.pill.startsWith("Layers: sprites hidden")) fail("The pill does not announce the hidden sprites", state);
      // --- The strip turned the capture on while paused: the recompose says it is approximate until a
      // --- frame has been captured (D6); run a little so the probe below is exact
      if (!state.pill.includes("approximate")) fail("A recompose without a capture must say it is approximate", state.pill);
      await klive.cmd("em-debug", 1200);
      await klive.cmd("em-pause", 1200);
      state = await emuState(emu);
      if (state.pill !== "Layers: sprites hidden") fail("The pill should be plain after a captured frame", state.pill);
      if (state.chips.length !== 4 || !state.strip.includes("Sprites")) fail("The Layers strip is missing", state);
      const [hiddenAbove] = await screenPixels(emu, [[SPRITE_X, ABOVE_SPLIT_Y]]);
      if (isRed(hiddenAbove)) fail("The paused picture was not recomposed without the sprites", hiddenAbove);

      // --- Solo Layer 2: its transparent band shows the checker (two greys)
      await klive.cmd("layers l2 solo", 1500);
      state = await emuState(emu);
      const [band, ramp] = await screenPixels(emu, [
        [BAND.x, BAND.y],
        [SPRITE_X, ABOVE_SPLIT_Y]
      ]);
      console.log("  layer 2 solo ·", JSON.stringify({ pill: state.pill, band, ramp }));
      if (!state.pill.startsWith("Layers: Layer 2 solo")) fail("The pill does not say Layer 2 is solo", state);
      if (!(band[0] === band[1] && band[1] === band[2] && (band[0] === 0x49 || band[0] === 0x6d))) fail("No checker under the transparent band", band);
      await emu.mouse.move(5, 740);
      await save(await emu.screenshot(), "working-with-ide/layers-solo.png", 480);

      // --- The probe, on a sprite pixel below the Copper split: Layer 2 wins by LSU
      await klive.cmd("layers all on", 1200);
      await emu.locator('button[title^="Pixel probe"]').click();
      await emu.locator('button[title^="Show the four clip windows"]').click();
      await klive.sleep(600);
      const box = await emu.locator('[data-testid="next-layers-overlay"]').boundingBox();
      await emu.mouse.move(box.x + ((SPRITE_X + 0.5) / 720) * box.width, box.y + ((BELOW_SPLIT_Y + 0.5) / 288) * box.height);
      await klive.sleep(600);
      state = await emuState(emu);
      console.log("  probe ·", state.probe, "· clips", state.clips);
      if (!state.probe.includes("Layer 2: the top opaque layer in this order") || !state.probe.includes("LSU")) {
        fail("The probe does not explain the pixel under the split", state.probe);
      }
      if (!/Sprites\s*\$1C0/.test(state.probe)) fail("The probe does not show the sprite under Layer 2", state.probe);
      if (state.clips !== 4) fail("Expected four clip outlines", state.clips);
      await save(await emu.screenshot(), "working-with-ide/layers-probe.png", 480);

      // --- The close button: back to the composite picture, the strip hidden, the overlays off
      await klive.cmd("layers spr off", 1500);
      await emu.mouse.move(5, 740);
      await emu.locator('button[aria-label="Close the Layers strip"]').click();
      await klive.sleep(1200);
      state = await emuState(emu);
      const [restored] = await screenPixels(emu, [[SPRITE_X, ABOVE_SPLIT_Y]]);
      console.log("  closed ·", JSON.stringify({ ...state, restored }));
      if (state.strip || state.pill || state.clips || state.probe) fail("Closing left the strip, the pill or an overlay", state);
      if (!isRed(restored)) fail("Closing did not restore the composite picture", restored);

      // --- The Layers document: the stack, the cards, the pictures
      await emu.mouse.move(5, 740);
      await klive.cmd("show-layers", 2500);
      const doc = await klive.ide.evaluate(() => ({
        text: document.querySelector('[data-testid="layers-document"]')?.textContent ?? "",
        cards: [...document.querySelectorAll('[data-testid^="layers-card-"]')].map((e) => e.getAttribute("data-testid").slice(12)),
        canvases: document.querySelectorAll('[data-testid="layers-document"] canvas').length
      }));
      console.log("  document ·", JSON.stringify({ cards: doc.cards, canvases: doc.canvases }));
      if (doc.cards.join() !== "ula,tm,l2,spr" || doc.canvases !== 5) fail("The Layers document is incomplete", doc);
      if (!doc.text.includes("Off: $6B bit 7 is clear")) fail("The tilemap card does not say it is off", doc.text);
      await klive.ide.mouse.move(5, 5);
      await klive.shot(DOC, "working-with-ide/layers-document.png", { displayWidth: 900 });
    } finally {
      fixture.cleanup();
    }
  }
};
