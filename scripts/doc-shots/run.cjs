/**
 * Regenerates documentation screenshots.
 *
 * Usage: node scripts/doc-shots/run.cjs [recipe ...] [--lang <id>|all]
 *        (default: every recipe, in English)
 *
 * A recipe that exports `localized: true` runs once per language given by `--lang`; its shots go
 * to `images/<lang>/...`. Other recipes ignore `--lang` and run once.
 */
const path = require("path");
const fs = require("fs");
const os = require("os");
const { launchKlive, enabledLanguages } = require("./harness.cjs");

const RECIPES = path.join(__dirname, "recipes");

(async () => {
  const args = process.argv.slice(2);
  const langAt = args.indexOf("--lang");
  let langs = ["en"];
  if (langAt >= 0) {
    const value = args.splice(langAt, 2)[1];
    langs = value === "all" ? enabledLanguages() : value.split(",");
  }
  const wanted = args;
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
    for (const lang of recipe.localized ? langs : [undefined]) {
      console.log(`\n▶ ${recipe.name}${lang ? ` [${lang}]` : ""}`);
      const home = fs.mkdtempSync(path.join(os.tmpdir(), `klive-shots-${recipe.name}-`));
      const klive = await launchKlive({ home, lang, ...(recipe.window ?? {}) });
      try {
        await recipe.run(klive, { home, lang: lang ?? "en" });
      } finally {
        await klive.close();
        fs.rmSync(home, { recursive: true, force: true });
      }
    }
  }
  console.log("\nAll recipes done.");
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
