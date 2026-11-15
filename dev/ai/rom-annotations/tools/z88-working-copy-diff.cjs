// What a working copy has that a new import does not, or the other way round: labels, line annotations,
// bank settings, page entries and top-level keys that differ. Regions and jumpLabels are left out: the IDE
// re-saves a working copy with merged code regions, which is not a content change.
//   node dev/ai/rom-annotations/tools/z88-working-copy-diff.cjs <old.dis> <new.dis>
const fs = require("fs");
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
const out = [];
for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
  if (["banks", "pages", "provenance"].includes(k)) continue;
  if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(`top ${k}: ${JSON.stringify(a[k])} -> ${JSON.stringify(b[k])}`);
}
for (const bank of new Set([...Object.keys(a.banks), ...Object.keys(b.banks)])) {
  const x = a.banks[bank] ?? {};
  const y = b.banks[bank] ?? {};
  for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) {
    if (["regions", "localLabels", "lineAnnotations"].includes(key)) continue;
    if (JSON.stringify(x[key]) !== JSON.stringify(y[key])) out.push(`bank ${bank} ${key}: ${JSON.stringify(x[key])} -> ${JSON.stringify(y[key])}`);
  }
  const lx = new Map((x.localLabels ?? []).map((l) => [l.value, l.name]));
  const ly = new Map((y.localLabels ?? []).map((l) => [l.value, l.name]));
  for (const v of new Set([...lx.keys(), ...ly.keys()])) {
    if (lx.get(v) !== ly.get(v)) out.push(`bank ${bank} label $${v.toString(16)}: ${lx.get(v)} -> ${ly.get(v)}`);
  }
  const ax = x.lineAnnotations ?? {};
  const ay = y.lineAnnotations ?? {};
  for (const o of new Set([...Object.keys(ax), ...Object.keys(ay)])) {
    if (JSON.stringify(ax[o]) !== JSON.stringify(ay[o])) {
      out.push(`bank ${bank} line $${Number(o).toString(16)}: ${JSON.stringify(ax[o])} -> ${JSON.stringify(ay[o])}`);
    }
  }
}
for (const p of new Set([...Object.keys(a.pages ?? {}), ...Object.keys(b.pages ?? {})])) {
  const { jumpLabels: _a, ...pa } = a.pages?.[p] ?? {};
  const { jumpLabels: _b, ...pb } = b.pages?.[p] ?? {};
  if (JSON.stringify(pa) !== JSON.stringify(pb)) out.push(`page ${p}: ${JSON.stringify(pa)} -> ${JSON.stringify(pb)}`);
}
console.log(out.length ? out.slice(0, 60).join("\n") : "no differences");
console.log(`${out.length} difference(s)`);
