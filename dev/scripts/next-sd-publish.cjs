#!/usr/bin/env node
/*
 * Publishes a packed ZX Spectrum Next SD base card on kliveide.net (`dev/plans/NEXT_SD_CARDS_PLAN.md`,
 * phase 3, D-4): commits `.local/next-sd/<setId>.cim.gz` as `next-sd/<setId>.cim.gz` onto the `gh-pages`
 * branch, which GitHub Pages serves at `https://kliveide.net/next-sd/<setId>.cim.gz`.
 *
 *   npm run next-sd:publish -- <setId>            shows what it would push
 *   npm run next-sd:publish -- <setId> --push     pushes it
 *
 * It is a local script, not a workflow: the `.gz` is made once, on the author's machine
 * (`next-sd:pack`), and its bytes are what the manifest's `gzSha256` names; CI cannot remake them.
 *
 * Checks before anything is pushed:
 * - the local `.gz` has the manifest's `gzSize` and `gzSha256`;
 * - the branch has no other bytes under that name (a published card is never rewritten);
 * - the branch would not carry more than five cards (the project author's limit).
 * The commit is made without a checkout (a temporary index over the fetched branch), so the working
 * tree and the current branch are never touched. `deploy-doc.yml` keeps `next-sd/**` on every deploy.
 */
const { execFileSync } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { REPO_ROOT } = require("./repo-root.cjs");
const cards = require("./next-sd/cards.cjs");

const BRANCH = "gh-pages";
const REMOTE = process.env.KLIVE_NEXT_SD_REMOTE || "origin";

function git(args, options = {}) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", ...options }).trim();
}

/** The cards on the fetched branch: name -> blob id */
function publishedCards(ref) {
  const listing = git(["ls-tree", ref, `${cards.PUBLISHED_FOLDER}/`]);
  const result = new Map();
  for (const line of listing.split("\n").filter(Boolean)) {
    const [meta, path] = line.split("\t");
    const blob = meta.split(" ")[2];
    if (path.endsWith(".cim.gz")) result.set(path.substring(cards.PUBLISHED_FOLDER.length + 1), blob);
  }
  return result;
}

/** Makes the commit that adds the card on top of the fetched branch; returns its id, or undefined when it is there */
function makeCommit(setId, gz) {
  git(["fetch", "--depth=1", REMOTE, BRANCH]);
  const head = git(["rev-parse", "FETCH_HEAD"]);
  const name = cards.gzName(setId);
  const blob = git(["hash-object", "-w", gz]);
  const existing = publishedCards(head);
  if (existing.get(name) === blob) return { head, commit: undefined };
  if (existing.has(name)) {
    throw new Error(`${BRANCH} already has other bytes as ${cards.PUBLISHED_FOLDER}/${name}: a published card is never rewritten`);
  }
  if (existing.size >= cards.MAX_PUBLISHED_CARDS) {
    throw new Error(
      `${BRANCH} already carries ${existing.size} cards (${[...existing.keys()].join(", ")}): at most ` +
        `${cards.MAX_PUBLISHED_CARDS}. Retire a model first (D-11).`
    );
  }
  const temp = mkdtempSync(join(tmpdir(), "klive-next-sd-publish-"));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: join(temp, "index") };
    git(["read-tree", head], { env });
    git(["update-index", "--add", "--cacheinfo", `100644,${blob},${cards.PUBLISHED_FOLDER}/${name}`], { env });
    const tree = git(["write-tree"], { env });
    const commit = git(["commit-tree", tree, "-p", head, "-m", `Publish the ${setId} ZX Spectrum Next SD card`]);
    return { head, commit };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const setId = args.find((arg) => !arg.startsWith("-"));
  const push = args.includes("--push");
  if (!setId) {
    console.error("Usage: npm run next-sd:publish -- <setId> [--push]");
    process.exit(2);
  }
  const card = cards.cardOf(setId);
  const gz = cards.localGz(setId);
  if (!(await cards.isPublishedGz(gz, card))) {
    throw new Error(`${gz} is missing or not the manifest's card (${card.gzSize} bytes, ${card.gzSha256}); run npm run next-sd:pack -- ${setId}`);
  }
  for (let attempt = 1; ; attempt++) {
    const { head, commit } = makeCommit(setId, gz);
    if (!commit) {
      console.log(`${setId}: already published on ${BRANCH} (${head.substring(0, 10)}), nothing to do`);
      return;
    }
    if (!push) {
      console.log(`${setId}: would push ${commit.substring(0, 10)} onto ${REMOTE}/${BRANCH} (${head.substring(0, 10)}).`);
      console.log(`Run again with --push to publish ${cards.publishedUrl(setId)}`);
      return;
    }
    try {
      git(["push", REMOTE, `${commit}:refs/heads/${BRANCH}`], { stdio: ["ignore", "pipe", "pipe"] });
      console.log(`${setId}: published (${commit.substring(0, 10)}). Pages serves it at ${cards.publishedUrl(setId)} once its build finishes.`);
      return;
    } catch (err) {
      // --- A docs deploy moved the branch in the meantime: build the commit again on its new head
      if (attempt >= 3) throw err;
      console.log(`${setId}: ${BRANCH} moved, trying again`);
    }
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
