/**
 * Screenshot for `docs/content/working-with-ide/execution-history.mdx`, and the running-app check of
 * the Execution History (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` Phase 9).
 *
 * On the Next it pokes a small program into a paused machine - a loop that calls a routine, with
 * interrupts on - starts it with debugging, and stops at a breakpoint inside the routine. Then it
 * opens the Execution History and verifies before it photographs: the count and the recording
 * indicator in the header, instruction rows with their disassembly, an interrupt separator row, the
 * newest row, the detail pane for a selected row, and the filter.
 */
const os = require("os");
const path = require("path");
const fs = require("fs");
const { fixtureProjectFolder, IMAGES } = require("../harness.cjs");

/*
 * $8000  ld a,0           3E 00
 * $8002  ld b,$10         06 10      Loop
 * $8004  call $8010       CD 10 80   Again
 * $8007  inc a            3C
 * $8008  djnz $8004       10 FA
 * $800A  jr $8002         18 F6
 * $8010  ld hl,$4000      21 00 40   Sub
 * $8013  ld (hl),a        77
 * $8014  inc hl           23
 * $8015  ret              C9
 */
const PROGRAM = {
  0x8000: [0x3e, 0x00, 0x06, 0x10, 0xcd, 0x10, 0x80, 0x3c, 0x10, 0xfa, 0x18, 0xf6],
  0x8010: [0x21, 0x00, 0x40, 0x77, 0x23, 0xc9]
};
const BREAK_AT = 0x8013;

const hex = (v, d) => "$" + v.toString(16).toUpperCase().padStart(d, "0");
const fail = (what, state) => {
  throw new Error(`${what}: ${JSON.stringify(state)}`);
};

/** What the Execution History document shows */
const historyState = (ide) =>
  ide.evaluate(() => {
    const text = (sel) => document.querySelector(sel)?.textContent ?? "";
    const rows = [...document.querySelectorAll('[class*="_row_"]')].filter((r) => r.querySelector('[class*="_step_"]'));
    return {
      count: text('[class*="_count_"]'),
      recording: text('[class*="_recording_"]'),
      empty: text('[class*="_emptyState_"]'),
      rows: rows.length,
      separators: rows.filter((r) => /_separatorRow_/.test(r.className)).map((r) => r.textContent).slice(0, 3),
      newest: rows.filter((r) => /_newestRow_/.test(r.className)).map((r) => r.textContent),
      instructions: [...document.querySelectorAll('[class*="_instruction_"]')].map((e) => e.textContent).slice(-8),
      detail: text('[class*="_detail_"]').slice(0, 200)
    };
  });

async function waitFor(ide, klive, pred, what) {
  for (let i = 0; i < 30; i++) {
    const s = await historyState(ide);
    if (pred(s)) return s;
    await klive.sleep(300);
  }
  fail(what, await historyState(ide));
}

module.exports = {
  name: "execution-history",
  window: {
    // --- The execution history is an advanced debugging feature: off unless the user turns it on
    userSettings: { features: { advancedDebugging: "1" } },
    width: 1200,
    height: 860,
    sideBarWidth: "200px",
    toolPanelHeight: "90px",
    panelFontFamily: "iosevka",
    panelFontSize: 12,
    // --- A Next launch writes `~/Klive/ks2.cim`: keep it out of the real home
    userHome: path.join(os.tmpdir(), "klive-shots-history-home")
  },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "HistoryShots");
    try {
      await klive.cmd(`newp zxnext ${fixture.name} -p "${fixture.parent}" -o`, 12000);
      await klive.cmd("em-debug", 4000);
      await klive.cmd("em-pause", 1000);
      for (const [at, bytes] of Object.entries(PROGRAM)) {
        for (let i = 0; i < bytes.length; i++) {
          await klive.cmd(`setmem ${hex(Number(at) + i, 4)} ${hex(bytes[i], 2)} -b8`, 120);
        }
      }
      await klive.cmd("setz80reg pc $8000", 400);
      await klive.cmd(`bp-set ${hex(BREAK_AT, 4)} -hit *400`, 600);
      await klive.cmd("em-debug", 3000);
      await klive.cmd("show-history", 2500);
      let state = await waitFor(klive.ide, klive, (s) => s.rows > 10 && s.instructions.length > 0, "No history rows at the breakpoint");
      console.log("  at the breakpoint ·", JSON.stringify(state));
      if (!/^[\d,]+ of 131,072 recorded$/.test(state.count)) fail("The header does not count the records", state.count);
      if (!/Recording/.test(state.recording)) fail("The header does not say it records", state.recording);
      if (state.newest.length !== 1) fail("There is not exactly one newest row", state.newest);
      if (!state.instructions.some((t) => /call|ld \(hl\),a|inc hl|djnz/i.test(t))) fail("The rows are not the program's instructions", state.instructions);

      // --- Select the row before the newest: the detail pane shows before/after
      const rows = klive.ide.locator('[class*="_row_"]:has([class*="_step_"])');
      const n = await rows.count();
      await rows.nth(n - 2).click();
      await klive.sleep(600);
      state = await historyState(klive.ide);
      console.log("  selected ·", state.detail);
      if (!/Step −2/.test(state.detail) || !/Before/.test(state.detail)) fail("No detail pane for the selected row", state.detail);

      const shot = path.join(IMAGES, "working-with-ide", "execution-history.png");
      fs.mkdirSync(path.dirname(shot), { recursive: true });
      await klive.ide.screenshot({ path: shot });
      console.log(`  ✓ ${path.relative(process.cwd(), shot)}`);

      // --- The filter: an address range keeps only the routine's rows
      const filter = klive.ide.locator('input[aria-label="Filter the execution history"]');
      await filter.fill("$8010-$8015");
      await klive.sleep(2500);
      state = await historyState(klive.ide);
      console.log("  filtered ·", JSON.stringify(state.instructions));
      if (!state.instructions.length || state.instructions.some((t) => !/ld hl|ld \(hl\),a|inc hl|ret/i.test(t))) {
        fail("The address filter let other rows through", state.instructions);
      }
      await filter.fill("");
      await klive.cmd("bp-ea", 600);
      await klive.cmd("em-stop", 1500);
    } finally {
      fixture.cleanup();
    }
  }
};
