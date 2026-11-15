// A context pack for drafting synopses: every label of the given banks that level 2 still needs one for
// (not a jump label, no synopsis), with its source definition, the routine's source text and its callers.
//   node dev/ai/rom-annotations/tools/z88-synopsis-pack.cjs <bank,bank> <source dirs, comma separated> <out.json>
// Run from the repository root; packs, slices and drafts go in .local/oz-synopses/ (git-ignored).
const fs = require("fs");
const path = require("path");
const root = process.cwd();
const oz = path.join(root, ".local/oz47/oz");
const [banksArg, dirsArg, out] = process.argv.slice(2);
const banks = banksArg.split(",");
const dirs = dirsArg.split(",");
const sidecar = JSON.parse(fs.readFileSync(path.join(root, ".local/oz-import/z88v47.rom.dis"), "utf8"));
const renames = JSON.parse(fs.readFileSync(path.join(root, "dev/ai/rom-annotations/z88-label-renames.json"), "utf8")).renames;
const back = new Map();
for (const [k, v] of Object.entries(renames)) back.set(v, k.includes(":") ? k.split(":").pop() : k);

// --- Every .asm under the component folders, with its rows
const files = [];
for (const d of dirs) {
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.asm$/i.test(e.name)) files.push({ rel: path.relative(oz, p), rows: fs.readFileSync(p, "latin1").split(/\r?\n/) });
    }
  })(path.join(oz, d));
}
// --- Callers across the whole tree (call/extcall/jp Name)
const allRows = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.asm$/i.test(e.name)) {
      fs.readFileSync(p, "latin1").split(/\r?\n/).forEach((r, i) => allRows.push([path.relative(oz, p), i + 1, r]));
    }
  }
})(oz);

const items = [];
for (const bank of banks) {
  const b = sidecar.banks[bank];
  const jump = new Set(sidecar.pages[bank].jumpLabels ?? []);
  const segs = sidecar.pages[bank].segments;
  const codeAt = (o) => b.regions.some((r) => r.type === "disassemble" && o >= r.start && o <= r.end);
  const sorted = [...b.localLabels].sort((x, y) => x.value - y.value);
  for (const l of sorted) {
    if (jump.has(l.value) || b.lineAnnotations[l.value]?.synopsis) continue;
    const seg = segs.filter((s) => s.start <= l.value).pop();
    const address = seg.address !== undefined ? seg.address + l.value - seg.start : seg.segment * 0x4000 + l.value;
    const name = back.get(l.name) ?? l.name;
    const defs = [];
    for (const f of files) {
      f.rows.forEach((row, i) => {
        if (new RegExp(`^\\s*\\.${name}\\b`).test(row)) {
          // --- The routine's text: up to 60 rows, ending before a separator banner after some code
          const text = [];
          for (let k = Math.max(0, i - 12); k < Math.min(f.rows.length, i + 60); k++) text.push(`${k + 1}: ${f.rows[k]}`);
          defs.push({ at: `${f.rel}:${i + 1}`, text: text.join("\n") });
        }
      });
    }
    const callers = allRows
      .filter(([, , r]) => new RegExp(`\\b(call|extcall|jp|jr|defw)\\b[^;]*\\b${name}\\b`, "i").test(r.replace(/;.*/, "")))
      .slice(0, 8)
      .map(([f, n, r]) => `${f}:${n}: ${r.trim()}`);
    items.push({
      key: `${bank}:${l.value}`,
      bank: Number(bank),
      offset: `$${l.value.toString(16).toUpperCase().padStart(4, "0")}`,
      address: `$${address.toString(16).toUpperCase().padStart(4, "0")}`,
      label: l.name,
      sourceName: name,
      kind: codeAt(l.value) ? "code" : "data",
      comment: b.lineAnnotations[l.value]?.comment,
      definitions: defs,
      callers
    });
  }
}
fs.writeFileSync(out, JSON.stringify(items, null, 1));
console.log(`${items.length} labels; ${items.filter((i) => !i.definitions.length).length} without a source definition found`);
