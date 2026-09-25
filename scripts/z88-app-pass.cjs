#!/usr/bin/env node

/*
 * The Cambridge Z88 manual app pass, scripted (Step 13 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`).
 *
 * Launches the built app (`out/`) under Playwright's Electron driver - `scripts/doc-shots/harness.cjs`,
 * an isolated settings file - once per model, and drives the same session through the menus, the
 * IDE's command prompt, the EMU window's keyboard and the card dialogs: boot, typing, sleep (F6) and
 * wake, battery low, card insert/remove, pause and the debugger (panels, disassembly, step-into/over/out,
 * a breakpoint), soft and hard reset (F8/F9), the LCD sizes, a keyboard layout and the RAM dialog.
 *
 * Each step records the LCD picture, the EMU status bar (which names the model) and the IDE text it
 * checks; console errors of both windows are collected, and each model's pictures and
 * `report.json` land in `.doc-shots/z88-app-pass/<model>/`. It is a smoke test of the app around the
 * one Z88 machine: until the TypeScript machine was removed
 * (`.plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`) it also ran each model's TypeScript twin and put
 * the two side by side.
 *
 * One model per run is reliable; all ten in one run are not yet - the app rebuilds its menu after
 * state changes, and some runs missed an item despite the retry.
 *
 *   npx electron-vite build --config build/electron.vite.config.ts   # out/ must be current
 *   node scripts/z88-app-pass.cjs [OZ50 OZ40 ...]                     # default: OZ50
 */

const path = require("path");
const fs = require("fs");
const { launchKlive, REPO } = require("./doc-shots/harness.cjs");

const OUT = path.join(REPO, ".doc-shots", "z88-app-pass");

/* Host keys for a character (the Z88's UK mapping, `Z88KeyMappings.ts`) */
function keysFor(ch) {
  if (/[A-Z]/.test(ch)) return [`Key${ch}`];
  if (/[a-z]/.test(ch)) return [`Key${ch.toUpperCase()}`];
  if (/[0-9]/.test(ch)) return [`Digit${ch}`];
  const special = {
    " ": ["Space"],
    "*": ["ShiftLeft", "Digit8"],
    "+": ["ShiftLeft", "Equal"],
    "=": ["Equal"],
    "-": ["Minus"],
    '"': ["ShiftLeft", "Quote"],
    ".": ["Period"],
    ",": ["Comma"]
  };
  if (!special[ch]) throw new Error(`No host key for '${ch}'`);
  return special[ch];
}

async function runModel(modelId) {
  const dir = path.join(OUT, modelId);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const k = await launchKlive({ home: path.join(OUT, "home", modelId), width: 1280, height: 820 });
  const { app, ide, cmd, sleep } = k;
  const emu = app.windows().find((w) => w.url().includes("?emu"));
  const report = { modelId, steps: [], errors: [] };
  for (const [name, page] of [
    ["ide", ide],
    ["emu", emu]
  ]) {
    page.on("console", (m) => {
      if (m.type() === "error") report.errors.push(`${name}: ${m.text()}`);
    });
    page.on("pageerror", (e) => report.errors.push(`${name} pageerror: ${e.message}`));
  }

  const showEmu = () =>
    app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().includes("?emu"));
      w.show();
      w.setContentSize(1100, 760);
      w.setPosition(700, 40);
      w.focus();
      w.webContents.focus();
    });
  // --- The app rebuilds its menu after state changes, so an item can be briefly missing or disabled
  const menu = async (id, wait = 1500) => {
    let found = "missing";
    for (let attempt = 0; attempt < 20 && found !== "clicked"; attempt++) {
      if (attempt) await sleep(500);
      found = await app.evaluate(({ Menu }, itemId) => {
        const item = Menu.getApplicationMenu().getMenuItemById(itemId);
        if (!item) return "missing";
        if (!item.enabled) return "disabled";
        item.click();
        return "clicked";
      }, id);
    }
    if (found !== "clicked") throw new Error(`Menu item '${id}' is ${found}`);
    await sleep(wait);
  };
  const tap = async (codes, hold = 120) => {
    await showEmu();
    for (const c of codes) await emu.keyboard.down(c);
    await sleep(hold);
    for (const c of [...codes].reverse()) await emu.keyboard.up(c);
    await sleep(250);
  };
  const type = async (text) => {
    for (const ch of text) await tap(keysFor(ch));
  };
  const status = () => emu.locator('[class*="_statusBar_"], [class*="statusBar"]').first().innerText().catch(() => "");
  const lcd = async (name, extra = {}) => {
    const file = path.join(dir, `${name}.png`);
    await emu.locator("canvas").first().screenshot({ path: file });
    const entry = { step: name, status: (await status()).replace(/\s+/g, " ").trim(), ...extra };
    report.steps.push(entry);
    console.log(`  ${modelId} ${name}: ${entry.status}${extra.note ? " | " + extra.note : ""}`);
    return entry;
  };
  const lastOutput = async (lines = 12) => {
    const text = await ide.locator('[class*="_commandPanel_"], [class*="_outputWrapper_"]').first().innerText().catch(() => "");
    return text.split("\n").slice(-lines).join(" / ");
  };
  const dialogButton = async (labels) => {
    for (const label of labels) {
      const b = emu.getByRole("button", { name: label, exact: true });
      if ((await b.count()) > 0) {
        await b.first().click();
        return label;
      }
    }
    throw new Error(`No dialog button among ${labels.join(", ")}`);
  };
  const chooseOption = async (text) => {
    await emu.getByRole("combobox").first().click();
    await sleep(400);
    await emu.getByRole("option", { name: text, exact: false }).first().click();
    await sleep(300);
  };
  const start = async (wait = 12_000) => {
    await cmd("em-start", wait);
  };

  try {
    await showEmu();

    // --- 1. Boot
    await menu(`machine_z88_${modelId}`, 4000);
    await start();
    await lcd("01-boot");

    // --- 2. Typing: the Index is up; BBC BASIC is the third application
    await tap(["ArrowDown"]);
    await tap(["ArrowDown"]);
    await tap(["Enter"]);
    await sleep(3000);
    await type("PRINT 6*7");
    await tap(["Enter"]);
    await sleep(1500);
    await lcd("02-basic");
    await tap(["F2"]); // --- back to the Index
    await sleep(2000);

    // --- 3. Sleep (both shifts) and wake
    await menu("z88_press_both_shifts", 3000);
    await lcd("03-sleep");
    await menu("z88_press_both_shifts", 3000);
    await lcd("04-wake");

    // --- 4. Battery low
    await menu("z88_battery_low", 3000);
    await lcd("05-battery-low");

    // --- 5. Cards: insert an AMD flash card into slot 1, then remove it
    const slot1 = emu.locator('[class*="_slotHandler_"]').nth(1);
    await slot1.locator('[class*="_button_"]').last().click();
    await sleep(1200);
    await chooseOption("AMD Flash 29F040B");
    await dialogButton(["Ok", "OK", "Insert"]);
    await sleep(4000);
    await lcd("06-card-in", { note: (await slot1.innerText()).replace(/\s+/g, " ") });
    await slot1.locator('[class*="_button_"]').last().click();
    await sleep(1200);
    await dialogButton(["Ok", "OK", "Remove", "Yes"]);
    await sleep(4000);
    await lcd("07-card-out", { note: (await slot1.innerText()).replace(/\s+/g, " ") });

    // --- 6. The debugger
    await cmd("em-pause", 1500);
    const paused = await lcd("08-paused");
    const pcMatch = /PC:\s*([0-9A-F]{4})/i.exec(paused.status);
    const pc = pcMatch ? parseInt(pcMatch[1], 16) : 0;
    await cmd("cls", 500);
    await cmd(`dis $${pc.toString(16)} $${(pc + 16).toString(16)}`, 1500);
    report.steps.push({ step: "08-dis", output: await lastOutput(10) });
    const pcs = [];
    for (const step of ["em-sti", "em-sti", "em-sto", "em-sto", "em-out"]) {
      await cmd(step, 1500);
      pcs.push(`${step}=${/PC:\s*([0-9A-F]{4})/i.exec(await status())?.[1]}`);
    }
    report.steps.push({ step: "09-steps", pcs: pcs.join(" ") });
    console.log(`  ${modelId} steps: ${pcs.join(" ")}`);
    await ide.screenshot({ path: path.join(dir, "09-ide-paused.png") });

    // --- The panels, paused: Debug (CPU, Blink, ...), Machine info, the memory view
    await cmd("em-pause", 1000);
    for (const [activity, name] of [
      ["Debug", "09-panel-debug"],
      ["Machine info", "09-panel-machine"]
    ]) {
      await ide.locator(`button[aria-label="${activity}"]`).first().click({ force: true });
      await sleep(1500);
      if (activity === "Debug") {
        // --- Open the Blink panel too (the Z88's own)
        await ide.getByText("BLINK", { exact: true }).first().click({ force: true });
        await sleep(1500);
      }
      const panel = ide.locator('[class*="_sideBar_"]').first();
      await panel.screenshot({ path: path.join(dir, `${name}.png`) }).catch(() => {});
      report.steps.push({ step: name, text: await panel.innerText().catch(() => "") });
    }
    await ide.locator('button[aria-label="Show Memory Panel"]').first().click({ force: true });
    await sleep(2000);
    await ide.screenshot({ path: path.join(dir, "09-memory.png") });
    await ide.locator('button[aria-label="Explorer"]').first().click({ force: true });
    await cmd("cls", 500);
    const bpPc = /PC:\s*([0-9A-F]{4})/i.exec(await status())?.[1];
    await cmd(`bp-set $${bpPc}`, 800);
    await cmd("em-debug", 3000);
    const overlay = await emu.getByText(/Paused \(PC:/).first().innerText({ timeout: 5000 }).catch(() => "no pause overlay");
    await lcd("10-breakpoint", { note: `bp at ${bpPc}; EMU: ${overlay}` });
    await cmd(`bp-del $${bpPc}`, 800);
    await cmd("em-start", 2000);

    // --- 7. Soft and hard reset
    await menu("z88_reset", 10_000);
    await lcd("11-soft-reset");
    await menu("z88_hard_reset", 14_000);
    await lcd("12-hard-reset");

    // --- 8. LCD sizes (each rebuilds the machine)
    for (const size of ["640_320", "640_480", "640_64"]) {
      await menu(`z88_${size}`, 4000);
      await start();
      await lcd(`13-lcd-${size}`);
    }

    // --- 9. A keyboard layout
    await menu("z88_de_layout", 3000);
    await start(3000);
    await lcd("14-keyboard-de");
    await emu.locator('button[aria-label="Show/Hide keyboard"]').first().click({ force: true });
    await sleep(1500);
    await emu.screenshot({ path: path.join(dir, "14-keyboard-panel.png") });
    await emu.locator('button[aria-label="Show/Hide keyboard"]').first().click({ force: true });
    await sleep(500);

    // --- 10. The RAM dialog: 128K
    const slot0 = emu.locator('[class*="_slotHandler_"]').nth(0);
    await slot0.locator('[class*="_button_"]').first().click();
    await sleep(1200);
    await chooseOption("128K");
    await dialogButton(["Ok", "OK", "Change"]);
    await sleep(4000);
    await start();
    await lcd("15-ram-128k", { note: (await slot0.innerText()).replace(/\s+/g, " ") });
  } catch (error) {
    report.failure = `${error.message}`;
    console.log(`  ${modelId} FAILED: ${error.message}`);
    await emu.screenshot({ path: path.join(dir, "failure-emu.png") }).catch(() => {});
    await ide.screenshot({ path: path.join(dir, "failure-ide.png") }).catch(() => {});
  } finally {
    fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(report, null, 2));
    await k.close();
  }
  return report;
}

async function main() {
  const models = process.argv.slice(2);
  const bases = models.length ? models : ["OZ50"];
  const summary = [];
  for (const base of bases) summary.push(await runModel(base));
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
  for (const r of summary) {
    console.log(`${r.modelId}: ${r.failure ? "FAILED " + r.failure : "completed"}; ${r.errors.length} console errors`);
    for (const e of r.errors.slice(0, 10)) console.log(`   ${e}`);
  }
  if (summary.some((r) => r.failure)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
