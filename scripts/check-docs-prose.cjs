/**
 * Reports the wording habits that make a documentation page read as machine-written
 * (step 4 of .plans/HALLMARK_SITE_POLISH_PLAN.md, H4): buzzwords, filler, em and en dashes,
 * middle-dot meta strings and arrows glued to link text. The list is Klive's own, written for
 * documentation and informed by Hallmark's copy rule (19) and punctuation rule (63).
 *
 * Only Klive's own pages are read: get-started, guides, reference and under-the-hood. The Library's
 * imported manuals keep their makers' wording, and the unlinked book is out of scope (H6). Code -
 * fenced blocks, inline code, link targets - is never read.
 *
 * It reports; a person decides. "just" is often right ("just after the interrupt"), so the common
 * temporal and positional uses are not reported, and a line that should stay as it is carries a
 * marker on itself or the line above: `{/* prose-ok: <why> *\/}`.
 *
 * Usage:
 *   node scripts/check-docs-prose.cjs                 every finding, then the counts
 *   node scripts/check-docs-prose.cjs --summary       the counts only, per area and per rule
 *   node scripts/check-docs-prose.cjs --area guides   one navbar area
 *   node scripts/check-docs-prose.cjs --rule dash     one rule
 *   node scripts/check-docs-prose.cjs --strict        exit 1 when anything is reported (for doc:check)
 */
const { readdirSync, readFileSync, existsSync } = require("node:fs");
const { join, relative, sep } = require("node:path");

const repoRoot = join(__dirname, "..");
const contentDir = join(repoRoot, "docs", "content", "en");
const AREAS = ["get-started", "guides", "reference", "under-the-hood"];
// --- Generated at build time from CHANGELOG.md (git-ignored): its wording is the changesets'
const GENERATED = new Set(["reference/whats-new.mdx"]);

const word = (alternatives) => new RegExp(`\\b(?:${alternatives})\\b`, "gi");

const RULES = [
  {
    id: "buzzword",
    why: "say what it does, in its own nouns",
    re: word(
      [
        "seamless(?:ly)?", "robust", "powerful", "unlock(?:s|ed|ing)?", "leverag(?:e|es|ed|ing)",
        "effortless(?:ly)?", "empower(?:s|ed|ing)?", "supercharg(?:e|es|ed|ing)", "unleash(?:es|ed|ing)?",
        "cutting-edge", "world-class", "best-in-class", "state-of-the-art", "next-generation",
        "game-chang(?:er|ing)", "blazing(?:ly)? fast"
      ].join("|")
    )
  },
  {
    id: "filler",
    why: "cut it; the sentence works without it",
    // --- "Note that" and "Whether you" only open a sentence ("a note that...", "depends on whether you")
    re: /\b(?:dive into|deep dive|it['’]s worth noting|in order to)\b|(?<![\w,]\s)\b(?:note that|whether you)\b/gi
  },
  {
    // --- Under the Hood's playful voice keeps them where they carry it ("The Next simply shrugs");
    // --- its padding ones were cut in step 4's second batch, by the author's decision
    id: "softener",
    why: "cut it, unless it carries the meaning",
    notIn: ["under-the-hood"],
    re: /\b(?:simply|easily)\b/gi
  },
  {
    // --- Under the Hood speaks to the reader on purpose, "let's" for a worked example included: the
    // --- project author asked for that voice (.ai/hardware-articles-guide.md, "Wording rules")
    id: "lets",
    why: "say it directly",
    notIn: ["under-the-hood"],
    re: /\blet['’]s\b/gi
  },
  {
    id: "just",
    why: "cut it, unless it means exactly or only",
    notIn: ["under-the-hood"],
    // --- Not "Just My Code" (a setting), "not just" (not only), "has just drawn" (a moment ago), nor
    // --- "just after", "just left of" and the other exact positions and times
    re: /(?<!\b(?:not|has|have|had|was|were|is|are)\s)\bjust\b(?!\s+(?:My Code|after|before|as|like|enough|below|above|once|the same|one|two|a few|a single|in time|beyond|past|under|over|outside|inside|behind|ahead|left|right|where|when|what|how|that|this|these|those)\b)/gi
  },
  {
    id: "dash",
    why: "a colon, a comma, a full stop or brackets",
    // --- An en dash with no space on either side is a range (1–3, `$4000`–`$FFFF`, A–Z) and stays
    re: /—|&mdash;|\s&ndash;|&ndash;\s|\s–|–\s/g
  },
  {
    id: "dots",
    why: "a list, a table or a sentence instead of A · B · C",
    re: /\S+(?: · \S+){2,}/g
  },
  {
    id: "arrow-link",
    why: "a verb as the link text, no arrow",
    re: /\[[^\]]*(?:→|->)\s*\]|\]\([^)]*\)\s*(?:→|->)|(?:→|->)\s*\[[^\]]*\]\(/g
  }
];

/** The page's text with everything that is not prose blanked out, keeping line and column numbers */
function proseOf(source) {
  const blank = (s) => s.replace(/[^\n]/g, " ");
  let text = source;
  // --- Front matter: keep only the description's value
  text = text.replace(/^---\n[\s\S]*?\n---\n/, (fm) =>
    fm.split("\n").map((l) => (/^description:/.test(l) ? l.replace(/^description:/, " ".repeat(12)) : blank(l))).join("\n")
  );
  // --- Fenced code blocks (``` and ~~~), JSX/HTML comments, import/export lines
  text = text.replace(/^([ \t]*)(```+|~~~+)[^\n]*\n[\s\S]*?^\1\2[ \t]*$/gm, blank);
  text = text.replace(/\{\/\*[\s\S]*?\*\/\}|<!--[\s\S]*?-->/g, (m) => (/prose-ok/.test(m) ? m : blank(m)));
  text = text.replace(/^(?:import|export)\s[^\n]*$/gm, blank);
  // --- Inline code, link and image targets, bare URLs, HTML/JSX attributes other than alt/caption/title
  // --- (the backticks stay, so a range between two code spans still reads as one; a span may wrap)
  text = text.replace(/`[^`]+`/g, (m) => "`" + blank(m.slice(1, -1)) + "`");
  text = text.replace(/\]\(([^)\s]*)(\s+"[^"]*")?\)/g, (m) => "](" + blank(m.slice(2, -1)) + ")");
  text = text.replace(/https?:\/\/\S+/g, blank);
  // --- A table cell that holds only a dash means "none" or "not applicable"
  text = text.replace(/(?<=\|)[ \t]*(?:—|–|&mdash;|&ndash;|-)[ \t]*(?=\|)/g, blank);
  text = text.replace(/\s(?!alt=|caption=|title=)[\w-]+=(?:"[^"]*"|\{[^}]*\})/g, blank);
  return text;
}

/** The findings of one page: { line, column, rule, match, text }; `area` drops the rules it is exempt from */
function proseFindings(source, area) {
  const lines = proseOf(source).split("\n");
  const original = source.split("\n");
  const findings = [];
  lines.forEach((line, i) => {
    if (/prose-ok/.test(line) || /prose-ok/.test(lines[i - 1] ?? "")) return;
    for (const rule of RULES) {
      if (area && rule.notIn?.includes(area)) continue;
      for (const m of line.matchAll(rule.re)) {
        // --- Shown as the page has it (link targets were blanked), without the spaces a rule needed
        const raw = original[i].slice(m.index, m.index + m[0].length);
        const lead = raw.length - raw.trimStart().length;
        findings.push({ line: i + 1, column: m.index + lead + 1, rule: rule.id, match: raw.trim(), text: original[i].trim() });
      }
    }
  });
  return findings.sort((x, y) => x.line - y.line || x.column - y.column);
}

function pages(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? pages(join(dir, e.name)) : /\.mdx?$/.test(e.name) ? [join(dir, e.name)] : []
  );
}

/** Every finding in the given areas (all of Klive's own by default) */
function checkDocsProse({ areas = AREAS, rules } = {}) {
  const results = [];
  for (const area of areas) {
    for (const file of pages(join(contentDir, area))) {
      const page = relative(contentDir, file).split(sep).join("/");
      if (GENERATED.has(page)) continue;
      for (const f of proseFindings(readFileSync(file, "utf8"), area)) {
        if (!rules || rules.includes(f.rule)) results.push({ area, page, ...f });
      }
    }
  }
  return results;
}

function main(argv) {
  const value = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const area = value("--area");
  const rule = value("--rule");
  if (area && !AREAS.includes(area)) throw new Error(`--area must be one of: ${AREAS.join(", ")}`);
  if (rule && !RULES.some((r) => r.id === rule)) throw new Error(`--rule must be one of: ${RULES.map((r) => r.id).join(", ")}`);
  const findings = checkDocsProse({ areas: area ? [area] : AREAS, rules: rule ? [rule] : undefined });

  if (!argv.includes("--summary")) {
    let page;
    for (const f of findings) {
      if (f.page !== page) console.log(`\ndocs/content/en/${(page = f.page)}`);
      const text = f.text.length > 110 ? f.text.slice(0, 107) + "..." : f.text;
      console.log(`  ${f.line}:${f.column}  ${f.rule.padEnd(10)} "${f.match}"  ${text}`);
    }
    console.log("");
  }
  const count = (key) => findings.reduce((m, f) => m.set(f[key], (m.get(f[key]) ?? 0) + 1), new Map());
  const byRule = count("rule");
  const byArea = count("area");
  const pagesWith = new Set(findings.map((f) => f.page)).size;
  console.log(`Prose: ${findings.length} finding(s) on ${pagesWith} page(s).`);
  console.log("  by area: " + [...byArea].map(([k, v]) => `${k} ${v}`).join(", "));
  console.log("  by rule: " + RULES.filter((r) => byRule.has(r.id)).map((r) => `${r.id} ${byRule.get(r.id)} (${r.why})`).join("; "));
  return argv.includes("--strict") && findings.length ? 1 : 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { checkDocsProse, proseFindings, proseOf, RULES, AREAS };
