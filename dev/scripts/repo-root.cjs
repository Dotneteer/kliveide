/**
 * The repository root, for every script that needs a path outside its own folder.
 *
 * Scripts used to compute it as "one level above `__dirname`", which silently breaks when a script moves
 * to another depth (`dev/plans/ROOT_DECLUTTER_PLAN.md`, step 10). This walks up from this file to the
 * first folder whose `package.json` is Klive's own (`docs/package.json` belongs to the docs site and
 * never matches), so it is right wherever the scripts folder lives.
 *
 * Paths inside the scripts folder itself (a recipe's fixtures, a sibling module) stay relative to
 * `__dirname`: they move with the folder.
 */
const { existsSync, readFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const PACKAGE_NAME = "klive-ide";

function findRepoRoot(start = __dirname) {
  let folder = start;
  for (;;) {
    const pkg = join(folder, "package.json");
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, "utf8")).name === PACKAGE_NAME) return folder;
      } catch {
        // --- not a readable package.json: keep walking
      }
    }
    const parent = dirname(folder);
    if (parent === folder) throw new Error(`repo-root: no ${PACKAGE_NAME} package.json above ${start}`);
    folder = parent;
  }
}

const REPO_ROOT = findRepoRoot();

module.exports = { REPO_ROOT, findRepoRoot };
