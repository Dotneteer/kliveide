// Record the OZ source name of every renamed label (z88-label-renames.json) in its synopsis, so the label
// can be found in the OZ source: "OZ source name: AllocMemFile_SizeHL." The note goes after the summary,
// before the numbered steps and the contract; a label without a synopsis gets the note alone. Writes
// z88-oz47-authored.json (a line keeps its provenance; a new one is `source`). Idempotent: a synopsis that
// already has the note is replaced, not noted twice.
//   node dev/ai/rom-annotations/tools/z88-source-name-notes.cjs [--dry-run]
// Run from the repository root after `node dev/scripts/import-oz-source.cjs --all`, then import again.
const fs = require("fs");
const path = require("path");
const root = process.cwd();
const dry = process.argv.includes("--dry-run");
const authoredFile = path.join(root, "dev/ai/rom-annotations/z88-oz47-authored.json");
const renames = JSON.parse(fs.readFileSync(path.join(root, "dev/ai/rom-annotations/z88-label-renames.json"), "utf8")).renames;
const sidecar = JSON.parse(fs.readFileSync(path.join(root, ".local/oz-import/z88v47.rom.dis"), "utf8"));
const authored = JSON.parse(fs.readFileSync(authoredFile, "utf8"));

// --- The new name -> the source name (a key `file:name` names one module's label)
const sourceOf = {};
for (const [key, name] of Object.entries(renames)) {
  if (sourceOf[name]) throw new Error(`${name} is the new name of ${sourceOf[name]} and ${key}`);
  sourceOf[name] = key.includes(":") ? key.slice(key.lastIndexOf(":") + 1) : key;
}

const NOTE = /^OZ source name: .*$/;
const STARTS_CONTRACT = /^(Entry|Exit|Error|Changes|Keeps|Observed):|^\d+\.\s/;
function withNote(synopsis, source) {
  const note = `OZ source name: ${source}.`;
  const lines = (synopsis ?? "").split("\n").filter((l) => !NOTE.test(l));
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length) return note;
  const at = lines.findIndex((l) => STARTS_CONTRACT.test(l));
  if (at < 0) return [...lines, note].join("\n");
  if (at === 0) return [note, ...lines].join("\n");
  return [...lines.slice(0, at), note, ...lines.slice(at)].join("\n");
}

let noted = 0;
let added = 0;
for (const [bankKey, bank] of Object.entries(sidecar.banks)) {
  for (const label of bank.localLabels) {
    const source = sourceOf[label.name];
    if (!source) continue;
    const lines = ((authored.banks[bankKey] ??= {}).lines ??= {});
    const own = lines[label.value];
    const current = own?.synopsis ?? bank.lineAnnotations[label.value]?.synopsis;
    const next = withNote(current, source);
    if (`OZ source name: ${source}.`.length > 92) throw new Error(`${bankKey}:${label.value}: note over 92`);
    if (!current) added++;
    noted++;
    lines[label.value] = { ...(own ?? {}), synopsis: next, provenance: own?.provenance ?? "source" };
  }
}
for (const bank of Object.values(authored.banks)) {
  if (bank.lines) bank.lines = Object.fromEntries(Object.entries(bank.lines).sort((a, b) => Number(a[0]) - Number(b[0])));
}
console.log(`${noted} renamed label(s) noted, ${added} of them had no synopsis${dry ? " (dry run)" : ""}`);
if (!dry) fs.writeFileSync(authoredFile, JSON.stringify(authored, null, 2) + "\n");
