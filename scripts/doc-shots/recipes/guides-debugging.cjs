/**
 * Guides screenshots of a debug session on the 48K (`docs/content/en/guides/debugging/`, and the
 * command prompt page of `guides/editing/`):
 *
 * - `editing/command-prompt/commands.webp` — the Commands tab after `? bp`;
 * - `debugging/breakpoints/margin.webp` — an ordinary, a conditional, a one-shot breakpoint and a
 *   logpoint in the editor margin;
 * - `debugging/breakpoints/breakpoint-dialog.webp` — the Breakpoint dialog, condition and hit count;
 * - `debugging/run-debug/toolbar-paused.webp` — the IDE toolbar while paused;
 * - `debugging/breakpoint-conditions/log-pane.webp` — the Output's Log pane with logpoint messages;
 * - `debugging/watch/watch-panel.webp` — a byte, a word and a label in the Watch panel;
 * - `debugging/machine-state-panels/{z80-cpu,ula,system-variables}.webp`;
 * - `debugging/memory/memory-view.webp` and `debugging/disassembly/disassembly-view.webp`.
 *
 * The program is `fixtures/guides/stripes.kz80.asm`. All breakpoints are set with `bp-set` on
 * source lines (`[file]:line`), so the margin shows them as a user's gestures would make them.
 *
 * `GD_ONLY=margin,dialog,...` runs some of the shots (for iterating).
 */
const path = require("path");
const fs = require("fs");
const { fixtureProjectFolder, REPO } = require("../harness.cjs");
const h = require("../guides-helpers.cjs");
const { step, reportFailures, tag, panelShot } = require("../guides-helpers-shot.cjs");

const SOURCE = fs.readFileSync(path.join(REPO, "scripts", "doc-shots", "fixtures", "guides", "stripes.kz80.asm"), "utf8");
const FILE = "code/stripes.kz80.asm";
const ONLY = process.env.GD_ONLY ? process.env.GD_ONLY.split(",") : undefined;
const wants = (s) => !ONLY || ONLY.includes(s);

/** Source lines of the fixture */
const LINE = { log: 8, cond: 13, bp: 17, once: 21 };

/** Glyph-margin point of a line, for markers: a pin placed by `pinGlyphs`. */
const glyph = (line) => ({ selector: `[data-shot="glyph-${line}"]` });

/**
 * Places a 1px pin over the glyph margin at each line, so a marker can point at the breakpoint
 * glyph itself (Monaco's glyph decorations have no stable selector of their own).
 */
async function pinGlyphs(ide, lines) {
  const margin = await ide.locator(".monaco-editor .glyph-margin").first().boundingBox();
  for (const line of lines) {
    const box = await ide.locator(h.lineNumber(line)).first().boundingBox();
    await ide.evaluate(
      ({ line, x, y }) => {
        const pin = document.createElement("div");
        pin.setAttribute("data-shot", `glyph-${line}`);
        Object.assign(pin.style, { position: "fixed", left: `${x}px`, top: `${y}px`, width: "1px", height: "1px", pointerEvents: "none" });
        document.body.appendChild(pin);
      },
      { line, x: margin.x + margin.width / 2, y: box.y + box.height / 2 }
    );
  }
}

module.exports = {
  name: "guides-debugging",
  window: {
    width: 1280,
    height: 860,
    sideBarWidth: "420px",
    toolPanelHeight: "220px",
    panelFontFamily: "iosevka",
    panelFontSize: 12
  },

  async run(klive) {
    const { ide } = klive;
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "DebugShots");
    try {
      await h.projectWithSource(klive, fixture, { machine: "sp48", file: FILE, source: SOURCE });
      await h.showFile(klive, FILE);

      // ------------------------------------------------------------ The command prompt's help
      if (wants("commands")) {
        await step(klive, "commands", async () => {
          await klive.cmd("cls", 400);
          await klive.cmd("? bp", 1500);
          // --- The help is longer than the tool panel: maximize it for the shot
          // --- ...in a lower window, so the maximized panel has little empty space under the help
          await klive.app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("?ide"))?.setContentSize(1280, 600)
          );
          await ide.locator('[class*="_toolsHeader_"] button[data-icon="chevron-up"]').first().click({ force: true });
          await klive.sleep(1200);
          await h.park(ide);
          await klive.shot('[class*="_toolArea_"]', "en/guides/editing/command-prompt/commands.webp", {
            displayWidth: 760,
            markers: { prompt: { selector: 'input[class*="_prompt_"]', x: 0.1, y: 0.5 } }
          });
          await ide.locator('[class*="_toolsHeader_"] button[data-icon="chevron-down"]').first().click({ force: true });
          await klive.sleep(1000);
          await klive.app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("?ide"))?.setContentSize(1280, 860)
          );
          await klive.sleep(800);
          await klive.cmd("cls", 400);
        });
      }

      // ------------------------------------------------------------ Breakpoints in the margin
      for (const command of [
        `bp-set [${FILE}]:${LINE.log} -log "Fill: B={B} HL={HL:hex16}"`,
        `bp-set [${FILE}]:${LINE.cond} -hit >=3 -if B == 5`,
        `bp-set [${FILE}]:${LINE.bp}`,
        `bp-set [${FILE}]:${LINE.once} -once`
      ]) {
        await klive.cmd(command, 900);
      }
      // --- Built, so the breakpoints resolve to addresses (the dialog says so otherwise)
      await klive.cmd("compile", 4000);
      await klive.cmd("cls", 400);
      await klive.cmd("bp-list", 1200);
      console.log("  bp-list ·", (await h.outputText(ide)).replace(/\s+/g, " ").slice(0, 400));
      await klive.cmd("cls", 400);

      if (wants("margin")) {
        await step(klive, "margin", async () => {
          await h.park(ide);
          const top = (await ide.locator(".monaco-editor").first().boundingBox()).y;
          const last = await ide.locator(h.lineNumber(22)).first().boundingBox();
          await pinGlyphs(ide, [LINE.log, LINE.cond, LINE.bp, LINE.once]);
          await klive.shot(".monaco-editor", "en/guides/debugging/breakpoints/margin.webp", {
            displayWidth: 620,
            crop: { x: 0, y: 0, width: 560, height: Math.ceil(last.y + last.height - top + 6) },
            markers: {
              logpoint: glyph(LINE.log),
              conditional: glyph(LINE.cond),
              breakpoint: glyph(LINE.bp),
              oneshot: glyph(LINE.once)
            }
          });
        });
      }

      // ------------------------------------------------------------ The Breakpoint dialog
      if (wants("dialog")) {
        await step(klive, "dialog", async () => {
          const box = await ide.locator(h.lineNumber(LINE.cond)).first().boundingBox();
          await ide.mouse.click(box.x - 12, box.y + box.height / 2, { button: "right" });
          await klive.sleep(800);
          await ide.getByText("Edit Condition...", { exact: true }).first().click();
          await klive.sleep(1200);
          const page = await h.pageWithDialog(klive);
          await h.park(page);
          await klive.shot('[role="dialog"]', "en/guides/debugging/breakpoints/breakpoint-dialog.webp", {
            displayWidth: 520,
            page
          });
          await page.keyboard.press("Escape");
          await klive.sleep(600);
        });
      }

      // ------------------------------------------------------------ Debug: stop at line 17
      await klive.cmd("w-add Counter:b", 600);
      await klive.cmd("w-add Total:w", 600);
      await klive.cmd("w-add >Fill", 600);
      await h.activity(klive, "Debug");
      await klive.cmd("debug", 8000);
      await h.hideEmu(klive);
      await h.focusIde(klive);
      await h.showFile(klive, FILE);
      await klive.cmd("cls", 400);

      if (wants("toolbar")) {
        await step(klive, "toolbar", async () => {
          const sel = await tag(ide, "toolbar", () => {
            let el = document.querySelector('button[data-icon="step-over"]');
            while (el && el.getBoundingClientRect().width < window.innerWidth * 0.9) el = el.parentElement;
            return el;
          });
          await h.park(ide);
          // --- Only the buttons: the strip's right part is empty
          const right = await ide.evaluate((s) => {
            const bar = document.querySelector(s);
            const left = bar.getBoundingClientRect().left;
            return Math.max(...[...bar.querySelectorAll("button")].map((b) => b.getBoundingClientRect().right)) - left;
          }, sel);
          await klive.shot(sel, "en/guides/debugging/run-debug/toolbar-paused.webp", {
            displayWidth: 760,
            crop: { x: 0, y: 0, width: Math.ceil(right + 8) },
            markers: {
              continue: { selector: 'button[data-icon="pause"] >> xpath=following-sibling::*[1]', x: 0.3, y: 0.5 },
              stepinto: { selector: 'button[data-icon="step-into"]' },
              stepover: { selector: 'button[data-icon="step-over"]' },
              stepout: { selector: 'button[data-icon="step-out"]' }
            }
          });
        });
      }

      if (wants("log")) {
        await step(klive, "log", async () => {
          await klive.cmd("outp log", 1200);
          await h.park(ide);
          await klive.shot('[class*="_toolArea_"]', "en/guides/debugging/breakpoint-conditions/log-pane.webp", {
            displayWidth: 760
          });
          await ide.locator('[class*="_toolsHeader_"]').getByText("Commands", { exact: false }).first().click();
          await klive.sleep(800);
        });
      }

      if (wants("watch")) {
        await step(klive, "watch", async () => {
          await h.sections(ide, ["Watch"]);
          await h.park(ide);
          await panelShot(klive, "watch", "en/guides/debugging/watch/watch-panel.webp", { displayWidth: 420 });
        });
      }

      if (wants("cpu")) {
        await step(klive, "z80-cpu", async () => {
          await h.sections(ide, ["Z80 CPU"]);
          await h.park(ide);
          await panelShot(klive, "Z80", "en/guides/debugging/machine-state-panels/z80-cpu.webp", { displayWidth: 320 });
        });
        await step(klive, "ula", async () => {
          await h.sections(ide, ["ULA"]);
          await h.park(ide);
          await panelShot(klive, "ULA", "en/guides/debugging/machine-state-panels/ula.webp", { displayWidth: 320 });
        });
        await step(klive, "system-variables", async () => {
          await h.activity(klive, "Machine info");
          await h.sections(ide, ["System Variables"]);
          await h.park(ide);
          await panelShot(klive, "System Variables", "en/guides/debugging/machine-state-panels/system-variables.webp", { displayWidth: 320, maxHeight: 640 });
          await h.activity(klive, "Debug");
        });
      }

      if (wants("memory")) {
        await step(klive, "memory", async () => {
          await klive.cmd("show-memory $8000", 2500);
          await klive.cmd("cls", 400);
          await h.park(ide);
          await klive.shot('[class*="_documentArea_"], [class*="_documentsContainer_"]', "en/guides/debugging/memory/memory-view.webp", {
            displayWidth: 760,
            crop: { x: 0, y: 0, height: 440 }
          });
        });
      }

      if (wants("disass")) {
        await step(klive, "disass", async () => {
          await klive.cmd("show-disass $8000", 2500);
          await klive.cmd("cls", 400);
          await h.park(ide);
          await klive.shot('[class*="_documentArea_"], [class*="_documentsContainer_"]', "en/guides/debugging/disassembly/disassembly-view.webp", {
            displayWidth: 760,
            crop: { x: 0, y: 0, height: 480 },
            markers: { execution: { selector: '[class*="_execPoint_"]', x: 0.02, y: 0.5 } }
          });
        });
      }

      await klive.cmd("em-stop", 1500);
      reportFailures();
    } finally {
      fixture.cleanup();
    }
  }
};
