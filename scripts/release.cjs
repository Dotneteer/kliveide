/**
 * Klive's release steps (.plans/RELEASE_AUTOMATION_PLAN.md §5, .ai/release-guide.md).
 *
 *   npm run release:prepare [-- --version x.y.z] [--dry-run] [--skip-tests] [--no-push]
 *       Step A, on an up-to-date master: computes the version from .changes/, writes the
 *       CHANGELOG section, consumes the changesets, bumps package.json, runs every gate (the fast
 *       test tiers; it only warns when the slow tier has not passed on these sources), commits
 *       "Release v<version>" on release/v<version>, pushes it and opens the release PR.
 *   npm run release:verify [-- --version x.y.z]
 *       The checks that must hold on a release commit; the release workflow's first job.
 *   node scripts/release.cjs publish --dir <kits> [--target <sha>] [--dry-run]
 *       Checks the kit set, writes SHA256SUMS.txt, creates the tag and the GitHub release with
 *       the CHANGELOG section as notes, uploads the kits and publishes it. Idempotent.
 *   node scripts/release.cjs smoke [--version x.y.z]
 *       Checks kliveide.net shows the release's download links and every kit downloads.
 *   node scripts/release.cjs notes [--version x.y.z]
 *       Prints a release's CHANGELOG section.
 */
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { readFileSync, readdirSync, statSync, writeFileSync, appendFileSync, mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { basename, join, relative, resolve } = require("node:path");
const lib = require("./changes-lib.cjs");
const assets = require("./release-assets.cjs");
const changes = require("./changes.cjs");

const repoRoot = changes.repoRoot;
const changelogPath = join(repoRoot, "CHANGELOG.md");
const SITE = "https://kliveide.net/";

// ---------------------------------------------------------------------------------------------
// Helpers

class ReleaseError extends Error {}

function fail(message) {
  throw new ReleaseError(message);
}

function run(cmd, args, { capture = false, allowFail = false } = {}) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: process.platform === "win32"
  });
  if (result.status !== 0 && !allowFail) {
    fail(`'${cmd} ${args.join(" ")}' failed${capture && result.stderr ? `:\n${result.stderr.trim()}` : ""}`);
  }
  return { ok: result.status === 0, out: (result.stdout ?? "").trim(), err: (result.stderr ?? "").trim() };
}

const git = (...args) => run("git", args, { capture: true }).out;
const gitOk = (...args) => run("git", args, { capture: true, allowFail: true });

function hasGh() {
  return run("gh", ["--version"], { capture: true, allowFail: true }).ok;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[a.slice(2)] = true;
    else {
      out[a.slice(2)] = next;
      i++;
    }
  }
  return out;
}

function step(message) {
  console.log(`\n▶ ${message}`);
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function tagExists(tag, { remote = true } = {}) {
  if (git("tag", "--list", tag)) return true;
  if (!remote) return false;
  const r = gitOk("ls-remote", "--tags", "origin", `refs/tags/${tag}`);
  return r.ok && r.out.length > 0;
}

// ---------------------------------------------------------------------------------------------
// verify

/** The checks a release commit must pass. Returns the problems found. */
function releaseProblems(version, { remote = true } = {}) {
  const problems = [];
  if (!lib.isPlainVersion(version)) {
    problems.push(`version "${version}" is not a plain x.y.z version (Klive has no pre-releases, D13)`);
    return problems;
  }
  const last = changes.lastRelease();
  if (last && lib.compareVersions(version, last) <= 0) problems.push(`version ${version} is not above the last release v${last}`);
  if (tagExists(`v${version}`, { remote })) problems.push(`tag v${version} already exists`);
  const changelog = readFileSync(changelogPath, "utf8");
  if (lib.hasUnreleased(changelog)) problems.push("CHANGELOG.md has a '## Unreleased' section");
  if (!lib.hasSection(changelog, version)) problems.push(`CHANGELOG.md has no '## ${version}' section`);
  const pending = changes.readChangesets();
  if (pending.length) problems.push(`.changes/ still holds ${pending.length} changeset(s): ${pending.map((c) => c.file).join(", ")}`);
  const pkg = changes.packageVersion();
  if (pkg !== version) problems.push(`package.json says ${pkg}, not ${version}`);
  const lock = JSON.parse(readFileSync(join(repoRoot, "package-lock.json"), "utf8"));
  if (lock.version !== version || lock.packages?.[""]?.version !== version) {
    problems.push(`package-lock.json is not at ${version} (run npm install --package-lock-only)`);
  }
  return problems;
}

function verify(opts) {
  const version = typeof opts.version === "string" ? opts.version : changes.packageVersion();
  const problems = releaseProblems(version, { remote: !opts.local });
  if (problems.length) {
    console.error(`Not a releasable commit for v${version}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    return false;
  }
  console.log(`release:verify: v${version} is ready to release`);
  setOutput("version", version);
  setOutput("tag", `v${version}`);
  return true;
}

// ---------------------------------------------------------------------------------------------
// prepare

function prepare(opts) {
  const dry = !!opts["dry-run"];
  const warnOrFail = (ok, message) => {
    if (ok) return;
    if (dry) console.warn(`(dry run) would stop here: ${message}`);
    else fail(message);
  };

  step("Preflight");
  // --- `next build` rewrites docs/next-env.d.ts on every docs build, so it is not a reason to stop
  const dirty = git("status", "--porcelain")
    .split("\n")
    .filter((line) => line && !line.endsWith("docs/next-env.d.ts"))
    .join("\n");
  warnOrFail(!dirty, `the working tree is not clean:\n${dirty}`);
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  warnOrFail(branch === "master", `releases are prepared on master, not ${branch}`);
  if (!dry) {
    run("git", ["fetch", "origin", "master", "--tags"], { capture: true });
    warnOrFail(git("rev-parse", "HEAD") === git("rev-parse", "origin/master"), "master is not level with origin/master (pull first)");
  }
  const pending = changes.readChangesets({ withDates: true });
  const invalid = pending.filter((c) => c.errors.length);
  if (invalid.length) fail(`invalid changesets (npm run change:check):\n${invalid.map((c) => `  ${c.file}: ${c.errors.join("; ")}`).join("\n")}`);
  const last = changes.lastRelease();
  const pkg = changes.packageVersion();
  let next = lib.nextVersion({ lastRelease: last, packageVersion: pkg, changesets: pending });
  if (typeof opts.version === "string") {
    next = { version: opts.version, kind: next?.kind ?? "none", reason: `set with --version (changesets ask for ${next?.version ?? "nothing"})` };
  }
  if (!next) fail("no pending changeset asks for a release (only internal changes, or none)");
  const { version, reason } = next;
  if (!lib.isPlainVersion(version)) fail(`"${version}" is not a plain x.y.z version`);
  if (last && lib.compareVersions(version, last) <= 0) fail(`${version} is not above the last release v${last}`);
  if (tagExists(`v${version}`, { remote: !dry })) fail(`tag v${version} already exists`);
  const changelog = readFileSync(changelogPath, "utf8");
  if (lib.hasUnreleased(changelog)) fail("CHANGELOG.md has a '## Unreleased' section; move its entries into .changes/ first");
  if (lib.hasSection(changelog, version)) fail(`CHANGELOG.md already has a section for ${version}`);
  if (!dry && !opts["no-push"]) {
    if (!hasGh()) fail("the GitHub CLI (gh) is needed to open the release PR (or pass --no-push)");
    run("gh", ["auth", "status"], { capture: true });
  }
  console.log(`Release v${version} (last release: ${last ? `v${last}` : "none"}; ${reason})`);

  const section = lib.assembleSection({ version, date: today(), changesets: pending });
  const unlocks = lib.featureUnlocks(lib.parseFeatures(readFileSync(join(repoRoot, "docs/landing/features.ts"), "utf8")), {
    version,
    lastRelease: last
  });
  const body = lib.releasePrBody({ version, lastRelease: last, section, reason, unlocks, consumed: pending.length });

  // --- The slow test tier is never a release gate; a stale one is worth a warning, not a stop
  // --- (.plans/FAST_SLOW_TEST_TIERS_PLAN.md D3).
  if (!run("node", ["scripts/run-tests.cjs", "--slow-status"], { allowFail: true }).ok) {
    console.warn(
      "Warning: the slow test tier has not passed on these sources. The release runs only the fast tiers;\n" +
        "run `npm run test:slow` (or the \"Slow tests\" workflow) first unless you have a reason not to."
    );
  }

  if (dry) {
    console.log(`\n--- CHANGELOG section ---\n\n${section}\n--- PR body ---\n\n${body}`);
    console.log(`(dry run) would consume ${pending.length} changeset(s), set package.json to ${version}, run the gates and open the PR.`);
    return true;
  }

  const releaseBranch = `release/v${version}`;
  step(`Branch ${releaseBranch}`);
  run("git", ["switch", "-c", releaseBranch]);

  step("CHANGELOG.md, .changes/, package.json");
  writeFileSync(changelogPath, lib.insertSection(changelog, section, version));
  for (const cs of pending) run("git", ["rm", "--quiet", cs.file]);
  if (pkg !== version) run("npm", ["version", version, "--no-git-tag-version", "--allow-same-version"]);

  step("Gates");
  const gates = [
    ["npm", ["run", "build:check"]],
    ["npm", ["run", "lint:renderer"]],
    // --- The fast tiers only: the slow one is run before release:prepare, not by it
    ...(opts["skip-tests"] ? [] : [["npm", ["run", "test:fast"]]]),
    ["npm", ["run", "doc:build"]],
    ["npm", ["run", "doc:check"]],
    ["node", ["scripts/release.cjs", "verify", "--local"]]
  ];
  for (const [cmd, a] of gates) {
    console.log(`\n$ ${cmd} ${a.join(" ")}`);
    const r = run(cmd, a, { allowFail: true });
    if (!r.ok) {
      fail(
        `'${cmd} ${a.join(" ")}' failed. The release changes are uncommitted on ${releaseBranch}.\n` +
          `Fix the problem on master in a normal PR, then: git switch master && git branch -D ${releaseBranch} && git checkout -- . && npm run release:prepare`
      );
    }
  }

  step("Commit");
  run("git", ["add", "CHANGELOG.md", "package.json", "package-lock.json", ".changes"]);
  run("git", ["commit", "-m", `Release v${version}`]);
  if (opts["no-push"]) {
    console.log(`\nCommitted on ${releaseBranch}; not pushed (--no-push). PR body:\n\n${body}`);
    return true;
  }

  step("Push and open the PR");
  run("git", ["push", "-u", "origin", releaseBranch]);
  const bodyFile = join(mkdtempSync(join(tmpdir(), "klive-release-")), "body.md");
  writeFileSync(bodyFile, body);
  run("gh", ["pr", "create", "--base", "master", "--head", releaseBranch, "--title", `Release v${version}`, "--body-file", bodyFile]);
  console.log(`\nRelease PR opened. Review the CHANGELOG (Highlights!), then merge it to release v${version}.`);
  return true;
}

// ---------------------------------------------------------------------------------------------
// publish

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function publish(opts) {
  const dry = !!opts["dry-run"];
  const version = typeof opts.version === "string" ? opts.version : changes.packageVersion();
  const tag = `v${version}`;
  if (typeof opts.dir !== "string") fail("--dir <folder with the downloaded kits> is required");
  const dir = resolve(process.cwd(), opts.dir);

  step(`Kits in ${relative(process.cwd(), dir) || "."}`);
  const files = listFiles(dir).filter((f) => basename(f) !== assets.CHECKSUMS_FILE);
  const names = files.map((f) => basename(f));
  const { missing, unexpected } = assets.compareAssets(names, version);
  if (missing.length || unexpected.length) {
    fail(`the kit set is wrong.\n  missing: ${missing.join(", ") || "none"}\n  unexpected: ${unexpected.join(", ") || "none"}`);
  }
  const ordered = assets.expectedAssets(version).map((n) => files.find((f) => basename(f) === n));
  const checksumsPath = join(dir, assets.CHECKSUMS_FILE);
  writeFileSync(checksumsPath, ordered.map((f) => `${sha256(f)}  ${basename(f)}`).join("\n") + "\n");
  console.log(readFileSync(checksumsPath, "utf8"));

  const notes = lib.extractSection(readFileSync(changelogPath, "utf8"), version);
  if (!notes) fail(`CHANGELOG.md has no section for ${version}`);
  const notesPath = typeof opts["notes-out"] === "string" ? resolve(opts["notes-out"]) : join(dir, "..", "release-notes.md");
  writeFileSync(notesPath, notes);
  const uploads = [...ordered, checksumsPath];
  const target = typeof opts.target === "string" ? opts.target : git("rev-parse", "HEAD");

  if (dry) {
    console.log(`--- Release notes (${notesPath}) ---\n\n${notes}`);
    console.log(
      `(dry run) would run: gh release create ${tag} --draft --title ${tag} --target ${target} --notes-file ${notesPath} ${uploads
        .map((f) => basename(f))
        .join(" ")}\n(dry run) then publish it as the latest release.`
    );
    return true;
  }

  step(`GitHub release ${tag}`);
  const existing = run("gh", ["release", "view", tag, "--json", "isDraft"], { capture: true, allowFail: true });
  if (existing.ok && JSON.parse(existing.out).isDraft === false) {
    console.log(`${tag} is already published; nothing to do.`);
    return true;
  }
  if (existing.ok) {
    console.log(`Resuming the existing draft ${tag}.`);
    run("gh", ["release", "edit", tag, "--title", tag, "--notes-file", notesPath, "--target", target]);
    run("gh", ["release", "upload", tag, "--clobber", ...uploads]);
  } else {
    run("gh", ["release", "create", tag, "--draft", "--title", tag, "--target", target, "--notes-file", notesPath, ...uploads]);
  }

  // --- Check what GitHub holds before anyone can see it
  const view = JSON.parse(run("gh", ["release", "view", tag, "--json", "assets"], { capture: true }).out);
  const held = assets.compareAssets(view.assets.map((a) => a.name), version, { withChecksums: true });
  if (held.missing.length || held.unexpected.length) {
    fail(`the draft's assets are wrong (missing: ${held.missing.join(", ") || "none"}; unexpected: ${held.unexpected.join(", ") || "none"})`);
  }

  run("gh", ["release", "edit", tag, "--draft=false", "--latest"]);
  console.log(`Published ${tag}: https://github.com/${assets.REPO}/releases/tag/${tag}`);
  return true;
}

// ---------------------------------------------------------------------------------------------
// smoke

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function smoke(opts) {
  const version = typeof opts.version === "string" ? opts.version : changes.packageVersion();
  const tag = `v${version}`;
  const tries = Number(opts.tries ?? 12);
  const wait = Number(opts.wait ?? 30) * 1000;
  const wanted = assets.expectedAssets(version).map((n) => `releases/download/${tag}/${n}`);

  step(`${SITE} shows ${tag}`);
  let missing = wanted;
  for (let i = 1; i <= tries; i++) {
    try {
      const html = await (await fetch(`${SITE}?release-smoke=${Date.now()}`, { signal: AbortSignal.timeout(20000) })).text();
      missing = wanted.filter((w) => !html.includes(w));
      if (!missing.length) break;
    } catch (error) {
      console.warn(`  attempt ${i}: ${error.message}`);
    }
    if (i < tries) {
      console.log(`  attempt ${i}: ${missing.length} download link(s) not on the page yet; retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  if (missing.length) fail(`the landing page does not link: ${missing.join(", ")}`);
  console.log("  every download link is on the landing page");

  step("Every kit downloads");
  const bad = [];
  for (const name of [...assets.expectedAssets(version), assets.CHECKSUMS_FILE]) {
    const url = assets.downloadUrl(tag, name);
    try {
      const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(30000) });
      console.log(`  ${res.status} ${name}`);
      if (!res.ok) bad.push(`${name} (${res.status})`);
    } catch (error) {
      bad.push(`${name} (${error.message})`);
    }
  }
  if (bad.length) fail(`kits that do not download: ${bad.join(", ")}`);
  return true;
}

function notes(opts) {
  const version = typeof opts.version === "string" ? opts.version : changes.packageVersion();
  const text = lib.extractSection(readFileSync(changelogPath, "utf8"), version);
  if (!text) fail(`CHANGELOG.md has no section for ${version}`);
  process.stdout.write(text);
  return true;
}

// ---------------------------------------------------------------------------------------------

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const opts = args(rest);
  switch (command) {
    case "prepare":
      return prepare(opts);
    case "verify":
      return verify(opts);
    case "publish":
      return publish(opts);
    case "smoke":
      return smoke(opts);
    case "notes":
      return notes(opts);
    default:
      console.error("Usage: node scripts/release.cjs <prepare | verify | publish | smoke | notes> [options]");
      return false;
  }
}

if (require.main === module) {
  main().then(
    (ok) => process.exit(ok ? 0 : 1),
    (error) => {
      console.error(error instanceof ReleaseError ? `\nrelease: ${error.message}` : error);
      process.exit(1);
    }
  );
}

module.exports = { releaseProblems };
