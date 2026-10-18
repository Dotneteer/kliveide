/**
 * Klive's changesets (.plans/RELEASE_AUTOMATION_PLAN.md §3-§4a, .changes/README.md).
 *
 *   npm run change                      create one, asking for each field (in a terminal)
 *   npm run change -- --type fix --issue 1417 --text "..." [--highlight "..."] [--key [summary]]
 *                     [--bump minor] [--slug name]
 *                                       create one without questions (agents, scripts)
 *   npm run change -- --show <file>     print an existing changeset the way `change` does
 *   npm run change:check                validate every pending changeset (part of build:check)
 *   npm run change:status               pending changesets and the next version
 *   npm run change:preview              the CHANGELOG section the next release would get
 *   node scripts/changes.cjs gate --base <ref> [--labels a,b] [--author x] [--head-ref y]
 *                                       the PR gate (.github/workflows/changeset-check.yml)
 *
 * Creating or showing a changeset prints its path, its kind (minor / patch / none) and its
 * content; AI assistants relay exactly that to the user (AGENTS.md, "Changesets").
 */
const { execFileSync } = require("node:child_process");
const { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join, relative, resolve } = require("node:path");
const { randomBytes } = require("node:crypto");
const lib = require("./changes-lib.cjs");

const repoRoot = join(__dirname, "..");
const changesDir = join(repoRoot, ".changes");

function git(args, options = {}) {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], ...options }).trim();
  } catch {
    return "";
  }
}

function packageVersion() {
  return JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).version;
}

/** The newest `vX.Y.Z` tag's version */
function lastRelease() {
  return lib.latestReleaseFromTags(git(["tag", "--list", "v*"]).split("\n").filter(Boolean));
}

/** The pending changeset files (every .md in .changes/ but the README) */
function changesetFiles() {
  if (!existsSync(changesDir)) return [];
  return readdirSync(changesDir)
    .filter((name) => name.endsWith(".md") && name.toLowerCase() !== "readme.md")
    .sort()
    .map((name) => join(changesDir, name));
}

/** When a file was added to git (ms), or now for a file not committed yet */
function addedAt(file) {
  const out = git(["log", "--diff-filter=A", "--follow", "--format=%ct", "--", relative(repoRoot, file)]);
  const last = out.split("\n").filter(Boolean).pop();
  return last ? Number(last) * 1000 : Date.now();
}

function readChangesets({ withDates = false } = {}) {
  return changesetFiles().map((file) => {
    const text = readFileSync(file, "utf8");
    const cs = lib.parseChangeset(text, relative(repoRoot, file));
    if (withDates) cs.addedAt = addedAt(file);
    cs.text = text;
    return cs;
  });
}

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    const name = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[name] = true;
    else {
      out[name] = out[name] !== undefined && name === "issue" ? [].concat(out[name], next) : next;
      i++;
    }
  }
  return out;
}

function issuesFrom(value) {
  if (value === undefined || value === true) return [];
  return []
    .concat(value)
    .flatMap((v) => String(v).split(/[ ,]+/))
    .filter(Boolean)
    .map((v) => Number(v.replace(/^#/, "")));
}

function show(file) {
  const text = readFileSync(file, "utf8");
  const cs = lib.parseChangeset(text, relative(repoRoot, file));
  process.stdout.write(lib.renderChangesetForDisplay(relative(repoRoot, file), text, cs, lastRelease() ?? packageVersion()));
  if (cs.errors.length) {
    console.error(`\nProblems:\n${cs.errors.map((e) => `  - ${e}`).join("\n")}`);
    return false;
  }
  return true;
}

async function ask(questions) {
  const readline = require("node:readline/promises");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answers = {};
  try {
    for (const q of questions) {
      if (q.multiline) {
        console.log(`${q.prompt} (end with an empty line)`);
        const lines = [];
        for (;;) {
          const line = await rl.question("> ");
          if (!line.trim()) break;
          lines.push(line);
        }
        answers[q.name] = lines.join("\n");
      } else {
        answers[q.name] = (await rl.question(`${q.prompt}: `)).trim();
      }
    }
  } finally {
    rl.close();
  }
  return answers;
}

async function create(opts) {
  let { type, text, highlight, key, bump, slug } = opts;
  let issues = issuesFrom(opts.issue ?? opts.issues);
  if (!type && process.stdin.isTTY) {
    const a = await ask([
      { name: "type", prompt: `Type (${lib.TYPES.join(" / ")})` },
      { name: "issues", prompt: "Issue numbers (optional, comma separated)" },
      { name: "text", prompt: "The CHANGELOG entry, in its voice (bold lead-in for a feature)", multiline: true },
      { name: "highlight", prompt: "One-line summary for Highlights (optional)" }
    ]);
    type = a.type;
    issues = issuesFrom(a.issues);
    text = a.text;
    highlight = a.highlight || undefined;
    if (type === "fix") {
      const k = await ask([{ name: "key", prompt: "A key fix? (y / n / a one-line summary)" }]);
      key = /^y(es)?$/i.test(k.key) ? true : /^n(o)?$/i.test(k.key) || !k.key ? undefined : k.key;
    }
  }
  if (!type) {
    console.error("Missing --type. Example: npm run change -- --type fix --issue 1417 --text \"...\"");
    return false;
  }
  if (typeof text !== "string") text = "";
  const content = lib.serializeChangeset({
    type,
    issues,
    bump: typeof bump === "string" ? bump : undefined,
    highlight: typeof highlight === "string" ? highlight : undefined,
    key: key === true ? true : typeof key === "string" ? key : undefined,
    body: text
  });
  const cs = lib.parseChangeset(content);
  if (cs.errors.length) {
    console.error(`Not created:\n${cs.errors.map((e) => `  - ${e}`).join("\n")}`);
    return false;
  }
  mkdirSync(changesDir, { recursive: true });
  const name = `${typeof slug === "string" ? lib.slugFrom(slug) : lib.slugFrom(text, type)}-${randomBytes(2).toString("hex")}.md`;
  const file = join(changesDir, name);
  writeFileSync(file, content);
  return show(file);
}

function check() {
  const all = readChangesets();
  const bad = all.filter((cs) => cs.errors.length);
  for (const cs of bad) {
    console.error(`${cs.file}:\n${cs.errors.map((e) => `  - ${e}`).join("\n")}`);
  }
  if (bad.length) {
    console.error(`\n${bad.length} of ${all.length} changeset(s) are invalid. The format is in .changes/README.md.`);
    return false;
  }
  console.log(`changes: ${all.length} pending changeset(s), all valid`);
  return true;
}

function status() {
  const all = readChangesets();
  const last = lastRelease();
  const pkg = packageVersion();
  console.log(`Last release: ${last ? `v${last}` : "none"}; package.json: ${pkg}`);
  if (!all.length) {
    console.log("No pending changesets.");
    return true;
  }
  for (const cs of all) {
    const kind = cs.errors.length ? "INVALID" : lib.changesetKind(cs, last ?? pkg);
    console.log(`  ${kind.padEnd(7)} ${String(cs.type).padEnd(11)} ${cs.file}`);
  }
  const next = lib.nextVersion({ lastRelease: last, packageVersion: pkg, changesets: all.filter((c) => !c.errors.length) });
  console.log(next ? `Next release: ${next.version} (${next.reason})` : "Nothing here asks for a release (internal only).");
  return all.every((c) => !c.errors.length);
}

function preview() {
  const all = readChangesets({ withDates: true });
  if (!check()) return false;
  const next = lib.nextVersion({ lastRelease: lastRelease(), packageVersion: packageVersion(), changesets: all });
  if (!next) {
    console.log("Nothing here asks for a release (internal only).");
    return true;
  }
  console.log("");
  process.stdout.write(lib.assembleSection({ version: next.version, date: new Date().toISOString().slice(0, 10), changesets: all }));
  return true;
}

function gate(opts) {
  const base = typeof opts.base === "string" ? opts.base : "origin/master";
  const out = git(["diff", "--name-status", "--no-renames", `${base}...HEAD`]);
  const files = out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [statusCode, ...rest] = line.split("\t");
      return { status: statusCode, path: rest.join("\t") };
    });
  const labels = typeof opts.labels === "string" ? opts.labels.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const decision = lib.gateDecision({
    files,
    labels,
    author: typeof opts.author === "string" ? opts.author : "",
    headRef: typeof opts["head-ref"] === "string" ? opts["head-ref"] : ""
  });
  if (decision.ok) {
    console.log(`Changeset gate: OK — ${decision.reason}`);
    return true;
  }
  console.error(`Changeset gate: ${decision.reason}.`);
  console.error(
    [
      "",
      "Add a changeset describing the change for users, for example:",
      '  npm run change -- --type fix --issue 1234 --text "Assembler: what was wrong, in a full sentence."',
      '  npm run change -- --type feature --text "**Feature name:** what it does."',
      '  npm run change -- --type internal        (no user-visible change; no CHANGELOG entry)',
      "or set the 'no-changeset' label on the PR. See .changes/README.md."
    ].join("\n")
  );
  return false;
}

async function main() {
  const [command = "new", ...rest] = process.argv.slice(2);
  const opts = args(command.startsWith("--") ? [command, ...rest] : rest);
  const cmd = command.startsWith("--") ? "new" : command;
  switch (cmd) {
    case "new":
      if (opts.show) return show(resolve(process.cwd(), String(opts.show)));
      return create(opts);
    case "show":
      return show(resolve(process.cwd(), String(opts._[0] ?? "")));
    case "check":
      return check();
    case "status":
      return status();
    case "preview":
      return preview();
    case "gate":
      return gate(opts);
    default:
      console.error(`Unknown command "${cmd}" (new, show, check, status, preview, gate)`);
      return false;
  }
}

if (require.main === module) {
  main().then(
    (ok) => process.exit(ok ? 0 : 1),
    (error) => {
      console.error(error);
      process.exit(1);
    }
  );
}

module.exports = { repoRoot, changesDir, changesetFiles, readChangesets, lastRelease, packageVersion, git };
