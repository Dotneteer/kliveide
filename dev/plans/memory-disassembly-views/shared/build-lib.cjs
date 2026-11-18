// The build steps the Memory and Disassembly view mockups share: real ROM pages with what Klive's
// own ROM sidecars say about them, the ZX Spectrum's system variables, the NextReg names, and the
// shared browser code. Each mockup's build-mockup.cjs inlines them into its template.
const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..", "..", "..", "..");
const ROMS = path.join(REPO, "src", "public", "roms");
const PAGE = 0x4000;

function sidecarBank(sidecar, bank) {
  const json = JSON.parse(fs.readFileSync(path.join(ROMS, sidecar), "utf8"));
  return json.banks?.[String(bank)];
}

/**
 * One ROM page and its sidecar facts.
 * @param withNotes also carry the data regions and the line annotations (comments, synopses)
 */
function romPage(file, index, sidecar, bank, withNotes) {
  const bytes = fs.readFileSync(path.join(ROMS, file)).subarray(index * PAGE, (index + 1) * PAGE).toString("base64");
  const b = sidecarBank(sidecar, bank) ?? {};
  const labels = {};
  for (const { name, value } of b.localLabels ?? []) {
    if (value < 0 || value >= PAGE) continue;
    const synopsis = (b.lineAnnotations?.[String(value)]?.synopsis ?? "").split("\n")[0].slice(0, 110);
    labels[value] = synopsis ? [name, synopsis] : [name];
  }
  const page = { bytes, labels };
  if (withNotes) {
    page.regions = (b.regions ?? []).filter((r) => r.start < PAGE).map((r) => ({ start: r.start, end: Math.min(r.end, PAGE - 1), type: r.type, decode: r.decode }));
    page.notes = {};
    for (const [off, a] of Object.entries(b.lineAnnotations ?? {})) {
      if (+off >= PAGE) continue;
      const n = {};
      if (a.comment) n.c = a.comment.split("\n")[0].slice(0, 90);
      if (a.synopsis) n.s = a.synopsis.split("\n").slice(0, 3).join(" ").slice(0, 240);
      if (n.c || n.s) page.notes[off] = n;
    }
  }
  return page;
}

/** The ROM pages both mockups embed */
function romData(withNotes = false) {
  return {
    "sp128/R0": romPage("sp128-0.rom", 0, "sp128-0.rom.dis", 0, withNotes),
    // --- ROM 1 is the 48K BASIC ROM: its sidecar inherits the 48K ROM's annotations
    "sp128/R1": romPage("sp128-1.rom", 0, "sp48.rom.dis", 0, withNotes),
    "z88/00": romPage("z88v47.rom", 0x00, "z88v47.rom.dis", 0, withNotes),
    "z88/1F": romPage("z88v47.rom", 0x1f, "z88v47.rom.dis", 31, withNotes),
    "next/R0": romPage("zxnext/nextzxos-2.10/enNextZX.rom", 0, "zxnext/nextzxos-2.10/enNextZX.rom.dis", 0, withNotes)
  };
}

/** The ZX Spectrum's system variables, address -> name, spelled as the IDE prints them (`LAST_K`) */
function sysVars() {
  const src = fs.readFileSync(path.join(REPO, "src", "emu", "machines", "zxSpectrum48", "ZxSpectrum48SysVars.ts"), "utf8");
  const out = {};
  for (const m of src.matchAll(/address:\s*0x([0-9a-f]+),\s*name:\s*"([^"]+)"/gi)) out[parseInt(m[1], 16)] = m[2].replace(/[^A-Za-z0-9_]/g, "_");
  return out;
}

/** NextReg number -> name, from the IDE's descriptor table */
function nextRegNames() {
  const src = fs.readFileSync(path.join(REPO, "src", "emu", "machines", "zxNext", "nextRegDescriptors.ts"), "utf8");
  const out = {};
  for (const m of src.matchAll(/id:\s*0x([0-9a-f]+),\s*description:\s*"([^"]+)"/gi)) out[parseInt(m[1], 16)] = m[2];
  return out;
}

const shared = (name) => fs.readFileSync(path.join(__dirname, name), "utf8");

/** Writes `out` from `template`, replacing each key of `values` (functions keep `$` patterns literal) */
function inline(template, out, values) {
  let html = fs.readFileSync(template, "utf8");
  for (const [key, value] of Object.entries(values)) {
    if (!html.includes(key)) throw new Error(`${path.basename(template)} has no ${key}`);
    html = html.replace(key, () => value);
  }
  fs.writeFileSync(out, html);
  console.log("Wrote", out, `(${Math.round(html.length / 1024)} KB)`);
}

module.exports = { romData, sysVars, nextRegNames, shared, inline };
