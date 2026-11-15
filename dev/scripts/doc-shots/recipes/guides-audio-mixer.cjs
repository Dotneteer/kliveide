/**
 * Screenshots for `docs/content/en/guides/emulator/audio-mixer.mdx`, and the running-app check of the
 * audio mixer (`dev/plans/AUDIO_MIXER_PLAN.md` phases 4-5): the IDE's Audio Mixer document and the
 * emulator's sound popover, on a 128K playing `audio-mixer-demo.kz80.asm` (assembled into PROGRAM).
 *
 * It verifies before it photographs: every 128K source has a strip, the playing ones have a level and
 * the silent ones none; muting a source in the document shows in its facts (state, 0% gain) and in
 * the popover; soloing silences the others; Reset brings everything back.
 */
const os = require("os");
const path = require("path");
const { fixtureProjectFolder } = require("../harness.cjs");
const { park, sleep } = require("../guides-helpers.cjs");

/* --- audio-mixer-demo.kz80.asm, assembled at $8000. Re-assemble it after changing the source. */
const PROGRAM = [
  0xf3, 0x21, 0x28, 0x80, 0x16, 0x00, 0x01, 0xfd, 0xff, 0xed, 0x51, 0x7e, 0x06, 0xbf, 0xed, 0x79, 0x23, 0x14, 0x7a,
  0xfe, 0x0e, 0x20, 0xef, 0x3e, 0x10, 0xd3, 0xfe, 0x06, 0x60, 0x10, 0xfe, 0xaf, 0xd3, 0xfe, 0x06, 0x60, 0x10, 0xfe,
  0x18, 0xef, 0x40, 0x01, 0x00, 0x00, 0x28, 0x00, 0x1f, 0x2a, 0x0f, 0x0c, 0x10, 0x00, 0x04, 0x0e
];

const DOCS = '[class*="_documentContainer_"]';
const hex = (v, d) => "$" + v.toString(16).toUpperCase().padStart(d, "0");
const fail = (what, state) => {
  throw new Error(`${what}: ${JSON.stringify(state)}`);
};

/** The document's strips: each source's level text, and the analyser's facts */
const documentState = (ide) =>
  ide.evaluate(() => {
    const strips = {};
    for (const el of document.querySelectorAll('[data-testid^="audio-mixer-strip-"]')) {
      const id = el.getAttribute("data-testid").slice("audio-mixer-strip-".length);
      strips[id] = el.querySelector('[class*="_db_"]')?.textContent ?? "";
    }
    const facts = [...document.querySelectorAll('[data-testid="audio-mixer-document"] dl dd')].map((e) => e.textContent);
    return { strips, facts, analyser: !!document.querySelector('[data-testid="audio-mixer-analyser"]') };
  });

const silent = (db) => db.startsWith("−∞");

module.exports = {
  name: "guides-audio-mixer",
  window: {
    width: 1240,
    height: 860,
    sideBarWidth: "180px",
    toolPanelHeight: "90px",
    panelFontFamily: "iosevka",
    panelFontSize: 12,
    userHome: path.join(os.tmpdir(), "klive-shots-audio-mixer-home"),
    // --- A fresh settings file has no sound level, and the app starts at 0.5, which no level button
    // --- matches: start at the High level, the app state's own default
    sessionSettings: { soundLevel: 0.8 }
  },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "AudioMixerShots");
    try {
      await klive.cmd(`newp sp128 ${fixture.name} -p "${fixture.parent}" -o`, 12000);
      await klive.cmd("em-debug", 4000);
      await klive.cmd("em-pause", 1000);
      for (let i = 0; i < PROGRAM.length; i += 4) {
        const chunk = PROGRAM.slice(i, i + 4);
        const value = chunk.reduce((v, b, k) => v + b * 2 ** (8 * k), 0);
        const bits = [8, 16, 24, 32][chunk.length - 1];
        await klive.cmd(`setmem ${hex(0x8000 + i, 4)} ${hex(value, chunk.length * 2)} -b${bits}`, 150);
      }
      await klive.cmd("setz80reg pc $8000", 400);
      const emu = await klive.emu({ width: 760, height: 640 });
      await klive.cmd("em-debug", 1500);
      await klive.cmd("cls", 400);

      // --- The document: every source has a strip; the playing ones have a level, the tape and MIC none
      await klive.cmd("show-audio-mixer", 3000);
      let state = await documentState(klive.ide);
      console.log("  document ·", JSON.stringify(state));
      const ids = Object.keys(state.strips).join();
      if (ids !== "beeper,mic,tape,ayA,ayB,ayC") fail("The 128K's sources are not all listed", ids);
      for (const id of ["beeper", "ayA", "ayB", "ayC"]) if (silent(state.strips[id])) fail(`${id} shows no level`, state.strips);
      for (const id of ["tape", "mic"]) if (!silent(state.strips[id])) fail(`${id} should be silent`, state.strips);
      if (!state.analyser) fail("No analyser", state);

      // --- Narrow: the strips scroll sideways in a ScrollViewer, the row as tall as the strips, and
      // --- the mouse wheel scrolls it
      const ideSize = (width, height) =>
        klive.app.evaluate(({ BrowserWindow }, size) => {
          const win = BrowserWindow.getAllWindows().find((w) => !w.webContents.getURL().includes("?emu"));
          win?.setContentSize(size.width, size.height);
        }, { width, height });
      await ideSize(640, 860);
      await sleep(1200);
      const stripsBox = '[data-testid="audio-mixer-document"] [class*="_strips_"]';
      await klive.ide.locator(stripsBox).hover();
      await klive.ide.mouse.wheel(0, 300);
      await sleep(600);
      const narrow = await klive.ide.evaluate((selector) => {
        const strips = document.querySelector(selector);
        const viewport = strips?.closest("[data-overlayscrollbars-viewport]");
        const host = strips?.closest('[class*="_stripsScroller_"]');
        if (!strips || !viewport || !host) return { found: false };
        return {
          found: true,
          scrollable: viewport.scrollWidth > viewport.clientWidth,
          scrolledBy: viewport.scrollLeft,
          hostHeight: Math.round(host.getBoundingClientRect().height),
          stripsHeight: Math.round(strips.getBoundingClientRect().height),
          bar: !!host.querySelector(".os-scrollbar-horizontal")
        };
      }, stripsBox);
      console.log("  narrow ·", JSON.stringify(narrow));
      if (!narrow.found || !narrow.scrollable || !narrow.bar) fail("The strips do not scroll in a ScrollViewer", narrow);
      if (narrow.scrolledBy <= 0) fail("The mouse wheel does not scroll the strips sideways", narrow);
      if (narrow.hostHeight < narrow.stripsHeight) fail("The strip row clips the strips", narrow);
      await klive.ide.evaluate((selector) => {
        const viewport = document.querySelector(selector)?.closest("[data-overlayscrollbars-viewport]");
        if (viewport) viewport.scrollLeft = 0;
      }, stripsBox);
      await ideSize(1240, 860);
      await sleep(1200);

      // --- Select AY channel A, mute it: its facts say so, and its meter keeps moving (pre-fader)
      const strip = (id) => klive.ide.locator(`[data-testid="audio-mixer-strip-${id}"]`);
      // --- A strip is selected by its name: its middle is the fader, which keeps its clicks
      const select = (id) => strip(id).locator('[class*="_stripName_"]').click();
      await select("ayA");
      await strip("ayA").locator("button", { hasText: /^M$/ }).click();
      await sleep(1200);
      state = await documentState(klive.ide);
      console.log("  ayA muted ·", JSON.stringify(state.facts));
      if (state.facts[1] !== "Muted" || state.facts[5] !== "0%") fail("Muting AY A does not show in its facts", state.facts);
      if (silent(state.strips.ayA)) fail("A muted source's meter should still move (pre-fader)", state.strips);

      // --- The sound popover in the emulator shows the same mute
      await park(emu);
      await emu.locator('button[title="Sound level"]').click();
      await sleep(1500);
      const popover = await emu.evaluate(() => {
        const box = document.querySelector('[data-testid="sound-popover"]');
        const rows = [...document.querySelectorAll('[data-testid^="sound-popover-row-"]')].map((r) => ({
          id: r.getAttribute("data-testid").slice("sound-popover-row-".length),
          muted: r.querySelector('button[aria-pressed="true"]')?.textContent ?? ""
        }));
        const levels = [...(box?.querySelectorAll('[role="group"] button') ?? [])].map((b) => `${b.textContent}:${b.getAttribute("aria-pressed")}`);
      return { open: !!box, rows, levels };
      });
      console.log("  popover ·", JSON.stringify(popover));
      if (!popover.open || popover.rows.length !== 6) fail("The sound popover does not list the sources", popover);
      if (popover.rows.find((r) => r.id === "ayA")?.muted !== "M") fail("The popover does not show AY A muted", popover);
      await klive.shot('[data-testid="sound-popover"]', "en/guides/emulator/audio-mixer/popover.webp", {
        displayWidth: 360,
        page: emu
      });
      await emu.keyboard.press("Escape");
      await sleep(500);

      // --- Solo AY channel C: the others are silenced by the solo
      await select("ayC");
      await strip("ayC").locator("button", { hasText: /^S$/ }).click();
      await select("beeper");
      await sleep(1200);
      state = await documentState(klive.ide);
      console.log("  ayC solo, beeper selected ·", JSON.stringify(state.facts));
      if (state.facts[1] !== "Silent: another is soloed" || state.facts[5] !== "0%") fail("Soloing AY C should silence the beeper", state.facts);

      // --- Reset: everything plays again; the shot shows the analyser on AY channel C
      await klive.ide.locator('[data-testid="audio-mixer-document"] button', { hasText: /^Reset$/ }).click();
      await select("ayC");
      await sleep(1500);
      state = await documentState(klive.ide);
      console.log("  reset, ayC selected ·", JSON.stringify(state.facts));
      if (state.facts[1] !== "Playing" || state.facts[5] !== "100%") fail("Reset did not bring AY C back to unity", state.facts);
      await park(klive.ide);
      await klive.shot(DOCS, "en/guides/emulator/audio-mixer/document.webp", { displayWidth: 760 });

      // --- The spectrogram of the envelope-shaped tone
      await klive.ide.locator('[data-testid="audio-mixer-document"] button', { hasText: /^Spectrogram$/ }).click();
      await sleep(3500);
      await klive.shot('[data-testid="audio-mixer-document"] [class*="_analyser_"]', "en/guides/emulator/audio-mixer/spectrogram.webp", {
        displayWidth: 760
      });
    } finally {
      fixture.cleanup();
    }
  }
};
