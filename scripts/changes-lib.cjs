/**
 * The pure logic of Klive's changesets and releases (.plans/RELEASE_AUTOMATION_PLAN.md): parsing
 * and validating `.changes/*.md`, the version a set of changesets asks for, assembling a
 * CHANGELOG section, and reading one back. No file system, git or network here; `changes.cjs`
 * and `release.cjs` do the I/O, and the tests call this module directly.
 *
 * A changeset is Markdown with a small front matter block:
 *
 *   ---
 *   type: feature        # feature | fix | breaking | known-issue | internal
 *   issues: [1417]       # optional
 *   bump: minor          # optional; only to force a higher bump than the type implies
 *   highlight: "..."     # optional; a one-line summary proposed for Highlights
 *   key: true            # optional, fixes only; true moves the entry to Key fixes, a string
 *                        # puts that summary in Key fixes and keeps the entry in Fixes
 *   ---
 *
 *   The CHANGELOG entry, without the leading "- ".
 */

const TYPES = ["feature", "fix", "breaking", "known-issue", "internal"];
const BUMPS = ["major", "minor", "patch"];
const KEYS = ["type", "issues", "bump", "highlight", "key"];
const PLURALS = { fix: "fixes", breaking: "breaking changes", "known-issue": "known issues", internal: "internal changes" };
const KIND_RANK = { none: 0, patch: 1, minor: 2, major: 3 };

/** The CHANGELOG sections, in the order a release section lists them */
const SECTIONS = [
  { id: "highlights", title: "Highlights" },
  { id: "keyFixes", title: "Key fixes" },
  { id: "breaking", title: "Breaking changes" },
  { id: "features", title: "Features" },
  { id: "fixes", title: "Fixes" },
  { id: "knownIssues", title: "Known issues" }
];

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;

// ---------------------------------------------------------------------------------------------
// Versions

function parseVersion(version) {
  const m = VERSION_RE.exec(String(version ?? "").trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : undefined;
}

function isPlainVersion(version) {
  return parseVersion(version) !== undefined;
}

function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) throw new Error(`Not a plain x.y.z version: ${!pa ? a : b}`);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

function bumpVersion(version, kind) {
  const p = parseVersion(version);
  if (!p) throw new Error(`Not a plain x.y.z version: ${version}`);
  if (kind === "major") return `${p[0] + 1}.0.0`;
  if (kind === "minor") return `${p[0]}.${p[1] + 1}.0`;
  if (kind === "patch") return `${p[0]}.${p[1]}.${p[2] + 1}`;
  return version;
}

/** The newest plain `vX.Y.Z` tag among `tags`, as a version, or undefined */
function latestReleaseFromTags(tags) {
  let best;
  for (const tag of tags) {
    const version = String(tag).trim().replace(/^v/, "");
    if (!/^v/.test(String(tag).trim()) || !isPlainVersion(version)) continue;
    if (!best || compareVersions(version, best) > 0) best = version;
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Parsing

/** Reads one front matter value: a quoted string, a number list, a boolean, or a bare word */
function parseValue(raw) {
  const text = raw.trim();
  let m = /^"((?:[^"\\]|\\.)*)"\s*(?:#.*)?$/.exec(text);
  if (m) return JSON.parse(`"${m[1]}"`);
  m = /^'((?:[^']|'')*)'\s*(?:#.*)?$/.exec(text);
  if (m) return m[1].replace(/''/g, "'");
  const close = text.startsWith("[") ? text.indexOf("]") : -1;
  const value = close >= 0 ? text.slice(0, close + 1) : text.replace(/\s+#.*$/, "").trim();
  if (value.startsWith("[")) {
    const inner = /^\[(.*)\]$/.exec(value);
    if (!inner) return { invalid: value };
    if (!inner[1].trim()) return [];
    return inner[1].split(",").map((part) => {
      const item = part.trim().replace(/^#/, "");
      return /^\d+$/.test(item) ? Number(item) : { invalid: part.trim() };
    });
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

/**
 * Parses a changeset file. Never throws: problems are returned in `errors`, so a check can
 * report every file at once.
 */
function parseChangeset(text, file = "<changeset>") {
  const errors = [];
  const source = String(text).replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/.exec(source);
  if (!m) {
    return { file, type: undefined, issues: [], body: source.trim(), errors: ["missing the front matter block (--- ... ---) at the top"] };
  }
  const data = {};
  m[1].split("\n").forEach((line, index) => {
    if (!line.trim() || /^\s*#/.test(line)) return;
    const kv = /^([A-Za-z][\w-]*)\s*:(.*)$/.exec(line);
    if (!kv) {
      errors.push(`front matter line ${index + 1} is not "key: value": ${line.trim()}`);
      return;
    }
    if (!KEYS.includes(kv[1])) {
      errors.push(`unknown front matter key "${kv[1]}" (known: ${KEYS.join(", ")})`);
      return;
    }
    data[kv[1]] = parseValue(kv[2]);
  });

  const changeset = {
    file,
    type: data.type,
    issues: [],
    bump: data.bump,
    highlight: data.highlight,
    key: data.key,
    body: m[2].trim(),
    errors
  };

  if (data.issues !== undefined) {
    const list = Array.isArray(data.issues) ? data.issues : [data.issues];
    for (const item of list) {
      if (typeof item === "number" && item > 0) changeset.issues.push(item);
      else errors.push(`issues: "${item?.invalid ?? item}" is not an issue number`);
    }
  }
  validate(changeset);
  return changeset;
}

function validate(cs) {
  const errors = cs.errors;
  if (cs.type === undefined) errors.push(`missing "type" (one of ${TYPES.join(", ")})`);
  else if (!TYPES.includes(cs.type)) errors.push(`type "${cs.type}" is not one of ${TYPES.join(", ")}`);
  if (cs.bump !== undefined && !BUMPS.includes(cs.bump)) {
    errors.push(`bump "${cs.bump}" is not one of ${BUMPS.join(", ")}`);
  }
  if (cs.highlight !== undefined && (typeof cs.highlight !== "string" || !cs.highlight.trim())) {
    errors.push(`highlight must be a non-empty quoted string`);
  }
  if (cs.key !== undefined) {
    if (cs.type !== "fix") errors.push(`key is only for fixes`);
    if (cs.key !== true && cs.key !== false && (typeof cs.key !== "string" || !cs.key.trim())) {
      errors.push(`key must be true, false or a quoted one-line summary`);
    }
  }
  if (cs.type === "internal") {
    for (const name of ["bump", "highlight", "key"]) {
      if (cs[name] !== undefined) errors.push(`${name} has no meaning on an internal changeset`);
    }
  } else if (TYPES.includes(cs.type)) {
    if (!cs.body) errors.push(`the entry text (below the front matter) is empty`);
    if (cs.bump && BUMPS.includes(cs.bump) && KIND_RANK[cs.bump] < KIND_RANK[typeKind(cs.type, true)]) {
      errors.push(`bump "${cs.bump}" is lower than a ${cs.type} implies; bump may only raise it`);
    }
  }
  if (/^#/m.test(cs.body)) errors.push(`the entry must not contain headings; the release assembles them`);
  let inFence = false;
  for (const line of cs.body.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const ticks = (line.match(/`/g) ?? []).length;
    if (ticks % 2) {
      errors.push(`an inline code span is split across lines (the website escapes line by line): ${line.trim()}`);
    }
  }
  if (inFence) errors.push(`a code fence is not closed`);
}

// ---------------------------------------------------------------------------------------------
// Kinds and the next version

/** The bump a type implies on its own. Breaking changes are minor while Klive is 0.x (D6). */
function typeKind(type, major0 = true) {
  switch (type) {
    case "feature":
      return "minor";
    case "fix":
      return "patch";
    case "breaking":
      return major0 ? "minor" : "major";
    default:
      return "none";
  }
}

/** The bump one changeset asks for: its type's, raised by `bump:` */
function changesetKind(cs, currentVersion) {
  const p = parseVersion(currentVersion ?? "0.0.0");
  const major0 = !p || p[0] === 0;
  if (cs.type === "internal" || cs.type === "known-issue") return "none";
  const own = typeKind(cs.type, major0);
  if (cs.bump && KIND_RANK[cs.bump] > KIND_RANK[own]) return cs.bump;
  return own;
}

/**
 * The version a release of `changesets` gets.
 * - `lastRelease`: the newest release tag's version (undefined before the first release)
 * - `packageVersion`: package.json's version; if it is ahead of the last release (pre-bumped,
 *   as 0.64.0 was), it is kept when it is at least the computed version (D2's migration rule)
 * Returns undefined when no changeset asks for a release.
 */
function nextVersion({ lastRelease, packageVersion, changesets }) {
  const base = lastRelease ?? packageVersion;
  let kind = "none";
  const counts = {};
  for (const cs of changesets) {
    const k = changesetKind(cs, base);
    if (KIND_RANK[k] > KIND_RANK[kind]) kind = k;
    if (cs.type) counts[cs.type] = (counts[cs.type] ?? 0) + 1;
  }
  if (kind === "none") return undefined;
  let version = bumpVersion(base, kind);
  let reason = `${kind}: ${Object.entries(counts)
    .map(([type, n]) => `${n} ${n > 1 ? PLURALS[type] ?? `${type}s` : type}`)
    .join(", ")}`;
  if (lastRelease && packageVersion && isPlainVersion(packageVersion)) {
    if (compareVersions(packageVersion, lastRelease) > 0 && compareVersions(packageVersion, version) > 0) {
      reason += `; package.json is already at ${packageVersion}, which is kept`;
      version = packageVersion;
    }
  }
  return { version, kind, reason };
}

// ---------------------------------------------------------------------------------------------
// Assembling a CHANGELOG section

function issueSuffix(text, issues) {
  const missing = issues.filter((n) => !new RegExp(`#${n}\\b`).test(text));
  return missing.length ? ` (${missing.map((n) => `#${n}`).join(", ")})` : "";
}

/** Appends " (#n)" before a final period, the CHANGELOG's way */
function withIssues(text, issues) {
  const suffix = issueSuffix(text, issues);
  if (!suffix) return text;
  return /\.$/.test(text) ? `${text.slice(0, -1)}${suffix}.` : `${text}${suffix}`;
}

const MAX_COLUMNS = 100;

/**
 * Wraps a line longer than MAX_COLUMNS at spaces, never inside an inline code span (the website
 * escapes line by line); continuation lines get `indent`. Shorter lines are left as written.
 */
function wrapLine(line, indent) {
  if (line.length <= MAX_COLUMNS) return [line];
  const lead = /^\s*(?:[-*] )?/.exec(line)[0];
  const words = line.slice(lead.length).match(/(?:`[^`]*`|[^\s`])+/g) ?? [];
  const out = [];
  let current = lead;
  for (const word of words) {
    const prefix = out.length ? indent : lead;
    if (current.length > prefix.length && current.length + 1 + word.length > MAX_COLUMNS) {
      out.push(current);
      current = indent + word;
    } else {
      current += (current.length > prefix.length ? " " : "") + word;
    }
  }
  out.push(current);
  return out;
}

/**
 * One CHANGELOG entry: a bullet whose continuation lines are indented by two spaces. Lines over
 * 100 columns (a one-line highlight, or a line the issue numbers pushed over) are wrapped.
 */
function formatEntry(body, issues = []) {
  const text = withIssues(String(body).trim(), issues);
  const lines = /^[-*] /.test(text)
    ? text.split("\n")
    : text.split("\n").map((line, i) => (i === 0 ? `- ${line}` : line.trim() ? `  ${line}` : ""));
  return lines.flatMap((line) => wrapLine(line, "  ")).join("\n");
}

/** Orders changesets by when they were added (`addedAt`, ms), then by file name */
function orderChangesets(changesets) {
  return [...changesets].sort((a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0) || String(a.file).localeCompare(String(b.file)));
}

/** The section entries of a set of changesets, keyed by section id */
function sectionEntries(changesets) {
  const out = Object.fromEntries(SECTIONS.map((s) => [s.id, []]));
  for (const cs of orderChangesets(changesets)) {
    if (cs.highlight && cs.type !== "internal") out.highlights.push(formatEntry(cs.highlight, cs.issues));
    switch (cs.type) {
      case "feature":
        out.features.push(formatEntry(cs.body, cs.issues));
        break;
      case "breaking":
        out.breaking.push(formatEntry(cs.body, cs.issues));
        break;
      case "known-issue":
        out.knownIssues.push(formatEntry(cs.body, cs.issues));
        break;
      case "fix":
        if (cs.key === true) out.keyFixes.push(formatEntry(cs.body, cs.issues));
        else {
          if (typeof cs.key === "string") out.keyFixes.push(formatEntry(cs.key, cs.issues));
          out.fixes.push(formatEntry(cs.body, cs.issues));
        }
        break;
      default:
        break;
    }
  }
  return out;
}

/** The release section: "## <version> (<date>)" and its non-empty subsections */
function assembleSection({ version, date, changesets }) {
  const entries = sectionEntries(changesets);
  const parts = [date ? `## ${version} (${date})` : `## ${version}`];
  for (const section of SECTIONS) {
    if (!entries[section.id].length) continue;
    parts.push(`### ${section.title}`, entries[section.id].join("\n"));
  }
  return parts.join("\n\n") + "\n";
}

// ---------------------------------------------------------------------------------------------
// Reading and writing CHANGELOG.md

function headingRe(version) {
  return new RegExp(`^## ${version.replace(/\./g, "\\.")}(?:\\s+\\([^)]*\\))?\\s*$`, "m");
}

function hasUnreleased(changelog) {
  return /^## Unreleased\s*$/im.test(changelog);
}

function hasSection(changelog, version) {
  return headingRe(version).test(changelog);
}

/** Inserts a release section above the newest one */
function insertSection(changelog, section, version) {
  if (hasUnreleased(changelog)) {
    throw new Error("CHANGELOG.md still has a '## Unreleased' section; pending changes belong in .changes/");
  }
  if (version && hasSection(changelog, version)) throw new Error(`CHANGELOG.md already has a section for ${version}`);
  const lines = changelog.split("\n");
  const at = lines.findIndex((line) => /^## /.test(line));
  const block = section.trimEnd().split("\n");
  if (at < 0) return `${changelog.trimEnd()}\n\n${block.join("\n")}\n`;
  lines.splice(at, 0, ...block, "");
  return lines.join("\n");
}

/** The body of a release's section (without its heading), or undefined */
function extractSection(changelog, version) {
  const lines = changelog.replace(/\r\n/g, "\n").split("\n");
  const re = headingRe(version);
  const start = lines.findIndex((line) => re.test(line));
  if (start < 0) return undefined;
  let end = lines.findIndex((line, i) => i > start && /^## /.test(line));
  if (end < 0) end = lines.length;
  return lines.slice(start + 1, end).join("\n").trim() + "\n";
}

// ---------------------------------------------------------------------------------------------
// Showing a changeset to the user (§4a)

function describeChangeset(cs, currentVersion) {
  const kind = changesetKind(cs, currentVersion);
  const details = [cs.type ?? "no type", ...cs.issues.map((n) => `#${n}`)].join(", ");
  return { kind, details, headline: `**${kind}** (${details})` };
}

function renderChangesetForDisplay(relPath, text, cs, currentVersion) {
  const { headline } = describeChangeset(cs, currentVersion);
  return `Changeset \`${relPath}\` — ${headline}\n\n\`\`\`markdown\n${text.trimEnd()}\n\`\`\`\n`;
}

/** Writes a new changeset's text */
function serializeChangeset({ type, issues = [], bump, highlight, key, body }) {
  const lines = ["---", `type: ${type}`];
  if (issues.length) lines.push(`issues: [${issues.join(", ")}]`);
  if (bump) lines.push(`bump: ${bump}`);
  if (highlight) lines.push(`highlight: ${JSON.stringify(highlight)}`);
  if (key === true) lines.push("key: true");
  else if (typeof key === "string" && key) lines.push(`key: ${JSON.stringify(key)}`);
  lines.push("---", "");
  if (body && body.trim()) lines.push(body.trim(), "");
  return lines.join("\n");
}

/** A file-name slug from the entry text: a few lower-case words, no Markdown */
function slugFrom(text, fallback = "change") {
  const words = String(text ?? "")
    .replace(/`[^`]*`/g, " ")
    .replace(/[*_[\]()#>:]/g, " ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !["a", "an", "the", "and", "of", "to", "in", "on", "for", "now", "is"].includes(w))
    .slice(0, 5);
  return words.length ? words.join("-") : fallback;
}

// ---------------------------------------------------------------------------------------------
// The PR gate (Phase 2)

const GATE_EXEMPT = [
  /^docs\//,
  /^\.plans\//,
  /^\.ai\//,
  /^\.docs\//,
  /^\.github\//,
  /^\.vscode\//,
  /^\.claude\//,
  /^test\//,
  /^_experiments\//,
  /^_input\//,
  /^i18n-work\//,
  /^\.changes\//,
  /^[^/]+\.md$/
];

/**
 * Whether a PR passes the changeset gate.
 * files: [{ path, status }] where status is git's A/M/D/R...; labels: string[]
 */
function gateDecision({ files, labels = [], author = "", headRef = "" }) {
  if (/^dependabot\[bot\]$/.test(author)) return { ok: true, reason: "Dependabot PR: no changeset needed" };
  if (labels.includes("no-changeset")) return { ok: true, reason: "the no-changeset label is set" };
  if (/^release\/v/.test(headRef)) return { ok: true, reason: "release PR: it consumes changesets" };
  const changesets = files.filter(
    (f) => /^\.changes\/[^/]+\.md$/.test(f.path) && !/README\.md$/i.test(f.path) && /^[AMR]/.test(f.status ?? "A")
  );
  if (changesets.length) {
    return { ok: true, reason: `changeset: ${changesets.map((f) => f.path).join(", ")}` };
  }
  const relevant = files.filter((f) => !GATE_EXEMPT.some((re) => re.test(f.path)));
  if (!relevant.length) return { ok: true, reason: "only docs, plans, tests or CI changed" };
  return {
    ok: false,
    reason: `no changeset, and the PR changes ${relevant.length} file(s) outside docs/plans/tests/CI, e.g. ${relevant
      .slice(0, 5)
      .map((f) => f.path)
      .join(", ")}`
  };
}

// ---------------------------------------------------------------------------------------------
// Landing-page features a release unlocks

function parseFeatures(featuresSource) {
  const out = [];
  const re = /id:\s*"([^"]+)"\s*,\s*since:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(featuresSource))) out.push({ id: m[1], since: m[2] });
  return out;
}

function featureUnlocks(features, { version, lastRelease }) {
  const unlocked = features.filter((f) => isPlainVersion(f.since) && compareVersions(f.since, version) === 0);
  const stale = features.filter(
    (f) =>
      isPlainVersion(f.since) &&
      compareVersions(f.since, version) < 0 &&
      (!lastRelease || compareVersions(f.since, lastRelease) > 0)
  );
  const future = features.filter((f) => isPlainVersion(f.since) && compareVersions(f.since, version) > 0);
  return { unlocked, stale, future };
}

function releasePrBody({ version, lastRelease, section, reason, unlocks, consumed }) {
  const list = (items) => (items.length ? items.map((f) => `\`${f.id}\` (since ${f.since})`).join(", ") : "none");
  return [
    `Release **v${version}**${lastRelease ? ` (previous: v${lastRelease})` : ""}. Version: ${reason}.`,
    "",
    "Merging this PR runs `.github/workflows/release.yml`: it builds the five install kits, tags",
    `\`v${version}\`, publishes the GitHub release with the section below as its notes, and redeploys`,
    "kliveide.net. See `.ai/release-guide.md`.",
    "",
    "## Before merging",
    "",
    "- [ ] Highlights reviewed and edited in `CHANGELOG.md`",
    "- [ ] Release status note in `.plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md` §4 updated to this version",
    "- [ ] README machine table and roadmap reviewed",
    "- [ ] Screenshots refreshed if the UI changed (`npm run doc:shots`)",
    "- [ ] Optional: dry run — run *Release* (`release.yml`) with `dry_run: true` on this branch",
    "",
    "## Landing page",
    "",
    `- Features this release unlocks: ${list(unlocks.unlocked)}`,
    `- Features whose \`since\` lies between the last release and this one (never released — a typo?): ${list(unlocks.stale)}`,
    "",
    `## CHANGELOG section (${consumed} changeset${consumed === 1 ? "" : "s"} consumed)`,
    "",
    section.trim(),
    ""
  ].join("\n");
}

module.exports = {
  TYPES,
  BUMPS,
  SECTIONS,
  parseVersion,
  isPlainVersion,
  compareVersions,
  bumpVersion,
  latestReleaseFromTags,
  parseChangeset,
  typeKind,
  changesetKind,
  nextVersion,
  formatEntry,
  orderChangesets,
  sectionEntries,
  assembleSection,
  hasUnreleased,
  hasSection,
  insertSection,
  extractSection,
  describeChangeset,
  renderChangesetForDisplay,
  serializeChangeset,
  slugFrom,
  gateDecision,
  parseFeatures,
  featureUnlocks,
  releasePrBody
};
