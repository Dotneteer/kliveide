/**
 * Guides screenshots of the Enterprise 64/128 (`docs/content/en/guides/machines/enterprise.mdx`):
 *
 * - `machines/enterprise/ep-keyboard.webp` — the EMU window at IS-BASIC's prompt with a short program
 *   typed, and the on-screen keyboard under it.
 * - `machines/enterprise/ep-basic-listing.webp` — the IDE with the BASIC Listing view of that program.
 * - `machines/enterprise/ep-nick-panel.webp` — the NICK panel of the paused machine.
 * - `machines/enterprise/ep-dave-panel.webp` — the DAVE panel of the paused machine.
 * - `machines/enterprise/ep-run.webp` — the EMU window after Run on a new Enterprise project: the
 *   template's two lines of welcome on the page it opens.
 *
 * The session starts on the Enterprise 128 (seeded through `sessionSettings`). EXOS tests the RAM for
 * about six seconds, then its banner waits for a key. Keys are held for a few frames each (`h.press`):
 * EXOS scans the keyboard at 50 Hz and misses a shorter tap. The project comes from the Enterprise
 * template (`newp ep`) in a generated fixture folder, removed afterwards; Run boots the machine again.
 */
const { fixtureProjectFolder } = require("../harness.cjs");
const h = require("../guides-helpers.cjs");
const { step, reportFailures, panelShot } = require("../guides-helpers-shot.cjs");

const KEYBOARD_BUTTON = 'button[aria-label="Show/Hide keyboard"]';

/** The program typed at IS-BASIC's prompt: a DO loop, which the listing indents */
const PROGRAM = ["10 DO", "20 PRINT 42", "30 LOOP"];

/** A line of text as host key codes (letters, digits and spaces only), then ENTER */
function keysOf(line) {
  const keys = [];
  for (const ch of line) {
    if (ch === " ") keys.push("Space");
    else if (/[0-9]/.test(ch)) keys.push(`Digit${ch}`);
    else if (/[A-Z]/.test(ch)) keys.push(`Key${ch}`);
    else throw new Error(`The recipe cannot type "${ch}"`);
  }
  keys.push("Enter");
  return keys;
}

module.exports = {
  name: "guides-enterprise",
  window: {
    width: 1280,
    height: 820,
    sideBarWidth: "320px",
    globalSettings: {
      emuViewOptions: { showMediaInfo: true, showKeyboard: false },
      emuOptions: { keyboardPanelHeight: "330px" }
    },
    sessionSettings: { machineId: "ep", modelId: "ep128" }
  },

  async run(klive) {
    let emu = await klive.emu({ width: 820, height: 980 });

    await step(klive, "boot", async () => {
      await klive.cmd("em-start", 2000);
      // --- The RAM test (about 300 frames), then the banner waits for a key
      await h.sleep(9000);
      emu = await klive.emu({ width: 820, height: 980 });
      await h.press(emu, ["Space"]);
      // --- IS-BASIC prints its banner and "ok"; the editor drops keys typed too early
      await h.sleep(3000);
      for (const line of PROGRAM) {
        await h.press(emu, keysOf(line));
        await h.sleep(300);
      }
      await h.sleep(1000);
    });

    await step(klive, "keyboard", async () => {
      emu = await klive.emu({ width: 820, height: 980 });
      await emu.locator(KEYBOARD_BUTTON).first().click({ force: true });
      await h.sleep(1500);
      await h.park(emu);
      await klive.shot(h.ROOT, "en/guides/machines/enterprise/ep-keyboard.webp", { displayWidth: 760, page: emu });
      await emu.locator(KEYBOARD_BUTTON).first().click({ force: true });
      await h.sleep(800);
    });

    await step(klive, "basic-listing", async () => {
      // --- The View menu's item; when the OS gives no window focus (the menu has no submenus then),
      // --- the same IDE call the item makes, sent straight to the IDE window
      try {
        await h.menu(klive, "show_basic", { wait: 1500, timeout: 8000 });
      } catch {
        await klive.app.evaluate(({ BrowserWindow }) => {
          const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("?ide"));
          win?.webContents.send("MainToIde", { type: "ApiMethodRequest", method: "showBasic", targetId: "ide", args: [true], correlationId: 990001 });
        });
        await h.sleep(1500);
      }
      await h.waitFor(
        async () => {
          const text = (await klive.ide.locator("body").innerText()).replace(/ /g, " ");
          return /10\s+DO/.test(text) && /20\s+PRINT 42/.test(text) && /30\s+LOOP/.test(text);
        },
        "the typed program in the BASIC Listing view",
        15000
      );
      await klive.cmd("cls", 700);
      await h.park(klive.ide);
      await klive.shot(h.ROOT, "en/guides/machines/enterprise/ep-basic-listing.webp", { displayWidth: 760 });
    });

    await step(klive, "panels", async () => {
      await klive.cmd("em-pause", 1500);
      await h.activity(klive, "Debug");
      await h.sections(klive.ide, ["NICK", "DAVE"]);
      await h.sleep(1200);
      await panelShot(klive, "NICK", "en/guides/machines/enterprise/ep-nick-panel.webp", { displayWidth: 320 });
      await panelShot(klive, "DAVE", "en/guides/machines/enterprise/ep-dave-panel.webp", { displayWidth: 320 });
      await klive.cmd("em-stop", 1500);
    });

    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "EpHello");
    try {
      await step(klive, "run", async () => {
        await klive.cmd(`newp ep ${fixture.name} -p "${fixture.parent}" -o`, 8000);
        emu = await klive.emu({ width: 1000, height: 760 });
        await klive.cmd("run", 2000);
        await h.waitFor(
          async () => (await klive.ide.evaluate(() => document.body.innerText)).includes("Code injected"),
          "the code injected",
          40000
        );
        // --- EXOS loads KLIVE.COM through the FILE: device, starts it, and it opens its page
        await h.sleep(6000);
        emu = await klive.emu({ width: 1000, height: 760 });
        await h.park(emu);
        await klive.shot(h.ROOT, "en/guides/machines/enterprise/ep-run.webp", { displayWidth: 760, page: emu });
      });
    } finally {
      fixture.cleanup();
    }
    reportFailures();
  }
};
