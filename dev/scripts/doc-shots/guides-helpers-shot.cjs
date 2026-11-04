/**
 * Shot-level helpers for the `guides-*.cjs` recipes: a step that logs its failure and goes on (so
 * one broken shot does not hide the state of the others), and element tagging for crops that have
 * no class of their own.
 */
const path = require("path");
const fs = require("fs");
const { REPO } = require("./harness.cjs");

const failures = [];

/** Runs one shot's steps; on failure saves a window picture to `.doc-shots/debug/` and goes on. */
async function step(klive, name, fn) {
  try {
    await fn();
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}: ${String(e.message ?? e).split("\n")[0]}`);
    const dir = path.join(REPO, ".doc-shots", "debug");
    fs.mkdirSync(dir, { recursive: true });
    for (const page of klive.app.windows()) {
      const kind = page.url().includes("?emu") ? "emu" : "ide";
      await page.screenshot({ path: path.join(dir, `${name}-${kind}.png`) }).catch(() => {});
    }
    // --- Close whatever dialog or menu the failure left open
    await klive.ide.keyboard.press("Escape").catch(() => {});
  }
}

/** Throws at the end of a recipe if any step failed. */
function reportFailures() {
  if (failures.length) throw new Error(`Failed shots: ${failures.join(", ")}`);
}

/**
 * Tags the element `fn` (evaluated in the page) returns with `data-shot="<name>"`, so it can be
 * captured by `[data-shot="<name>"]`.
 */
async function tag(page, name, fn, arg) {
  const ok = await page.evaluate(`(() => {
    const el = (${fn.toString()})(${JSON.stringify(arg ?? null)});
    if (!el) return false;
    document.querySelectorAll('[data-shot="${name}"]').forEach((e) => e.removeAttribute("data-shot"));
    el.setAttribute("data-shot", "${name}");
    return true;
  })()`);
  if (!ok) throw new Error(`Nothing to tag as ${name}`);
  return `[data-shot="${name}"]`;
}

/**
 * Photographs one side-bar panel (header and content) whose header contains `title`, cropped to
 * the content's last row, so an expanded panel's empty space below its rows is left out.
 */
async function panelShot(klive, title, relPath, { displayWidth, markers, maxHeight } = {}) {
  const sel = await tag(
    klive.ide,
    "panel",
    (t) =>
      [...document.querySelectorAll('[class*="_sideBarPanel_"]')].find((p) =>
        (p.querySelector('[class*="_headerText_"]')?.textContent ?? "").toUpperCase().includes(t.toUpperCase())
      ),
    title
  );
  const height = await klive.ide.evaluate((s) => {
    // --- A just-clicked header keeps a focus ring: drop it
    document.activeElement?.blur?.();
    const panel = document.querySelector(s);
    const top = panel.getBoundingClientRect().top;
    let bottom = top;
    for (const el of panel.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const leaf = el.childElementCount === 0 && (el.textContent ?? "").trim() !== "";
      if (leaf || el.tagName === "CANVAS" || el.tagName === "svg" || el.tagName === "INPUT") bottom = Math.max(bottom, r.bottom);
    }
    return Math.ceil(bottom - top + 8);
  }, sel);
  return klive.shot(sel, relPath, {
    displayWidth,
    markers,
    crop: { x: 0, y: 0, height: maxHeight ? Math.min(height, maxHeight) : height }
  });
}

module.exports = { step, reportFailures, tag, panelShot };
