/**
 * Guides screenshots of the Videoton TVC (`docs/content/en/guides/machines/videoton-tvc.mdx`):
 *
 * - `machines/videoton-tvc/tvc-run.webp` — the EMU window after Run on a new TVC project: BASIC's
 *   banner, the `LOMEM` and `C=USR(6704)` the flow typed, and the template's two lines of welcome.
 * - `machines/videoton-tvc/tvc-video-panel.webp` — the TVC Video panel of the paused machine.
 *
 * The session starts on the TVC 64K (seeded through `sessionSettings`); the project comes from the
 * TVC template (`newp tvc`) in a generated fixture folder, removed afterwards. Run boots BASIC first:
 * the RAM test and the sign-on take about six seconds.
 */
const { fixtureProjectFolder } = require("../harness.cjs");
const h = require("../guides-helpers.cjs");
const { step, reportFailures, panelShot } = require("../guides-helpers-shot.cjs");

module.exports = {
  name: "guides-tvc",
  window: {
    width: 1280,
    height: 820,
    sideBarWidth: "320px",
    sessionSettings: { machineId: "tvc", modelId: "tvc64" }
  },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "TvcHello");
    try {
      await klive.cmd(`newp tvc ${fixture.name} -p "${fixture.parent}" -o`, 8000);
      const emu = await klive.emu({ width: 1000, height: 760 });

      await step(klive, "run", async () => {
        await klive.cmd("run", 2000);
        await h.waitFor(
          async () => (await klive.ide.evaluate(() => document.body.innerText)).includes("Code injected"),
          "the code injected",
          30000
        );
        await h.sleep(6000);
        await h.park(emu);
        await klive.shot(h.ROOT, "en/guides/machines/videoton-tvc/tvc-run.webp", { displayWidth: 760, page: emu });
      });

      await step(klive, "video-panel", async () => {
        await klive.cmd("em-pause", 1500);
        await h.activity(klive, "Debug");
        await h.sections(klive.ide, ["TVC Video"]);
        await h.sleep(1200);
        await panelShot(klive, "TVC Video", "en/guides/machines/videoton-tvc/tvc-video-panel.webp", { displayWidth: 320 });
      });
    } finally {
      fixture.cleanup();
    }
    reportFailures();
  }
};
