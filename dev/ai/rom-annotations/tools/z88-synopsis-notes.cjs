// Collect the helpers' notes of the given drafts as a Markdown section (for the review record).
//   node dev/ai/rom-annotations/tools/z88-synopsis-notes.cjs <title> <draft.json>...
// Run from the repository root; packs, slices and drafts go in .local/oz-synopses/ (git-ignored).
const fs = require("fs");
const [title, ...drafts] = process.argv.slice(2);
const out = [`## ${title}`, ""];
for (const file of drafts) {
  const draft = JSON.parse(fs.readFileSync(file, "utf8"));
  const name = file.split("/").pop().replace(/\.json$/, "");
  for (const note of draft.notes ?? []) out.push(`- (${name}) ${String(note).replace(/\s+/g, " ").trim()}`);
}
console.log(out.join("\n"));
