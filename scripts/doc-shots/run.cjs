/**
 * Regenerates documentation screenshots.
 *
 * Usage: node scripts/doc-shots/run.cjs [recipe ...]     (default: every recipe)
 */
const path = require("path");
const fs = require("fs");
const os = require("os");
const { launchKlive } = require("./harness.cjs");

const RECIPES = path.join(__dirname, "recipes");

(async () => {
  const wanted = process.argv.slice(2);
  const files = fs
    .readdirSync(RECIPES)
    .filter((f) => f.endsWith(".cjs"))
    .filter((f) => !wanted.length || wanted.includes(path.basename(f, ".cjs")));

  if (!files.length) {
    console.error(`No recipes matched ${wanted.join(", ")}`);
    process.exit(1);
  }

  for (const file of files) {
    const recipe = require(path.join(RECIPES, file));
    console.log(`\n▶ ${recipe.name}`);
    const home = fs.mkdtempSync(path.join(os.tmpdir(), `klive-shots-${recipe.name}-`));
    const klive = await launchKlive({ home, ...(recipe.window ?? {}) });
    try {
      await recipe.run(klive, { home });
    } finally {
      await klive.close();
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
  console.log("\nAll recipes done.");
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
