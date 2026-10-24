/**
 * Guides screenshots of the media viewers (`docs/content/en/guides/media/`):
 *
 * - `snapshots/snapshot-viewer.webp` — a `.z80` snapshot open in the snapshot viewer;
 * - `rzx-recordings/rzx-viewer.webp` — an `.rzx` recording open in its viewer.
 *
 * Both files are made by Klive itself, in the recipe: a Klive BASIC program
 * (`fixtures/guides/stripes.zxbas`) runs on the 48K, `zx-snapshot-save` writes the snapshot and
 * `zx-rzx-record` / `zx-rzx-stop` record a few seconds of it. Nothing is downloaded.
 */
const path = require("path");
const fs = require("fs");
const { fixtureProjectFolder, REPO } = require("../harness.cjs");
const { ROOT, park, waitFor, outputText, projectWithSource, focusIde, hideEmu, sleep } = require("../guides-helpers.cjs");

const SOURCE = fs.readFileSync(path.join(REPO, "scripts", "doc-shots", "fixtures", "guides", "stripes.zxbas"), "utf8");
const DOCS = '[class*="_documentArea_"], [class*="_documentsContainer_"]';

module.exports = {
  name: "guides-media",
  window: { width: 1280, height: 820, toolPanelHeight: "140px", sideBarWidth: "240px" },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "MediaShots");
    try {
      await projectWithSource(klive, fixture, {
        machine: "sp48",
        template: "zx-basic",
        file: "code/stripes.zxbas",
        source: SOURCE
      });
      await klive.cmd("run", 10000);
      await hideEmu(klive);
      await focusIde(klive);

      // --- The snapshot
      const snapshot = path.join(fixture.project, "stripes.z80");
      await klive.cmd("cls", 400);
      await klive.cmd(`zx-snapshot-save "${snapshot}" -f`, 2500);
      await waitFor(() => fs.existsSync(snapshot), "the snapshot file");
      console.log("  snapshot ·", (await outputText(klive.ide)).replace(/\s+/g, " ").slice(0, 200));

      // --- The recording: a few seconds of the running program
      await klive.cmd("cls", 400);
      await klive.cmd("zx-rzx-record", 3500);
      const rzx = path.join(fixture.project, "stripes.rzx");
      await klive.cmd(`zx-rzx-stop "${rzx}" -f`, 2500);
      await waitFor(() => fs.existsSync(rzx), "the RZX file");
      console.log("  rzx ·", (await outputText(klive.ide)).replace(/\s+/g, " ").slice(0, 200));
      await klive.cmd("em-stop", 1500);

      await klive.cmd("nav stripes.z80", 3500);
      await klive.cmd("cls", 400);
      await park(klive.ide);
      await klive.shot(DOCS, "en/guides/media/snapshots/snapshot-viewer.webp", { displayWidth: 760 });

      await klive.cmd("nav stripes.rzx", 3500);
      await klive.cmd("cls", 400);
      await park(klive.ide);
      await klive.shot(DOCS, "en/guides/media/rzx-recordings/rzx-viewer.webp", { displayWidth: 760 });
    } finally {
      fixture.cleanup();
    }
  }
};
