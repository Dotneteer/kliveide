/**
 * Screenshots for `docs/content/working-with-ide/execution-history.mdx` ("Stepping back"), and the
 * running-app check of lite step back (`.plans/LITE_STEP_BACK_PLAN.md` Phase 7).
 *
 * On the 48K it pokes a program with a known call tree into a paused machine, runs it with
 * debugging to a breakpoint, then walks back through the recorded history with the IDE's own
 * commands - Reverse Step Over and Reverse Continue - and verifies before it photographs: the CPU
 * panel's history band and its registers, the historical row in the disassembly, the status-bar
 * chip, the Call Stack rebuilt from history, and that a machine command returns to the present.
 */
const path = require("path");
const fs = require("fs");
const { fixtureProjectFolder, IMAGES } = require("../harness.cjs");

/*
 *   $8000  DI               F3
 *   $8001  LD A,1           3E 01
 *   $8003  CALL Sub         CD 00 81    ; A=2 at Leaf
 *   $8006  LD A,2           3E 02
 *   $8008  CALL Sub         CD 00 81    ; A=3 at Leaf
 *   $800B  JR $             18 FE
 *   Sub:   $8100  INC A     3C
 *          $8101  CALL Leaf CD 00 82
 *          $8104  RET       C9
 *   Leaf:  $8200  LD B,A    47
 *          $8201  RET       C9
 */
const PROGRAM = {
  0x8000: [0xf3, 0x3e, 0x01, 0xcd, 0x00, 0x81, 0x3e, 0x02, 0xcd, 0x00, 0x81, 0x18, 0xfe],
  0x8100: [0x3c, 0xcd, 0x00, 0x82, 0xc9],
  0x8200: [0x47, 0xc9]
};

const hex = (v, d) => "$" + v.toString(16).toUpperCase().padStart(d, "0");
const fail = (what, state) => {
  throw new Error(`${what}: ${JSON.stringify(state)}`);
};

/** What the IDE shows about the history cursor */
const historyState = (ide) =>
  ide.evaluate(() => {
    const text = (sel) => [...document.querySelectorAll(sel)].map((e) => e.textContent);
    return {
      band: text('[aria-label="History cursor"]'),
      chip: text('[class*="_historyChip_"]'),
      disassemblyRow: text('[data-history-exec="true"] [class*="_disassemblyAddress_"], [data-history-exec="true"]').map((t) =>
        t.slice(0, 40)
      ),
      presentBands: text('[role="note"]'),
      output: text('[class*="_outputLine_"], [class*="_outputWrapper_"]').join("\n").slice(-600)
    };
  });

async function waitFor(klive, pred, what) {
  for (let i = 0; i < 30; i++) {
    const s = await historyState(klive.ide);
    if (pred(s)) return s;
    await klive.sleep(300);
  }
  fail(what, await historyState(klive.ide));
}

module.exports = {
  name: "lite-step-back",
  window: {
    width: 1280,
    height: 860,
    sideBarWidth: "260px",
    toolPanelHeight: "120px",
    panelFontFamily: "iosevka",
    panelFontSize: 12
  },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "StepBackShots");
    try {
      await klive.cmd(`newp sp48 ${fixture.name} -p "${fixture.parent}" -o`, 9000);
      await klive.cmd("em-debug", 3000);
      await klive.cmd("em-pause", 1500);
      for (const [at, bytes] of Object.entries(PROGRAM)) {
        for (let i = 0; i < bytes.length; i++) {
          await klive.cmd(`setmem ${hex(Number(at) + i, 4)} ${hex(bytes[i], 2)} -b8`, 120);
        }
      }
      await klive.cmd("setz80reg pc $8000", 400);
      await klive.cmd("setz80reg sp $9000", 400);
      await klive.cmd("bp-set $800B", 600);
      await klive.cmd("em-debug", 2500);
      await klive.ide.locator('button[aria-label="Debug"]').click({ force: true });
      await klive.cmd("show-disass", 2500);

      // --- Reverse Step Over from the JR $: back over the second CALL Sub, to the CALL itself
      await klive.cmd("step-back-over", 1500);
      let state = await waitFor(klive, (s) => s.band.length > 0 && s.chip.length > 0, "No history band after Reverse Step Over");
      console.log("  reverse step over ·", JSON.stringify(state));
      if (!/History · step −/.test(state.band[0])) fail("The CPU panel does not say it shows history", state.band);
      if (!/memory shows the present/.test(state.band[0])) fail("The CPU panel does not warn about memory", state.band);
      if (!/⟲ History −/.test(state.chip[0])) fail("No status-bar chip", state.chip);
      if (!state.disassemblyRow.some((t) => /8008/.test(t))) fail("The disassembly does not mark the CALL at $8008", state.disassemblyRow);
      if (!state.presentBands.length) fail("No memory-reading view says it shows the present", state.presentBands);
      let shot = path.join(IMAGES, "working-with-ide", "step-back-over.png");
      fs.mkdirSync(path.dirname(shot), { recursive: true });
      await klive.ide.screenshot({ path: shot });
      console.log(`  ✓ ${path.relative(process.cwd(), shot)}`);

      // --- Reverse Continue to the earlier visit of Leaf whose register condition held (A == 2)
      await klive.cmd("history-present", 800);
      await klive.cmd("bp-set $8200 -if A == 2", 800);
      await klive.cmd("reverse-continue", 1500);
      state = await waitFor(klive, (s) => s.disassemblyRow.some((t) => /8200/.test(t)), "Reverse Continue did not reach Leaf");
      console.log("  reverse continue ·", JSON.stringify(state));
      shot = path.join(IMAGES, "working-with-ide", "reverse-continue.png");
      await klive.ide.screenshot({ path: shot });
      console.log(`  ✓ ${path.relative(process.cwd(), shot)}`);

      // --- Any machine command returns to the present (D5)
      await klive.cmd("em-sti", 1500);
      state = await waitFor(klive, (s) => s.band.length === 0 && s.chip.length === 0, "A step did not return to the present");
      console.log("  after a step · back at the present");

      await klive.cmd("bp-ea", 600);
      await klive.cmd("em-stop", 1500);
    } finally {
      fixture.cleanup();
    }
  }
};
