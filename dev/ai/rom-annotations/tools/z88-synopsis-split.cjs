// Split a pack into n slices of consecutive labels (kept in bank/offset order, so a source file stays
// together), and report names defined more than once.
//   node dev/ai/rom-annotations/tools/z88-synopsis-split.cjs <pack.json> <n> <prefix>
// Run from the repository root; packs, slices and drafts go in .local/oz-synopses/ (git-ignored).
const fs = require("fs");
const [packFile, nArg, prefix] = process.argv.slice(2);
const items = JSON.parse(fs.readFileSync(packFile, "utf8"));
const n = Number(nArg);
const size = Math.ceil(items.length / n);
for (let i = 0; i < n; i++) {
  const slice = items.slice(i * size, (i + 1) * size);
  fs.writeFileSync(`${prefix}-${i + 1}.json`, JSON.stringify(slice, null, 1));
  console.log(`${prefix}-${i + 1}.json: ${slice.length} labels, ${slice[0].key} .. ${slice[slice.length - 1].key}, data ${slice.filter((x) => x.kind === "data").length}`);
}
const multi = items.filter((x) => x.definitions.length > 1);
console.log(`${multi.length} names with more than one definition: ${multi.slice(0, 12).map((x) => `${x.label}(${x.definitions.length})`).join(" ")}`);
