/*
 * A structured diff of two pinned ZX Spectrum Next VHDL trees (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md`
 * P2): which files were added, removed, moved or changed; for each changed VHDL file, the entity
 * generics and every changed line grouped by the section banner, process / generate block and
 * signals it touches, with line numbers in both versions; and `nextreg.txt` grouped by register.
 *
 *   npm run next-fpga:diff [-- <from> <to>] [--commented] [--brief] [--out <file>]
 *
 * Defaults: 3.02.01 -> 3.02.04, pristine upstream files (from the fetch cache, so Klive's comment
 * patches do not show), full hunks, Markdown to stdout. `--commented` diffs the fetched trees
 * instead; `--brief` prints only the per-region summary lines.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const lib = require("./next-fpga-lib.cjs");

const SKIP_BODY = new Set(["src/rom/bootrom.vhd", "src/rom/bootrom_ab.vhd", "changelog.md"]);

function lineDiff(a, b, tmp) {
  const fa = path.join(tmp, "a");
  const fb = path.join(tmp, "b");
  fs.writeFileSync(fa, a);
  fs.writeFileSync(fb, b);
  let out;
  try {
    out = execFileSync("git", ["diff", "--no-index", "--no-color", "-U0", "--ignore-cr-at-eol", "--", fa, fb], { maxBuffer: 256 * 1024 * 1024 });
  } catch (e) {
    if (e.status !== 1) throw e;
    out = e.stdout;
  }
  const hunks = [];
  let h = null;
  for (const line of out.toString("latin1").split("\n")) {
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (m) {
      h = { a: +m[1], na: m[2] === undefined ? 1 : +m[2], b: +m[3], nb: m[4] === undefined ? 1 : +m[4], lines: [] };
      if (h.na === 0) h.a++;
      if (h.nb === 0) h.b++;
      hunks.push(h);
    } else if (h && (line[0] === "+" || line[0] === "-")) {
      // Inside a hunk, "---"/"+++" are removed/added VHDL comment lines, not file headers.
      h.lines.push(line);
    }
  }
  return hunks;
}

const BANNER = /^\s*--\s+([A-Z][A-Z0-9 &/#()._+,:'-]{3,}?)\s*-*\s*$/;

/** For each line (1-based) of a VHDL file: { section, block } where block is the process/generate. */
function vhdlRegions(text) {
  const lines = text.split("\n");
  const at = [null];
  let section = "";
  const stack = [];
  let entity = "";
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/\r$/, "");
    const code = raw.replace(/--.*$/, "");
    const banner = BANNER.exec(raw);
    if (banner && !/^\s*--\s*-+\s*$/.test(raw)) section = banner[1].trim();
    let m;
    if ((m = /^\s*entity\s+(\w+)\s+is/i.exec(code))) entity = m[1];
    if ((m = /^\s*architecture\s+(\w+)\s+of\s+(\w+)/i.exec(code))) entity = `${m[2]}(${m[1]})`;
    if ((m = /^\s*(?:(\w+)\s*:\s*)?process\b\s*(\(([^)]*)\)?)?/i.exec(code)) && !/end\s+process/i.test(code)) {
      const sens = (m[3] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      stack.push({ kind: "process", label: m[1] ?? "", sens, line: i + 1, assigns: new Set() });
    } else if ((m = /^\s*(\w+)\s*:\s*(if|for)\b.*\bgenerate\b/i.exec(code))) {
      stack.push({ kind: "generate", label: m[1], line: i + 1, assigns: new Set() });
    }
    const top = stack[stack.length - 1];
    const assign = /^\s*(\w+)(?:\s*\([^)]*\))?\s*<=/.exec(code);
    if (top && top.kind === "process" && assign) top.assigns.add(assign[1]);
    at.push({ section, entity, blocks: stack.slice() });
    if (/^\s*end\s+process\b/i.test(code) || /^\s*end\s+generate\b/i.test(code)) stack.pop();
  }
  return at;
}

function blockName(b) {
  if (b.kind === "generate") return `generate ${b.label}`;
  if (b.label) return `process ${b.label}`;
  const assigns = [...b.assigns].slice(0, 4).join(", ");
  return `process(${b.sens.slice(0, 2).join(", ")}${b.sens.length > 2 ? ", ..." : ""})@${b.line}${assigns ? ` -> ${assigns}${b.assigns.size > 4 ? ", ..." : ""}` : ""}`;
}

function regionLabel(r) {
  if (!r) return "(start)";
  const parts = [];
  if (r.section) parts.push(r.section);
  const inner = r.blocks.map(blockName);
  if (inner.length) parts.push(inner.join(" / "));
  return parts.join(" :: ") || r.entity || "(top)";
}

/** The generics of the first `entity ... generic (...)` in a VHDL file, as { name: default }. */
function generics(text) {
  const m = /entity\s+\w+\s+is\s+generic\s*\(([\s\S]*?)\)\s*;\s*port/i.exec(text.replace(/--[^\n]*/g, ""));
  if (!m) return {};
  const out = {};
  for (const decl of m[1].split(";")) {
    const g = /^\s*([\w,\s]+?)\s*:\s*([^:]+?)(?::=\s*([\s\S]+?))?\s*$/.exec(decl);
    if (!g) continue;
    for (const name of g[1].split(",")) out[name.trim()] = `${g[2].trim()}${g[3] ? ` := ${g[3].replace(/\s+/g, " ").trim()}` : ""}`;
  }
  return out;
}

/** For nextreg.txt: the register heading for each line. */
function nextregRegions(text) {
  const at = [null];
  let current = "(preamble)";
  for (const line of text.split("\n")) {
    const m = /^(0x[0-9A-Fa-f]{2}(?:\s*-\s*0x[0-9A-Fa-f]{2})?\s*\(\d+\)\s*=>.*)$/.exec(line.replace(/\r$/, ""));
    if (m) current = m[1].trim();
    at.push(current);
  }
  return at;
}

function hunkSignals(lines) {
  const names = new Set();
  for (const l of lines) {
    const code = l.slice(1).replace(/--.*$/, "");
    let m;
    if ((m = /^\s*signal\s+([\w, ]+?)\s*:/i.exec(code))) m[1].split(",").forEach((n) => names.add(n.trim()));
    else if ((m = /^\s*(\w+)(?:\s*\([^)]*\))?\s*<=/.exec(code))) names.add(m[1]);
  }
  return [...names];
}

function pairFiles(A, B) {
  const pairs = [];
  const usedB = new Set();
  const byBlobB = {};
  for (const [f, id] of Object.entries(B)) (byBlobB[id] ??= []).push(f);
  for (const f of Object.keys(A).sort()) {
    if (B[f]) {
      pairs.push({ a: f, b: f });
      usedB.add(f);
    }
  }
  for (const f of Object.keys(A).sort()) {
    if (B[f]) continue;
    const same = (byBlobB[A[f]] ?? []).filter((x) => !usedB.has(x));
    const base = Object.keys(B).filter((x) => !usedB.has(x) && !A[x] && path.posix.basename(x) === path.posix.basename(f));
    const to = same[0] ?? (base.length === 1 ? base[0] : null);
    if (to) {
      pairs.push({ a: f, b: to, moved: true });
      usedB.add(to);
    } else pairs.push({ a: f, b: null });
  }
  for (const f of Object.keys(B).sort()) if (!usedB.has(f)) pairs.push({ a: null, b: f });
  return pairs;
}

function main(argv) {
  const manifest = lib.readManifest();
  const positional = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--out");
  const [from, to] = positional.length >= 2 ? positional : ["3.02.01", "3.02.04"];
  const commented = argv.includes("--commented");
  const brief = argv.includes("--brief");
  const outAt = argv.indexOf("--out");
  const ea = lib.versionEntry(manifest, from);
  const eb = lib.versionEntry(manifest, to);
  lib.ensureObjects(manifest, ea, Object.values(ea.files));
  lib.ensureObjects(manifest, eb, Object.values(eb.files));
  const read = (version, entry, rel) =>
    commented ? fs.readFileSync(path.join(lib.VENDOR, version, rel)) : lib.readBlob(entry.files[rel]);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "next-fpga-diff-"));
  const out = [];
  const say = (s = "") => out.push(s);
  say(`# ZX Spectrum Next VHDL: ${from} -> ${to}`);
  say();
  say(`- ${from}: \`${ea.commit}\`${ea.ref ? ` (branch ${ea.ref})` : ""}`);
  say(`- ${to}: \`${eb.commit}\`${eb.ref ? ` (branch ${eb.ref})` : ""}`);
  say(`- Files: upstream \`${ea.path}/\` limited to ${ea.include.join(", ")}; ${commented ? "fetched trees (Klive comments applied)" : "pristine upstream (Klive comments not applied)"}.`);
  say(`- Line numbers are \`file@version Lnnn\`; hunks ignore CR at end of line.`);
  say();

  const pairs = pairFiles(ea.files, eb.files);
  const summary = [];
  const details = [];
  try {
    for (const p of pairs) {
      if (!p.a) {
        summary.push(`| added | \`${p.b}\` | |`);
        continue;
      }
      if (!p.b) {
        summary.push(`| removed | \`${p.a}\` | |`);
        continue;
      }
      const a = read(from, ea, p.a);
      const b = read(to, eb, p.b);
      if (Buffer.compare(a, b) === 0) {
        if (p.moved) summary.push(`| moved | \`${p.a}\` -> \`${p.b}\` | identical |`);
        continue;
      }
      if (lib.onlyLineEndings(a, b)) {
        summary.push(`| line endings | \`${p.b}\` | |`);
        continue;
      }
      if (a.includes(0) || b.includes(0)) {
        summary.push(`| binary | \`${p.b}\` | |`);
        continue;
      }
      const hunks = lineDiff(a, b, tmp);
      const plus = hunks.reduce((n, h) => n + h.lines.filter((l) => l[0] === "+").length, 0);
      const minus = hunks.reduce((n, h) => n + h.lines.filter((l) => l[0] === "-").length, 0);
      summary.push(`| ${p.moved ? "moved+modified" : "modified"} | \`${p.moved ? `${p.a}\` -> \`${p.b}` : p.b}\` | +${plus} -${minus}, ${hunks.length} hunks |`);
      const d = [];
      d.push(`## ${p.b}${p.moved ? ` (was ${p.a})` : ""}`);
      d.push();
      if (SKIP_BODY.has(p.b)) {
        d.push(`+${plus} -${minus} lines; body not shown (data / prose).`);
        details.push(d.join("\n"));
        continue;
      }
      const isVhdl = /\.vhdl?$/.test(p.b);
      const isNextreg = p.b === "nextreg.txt" || p.b === "ports.txt";
      const ta = a.toString("latin1");
      const tb = b.toString("latin1");
      if (isVhdl) {
        const ga = generics(ta);
        const gb = generics(tb);
        const names = [...new Set([...Object.keys(ga), ...Object.keys(gb)])];
        const changed = names.filter((n) => ga[n] !== gb[n]);
        if (changed.length) {
          d.push("Generics:");
          for (const n of changed) d.push(`- \`${n}\`: ${ga[n] ? `\`${ga[n]}\`` : "(new)"} -> ${gb[n] ? `\`${gb[n]}\`` : "(removed)"}`);
          d.push("");
        }
      }
      const ra = isVhdl ? vhdlRegions(ta) : isNextreg ? nextregRegions(ta) : null;
      const rb = isVhdl ? vhdlRegions(tb) : isNextreg ? nextregRegions(tb) : null;
      let lastLabel = null;
      for (const h of hunks) {
        let label = "";
        if (rb) {
          const regionB = rb[Math.min(h.b, rb.length - 1)];
          const regionA = ra[Math.min(h.a, ra.length - 1)];
          label = isVhdl ? regionLabel(h.nb ? regionB : regionA) : (h.nb ? regionB : regionA);
        }
        const rangeA = h.na ? `${p.a}@${from} L${h.a}${h.na > 1 ? `-${h.a + h.na - 1}` : ""}` : `(none @${from} ~L${h.a})`;
        const rangeB = h.nb ? `${p.b}@${to} L${h.b}${h.nb > 1 ? `-${h.b + h.nb - 1}` : ""}` : `(none @${to} ~L${h.b})`;
        const sigs = isVhdl ? hunkSignals(h.lines) : [];
        if (label !== lastLabel) {
          d.push(`### ${label || "(file)"}`);
          lastLabel = label;
        }
        d.push(`- ${rangeA} -> ${rangeB}  (+${h.nb} -${h.na})${sigs.length ? `  signals: ${sigs.slice(0, 8).join(", ")}${sigs.length > 8 ? ", ..." : ""}` : ""}`);
        if (!brief) {
          d.push("```diff");
          for (const l of h.lines) d.push(l.replace(/\r$/, ""));
          d.push("```");
        }
      }
      details.push(d.join("\n"));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  say("| Change | File | Size |");
  say("|---|---|---|");
  for (const s of summary) say(s);
  say();
  for (const d of details) {
    say(d);
    say();
  }
  const text = out.join("\n");
  if (outAt >= 0) {
    fs.writeFileSync(argv[outAt + 1], text);
    console.log(`next-fpga diff ${from} -> ${to}: ${summary.length} file changes written to ${argv[outAt + 1]}`);
  } else process.stdout.write(text);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}

module.exports = { generics, vhdlRegions, nextregRegions, pairFiles };
