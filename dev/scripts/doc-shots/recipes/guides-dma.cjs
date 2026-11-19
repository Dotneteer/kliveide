/**
 * Guides screenshot of the ZX Spectrum Next DMA panel (`docs/content/en/guides/next/dma.mdx`,
 * `dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §3):
 *
 * - `dma/dma-panel.webp` — the DMA side-bar panel, paused while the DMA chapter's sample player runs:
 *   2,048 bytes from $C000 to the Specdrum DAC on port $DF, burst mode, prescaler 55, here with auto
 *   restart so the transfer is under way whenever the machine is paused;
 * - `dma/dma-port-log.webp` — the DMA Port Log document (§11), open before the program ran: the setup's
 *   16 bytes sent by OTIR, decoded, and the status read after it.
 *
 * Like `guides-interrupts.cjs` it pokes a program into a paused Next (no NextZXOS needed). The setup
 * bytes are the chapter's `Prog`, with WR5 $A2 (auto restart) for $82.
 */
const os = require("os");
const path = require("path");
const { fixtureProjectFolder } = require("../harness.cjs");
const h = require("../guides-helpers.cjs");
const { step, reportFailures, panelShot } = require("../guides-helpers-shot.cjs");

const hex = (v, d) => "$" + v.toString(16).toUpperCase().padStart(d, "0");

// prettier-ignore
const SETUP = [
  0x83,             // disable
  0x7d, 0x00, 0xc0, // WR0: A to B, port A $C000
  0x00, 0x08,       //   length 2,048
  0x14,             // WR1: A is memory, upwards
  0x68, 0x21, 55,   // WR2: B is I/O, fixed; 3-clock cycles; prescaler 55
  0xcd, 0xdf, 0x00, // WR4: burst, port B $00DF
  0xa2,             // WR5: auto restart
  0xcf, 0x87        // load, enable
];

// prettier-ignore
const CODE = [
  [0x8000, [
    0xf3,                   // 8000 DI
    0xed, 0x91, 0x07, 0x00, // 8001 NEXTREG $07,0    ; 3.5 MHz
    0x21, 0x00, 0x81,       // 8005 LD HL,$8100
    0x01, 0x6b, SETUP.length, // 8008 LD BC,len*256+$6B
    0xed, 0xb3,             // 800B OTIR
    0x3e, 0xbf,             // 800D LD A,$BF         ; read the status next
    0xed, 0x79,             // 800F OUT (C),A
    0xed, 0x78,             // 8011 IN A,(C)
    0x00,                   // 8013 NOP              ; Main
    0x18, 0xfd              // 8014 JR $8013
  ]],
  [0x8100, SETUP]
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
  name: "guides-dma",
  window: {
    width: 1280,
    height: 900,
    sideBarWidth: "440px",
    toolPanelHeight: "120px",
    panelFontFamily: "iosevka",
    panelFontSize: 12,
    userHome: path.join(os.tmpdir(), "klive-shots-guides-dma-home")
  },

  async run(klive) {
    const { ide } = klive;
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "DmaShots");
    try {
      await klive.cmd(`newp zxnext ${fixture.name} -p "${fixture.parent}" -o`, 12000);
      await klive.cmd("em-debug", 4000);
      await klive.cmd("em-pause", 1000);
      for (const [address, bytes] of CODE) await poke(klive, address, bytes);
      await klive.cmd("setz80reg pc $8000", 400);
      // --- The port log records only while it is open
      await klive.cmd("show-dma-log", 2000);
      await klive.cmd("em-debug", 1500);
      await klive.cmd("em-pause", 1500);
      await h.hideEmu(klive);
      await h.focusIde(klive);
      await klive.cmd("cls", 400);

      // --- The DMA panel is in the Machine info activity, below Interrupts
      await h.activity(klive, "Machine info");
      await step(klive, "panel", async () => {
        await h.sections(ide, ["DMA"]);
        await h.park(ide);
        await panelShot(klive, "DMA", "en/guides/next/dma/dma-panel.webp", {
          displayWidth: 380,
          maxHeight: 820
        });
      });

      await step(klive, "port-log", async () => {
        await h.park(ide);
        // --- Down to the last row: the rest of the document is empty
        const docs = '[class*="_documentArea_"]';
        const area = await ide.locator(docs).first().boundingBox();
        const rows = await ide.locator(`${docs} table tbody tr`).last().boundingBox();
        await klive.shot(docs, "en/guides/next/dma/dma-port-log.webp", {
          displayWidth: 900,
          crop: { x: 0, y: 0, width: area.width, height: rows.y + rows.height - area.y + 12 }
        });
      });

      await klive.cmd("em-stop", 2000);
      reportFailures();
    } finally {
      fixture.cleanup();
    }
  }
};
