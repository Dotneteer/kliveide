// Merge helper drafts into dev/ai/rom-annotations/z88-oz47-authored.json: each draft's synopses go to
// banks[<bank>].lines[<offset>] with provenance "source" (written from the OZ source, D-OZ1/D-OZ4).
// Checks every draft against its slice first; with --dry-run it only reports.
//   node dev/ai/rom-annotations/tools/z88-synopsis-merge.cjs <slice.json:draft.json>... [--dry-run]
// Run from the repository root; packs, slices and drafts go in .local/oz-synopses/ (git-ignored).
const fs = require("fs");
const path = require("path");
const root = process.cwd();
const authoredFile = path.join(root, "dev/ai/rom-annotations/z88-oz47-authored.json");
const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const authored = JSON.parse(fs.readFileSync(authoredFile, "utf8"));

// --- The house layout: paragraphs (the summary, each numbered step, each contract part) re-wrapped at
// --- 92 columns, so a helper's broken wrap ("one JP per 3\nin") is mended; a contract part ends with "."
const PART = /^(Entry|Exit|Error|Changes|Keeps|Observed):/;
function normalise(text) {
  const paragraphs = [];
  for (const raw of text.trim().split("\n")) {
    const line = raw.trim();
    if (!line) {
      paragraphs.push("");
      continue;
    }
    const starts = PART.test(line) || /^\d+\.\s/.test(line) || !paragraphs.length || paragraphs[paragraphs.length - 1] === "";
    if (starts) paragraphs.push(line);
    else paragraphs[paragraphs.length - 1] += ` ${line}`;
  }
  const out = [];
  for (let p of paragraphs) {
    if (!p) {
      out.push("");
      continue;
    }
    if (PART.test(p) && !/[.!?]$/.test(p)) p += ".";
    let line = "";
    for (const word of p.split(/\s+/)) {
      if (line && line.length + 1 + word.length > 92) {
        out.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    out.push(line);
  }
  return out.join("\n");
}
let written = 0;
const problems = [];
for (const pair of args.filter((a) => a !== "--dry-run")) {
  const [sliceFile, draftFile] = pair.split(":");
  const slice = JSON.parse(fs.readFileSync(sliceFile, "utf8"));
  if (!fs.existsSync(draftFile)) {
    problems.push(`${draftFile}: missing`);
    continue;
  }
  const draft = JSON.parse(fs.readFileSync(draftFile, "utf8"));
  const keys = new Set(slice.map((x) => x.key));
  const synopses = draft.synopses ?? {};
  for (const k of keys) if (!synopses[k]?.trim()) problems.push(`${draftFile}: no synopsis for ${k}`);
  for (const [k, text] of Object.entries(synopses)) {
    if (!keys.has(k)) {
      problems.push(`${draftFile}: ${k} is not in the slice`);
      continue;
    }
    const long = text.split("\n").filter((l) => l.length > 92);
    if (long.length) problems.push(`${draftFile}: ${k} has ${long.length} line(s) over 92 characters`);
    if (/—/.test(text)) problems.push(`${draftFile}: ${k} has an em dash`);
    const [bank, offset] = k.split(":");
    const b = (authored.banks[bank] ??= {});
    (b.lines ??= {})[offset] = { synopsis: normalise(text), provenance: "source" };
    written++;
  }
}
// --- Lines sorted by offset, for a readable diff
for (const b of Object.values(authored.banks)) {
  if (b.lines) b.lines = Object.fromEntries(Object.entries(b.lines).sort((x, y) => Number(x[0]) - Number(y[0])));
}
console.log(problems.length ? problems.join("\n") : "no problems");
console.log(`${written} synopses${dry ? " checked (dry run)" : " merged"}`);
if (!dry && !problems.some((p) => /missing|not in the slice/.test(p))) {
  fs.writeFileSync(authoredFile, JSON.stringify(authored, null, 2) + "\n");
}
