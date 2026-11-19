/**
 * Guides screenshots of the ZX Spectrum Next interrupt views (`docs/content/en/guides/next/interrupts.mdx`,
 * `dev/plans/NEXT_INTERRUPTS_DEBUGGING_PLAN.md`):
 *
 * - `interrupts/interrupts-panel.webp` — the Interrupts side-bar panel, paused while the ULA's handler
 *   runs: the ULA in service, the sources below it held;
 * - `interrupts/interrupt-timeline.webp` — the Interrupt Timeline over two frames, the line
 *   interrupt nested inside the ULA's handler;
 * - `interrupts/interrupt-stop.webp` — the breakpoint dialog with an interrupt stop.
 *
 * Like `guides-next.cjs` it pokes a program into a paused Next (no NextZXOS needed): hardware IM2
 * mode at 3.5 MHz, the ULA (vector $B6) and the line interrupt at line 96 (vector $A0); the ULA's
 * handler re-enables interrupts and runs for about 43,000 T-states, so the line interrupt rings
 * inside it. Every handler ends `EI; RETI`: an acknowledge clears IFF1 and IFF2, and RETI copies IFF2
 * back, so a handler without EI returns with interrupts off for good (the panel's "disabled" warning).
 */
const os = require("os");
const path = require("path");
const { fixtureProjectFolder } = require("../harness.cjs");
const h = require("../guides-helpers.cjs");
const { step, reportFailures, panelShot } = require("../guides-helpers-shot.cjs");

const hex = (v, d) => "$" + v.toString(16).toUpperCase().padStart(d, "0");
const DOCS = '[class*="_documentArea_"], [class*="_documentsContainer_"]';

// prettier-ignore
const CODE = [
  [0x8000, [
    0xf3,                   // 8000 DI
    0xed, 0x91, 0x07, 0x00, // 8001 NEXTREG $07,0    ; 3.5 MHz, so the handler's length is known
    0x3e, 0xbe,             // 8005 LD A,$BE
    0xed, 0x47,             // 8007 LD I,A
    0xed, 0x5e,             // 8009 IM 2
    0xed, 0x91, 0xc0, 0xa1, // 800B NEXTREG $C0,$A1  ; hardware IM2 mode, vectors $A0-$BA
    0xed, 0x91, 0x22, 0x02, // 800F NEXTREG $22,$02  ; the line interrupt on
    0xed, 0x91, 0x23, 0x60, // 8013 NEXTREG $23,96
    0xed, 0x91, 0xc4, 0x03, // 8017 NEXTREG $C4,$03  ; the ULA and the line interrupt
    0xfb,                   // 801B EI
    0x00,                   // 801C NOP              ; Main
    0x18, 0xfd              // 801D JR $801C
  ]],
  // --- The ULA's handler: EI, then about 43,000 T-states (past line 96), then RETI
  [0x9000, [0xfb, 0x0e, 0x0d, 0x06, 0x00, 0x10, 0xfe, 0x0d, 0x20, 0xf9, 0xed, 0x4d]],
  // --- The line interrupt's handler: a short delay, then EI and RETI
  [0x9100, [0x06, 0x10, 0x10, 0xfe, 0xfb, 0xed, 0x4d]],
  // --- The vector table at $BE00: $A0 -> $9100, $B6 -> $9000
  [0xbea0, [0x00, 0x91]],
  [0xbeb6, [0x00, 0x90]]
];

async function poke(klive, address, bytes) {
  for (let i = 0; i < bytes.length; i += 4) {
    const chunk = bytes.slice(i, i + 4);
    const value = chunk.reduce((v, b, k) => v + b * 2 ** (8 * k), 0);
    const bits = [8, 16, 24, 32][chunk.length - 1];
    await klive.cmd(`setmem ${hex(address + i, 4)} ${hex(value, chunk.length * 2)} -b${bits}`, 150);
  }
}

module.exports = {
  name: "guides-interrupts",
  window: {
    width: 1280,
    height: 900,
    sideBarWidth: "440px",
    toolPanelHeight: "120px",
    panelFontFamily: "iosevka",
    panelFontSize: 12,
    userHome: path.join(os.tmpdir(), "klive-shots-guides-interrupts-home")
  },

  async run(klive) {
    const { ide } = klive;
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "InterruptShots");
    try {
      await klive.cmd(`newp zxnext ${fixture.name} -p "${fixture.parent}" -o`, 12000);
      await klive.cmd("em-debug", 4000);
      await klive.cmd("em-pause", 1000);
      for (const [address, bytes] of CODE) await poke(klive, address, bytes);
      await klive.cmd("setz80reg pc $8000", 400);
      // --- The timeline records only while it is open
      // --- Debug › Interrupt Timeline (the menu item, so the run checks it exists)
      await h.menu(klive, "show_interrupt_timeline", { wait: 2500 });
      await klive.emu({ width: 820, height: 700 });
      await klive.cmd("em-debug", 2500);
      await klive.cmd("em-pause", 1500);
      await h.hideEmu(klive);
      await h.focusIde(klive);
      await klive.cmd("cls", 400);

      await step(klive, "timeline", async () => {
        const doc = ide.locator('[class*="_documentArea_"]');
        await doc.getByRole("button", { name: "2", exact: true }).first().click();
        await klive.sleep(800);
        await h.park(ide);
        await klive.shot(DOCS, "en/guides/next/interrupts/interrupt-timeline.webp", { displayWidth: 900 });
      });

      await h.activity(klive, "Debug");
      await step(klive, "panel", async () => {
        // --- An interrupt stop on the line interrupt: the machine stops at its handler's first
        // --- instruction, nested inside the ULA's handler, so both are in service
        await klive.cmd("bp-set int:ack:line", 800);
        await klive.cmd("em-debug", 2500);
        await h.hideEmu(klive);
        await h.focusIde(klive);
        await klive.cmd("cls", 400);
        await h.sections(ide, ["Interrupts"]);
        await h.park(ide);
        await panelShot(klive, "Interrupts", "en/guides/next/interrupts/interrupts-panel.webp", {
          displayWidth: 380,
          maxHeight: 820
        });
      });

      await step(klive, "stop-dialog", async () => {
        const panel = h.sectionLocator(ide, "Breakpoints");
        await h.sections(ide, ["Breakpoints"]);
        await panel.getByText("INT:ACK:LINE").first().dblclick();
        await klive.sleep(1500);
        await klive.shot('[role="dialog"]', "en/guides/next/interrupts/interrupt-stop.webp", { displayWidth: 560 });
        await ide.locator('[role="dialog"]').getByRole("button", { name: "Cancel", exact: true }).click();
        await klive.sleep(600);
        await klive.cmd("bp-del int:ack:line", 600);
      });

      await klive.cmd("em-stop", 2000);
      reportFailures();
    } finally {
      fixture.cleanup();
    }
  }
};
