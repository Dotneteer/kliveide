/**
 * Fails when a Guides page shows a screenshot taken before the September 2026 UI redesign.
 *
 * The redesign (#1337-#1342) changed every panel, dialog and toolbar, so these images show an
 * app that no longer exists. `.plans/GUIDES_OVERHAUL_PLAN.md` replaced them with recipe-generated
 * shots (`scripts/doc-shots/`); this keeps them from coming back by copy and paste.
 *
 * The list is explicit rather than dated, because git dates of these files record a bulk move,
 * not when they were taken. `bp-view.png` is not on it: it was re-captured after the redesign.
 * Get Started's install pages show the operating system, not Klive, so they are not checked.
 *
 * Usage: node scripts/check-docs-guide-images.cjs
 */
const { readdirSync, readFileSync } = require("node:fs");
const { join, relative } = require("node:path");

const repoRoot = join(__dirname, "..");
const guidesDir = join(repoRoot, "docs", "content", "en", "guides");

const OBSOLETE = [
  /\/images\/howto\//,
  /\/images\/getting-started\/(?!tape-)/,
  new RegExp(
    "/images/working-with-ide/(" +
      [
        "banked-disass-view", "banked-mem-view", "basic-list", "bp-explain", "bp-not-resolved",
        "bp-resolved", "bp-types", "cpu-view", "disass-view", "disassembly-breakpoint-message",
        "edit-memory", "emu-toolbar-startup", "export-dialog-1", "export-dialog-2", "ide-commands",
        "keyline-value", "machine-paused", "machine-running", "mem-view", "new-sjasmp-project",
        "next-mem-view", "running-sjasmp-code", "select-start-mode", "sjasmp-reset", "sysvar-explain",
        "sysvar-flag", "sysvar-view", "toggle-keyline", "ula-view", "watch-panel", "zxb-actions",
        "zxb-running"
      ].join("|") +
      ")\\.png"
  )
];

function pages(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? pages(join(dir, e.name)) : /\.mdx?$/.test(e.name) ? [join(dir, e.name)] : []
  );
}

const found = [];
for (const file of pages(guidesDir)) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (OBSOLETE.some((re) => re.test(line))) {
        found.push(`  ${relative(repoRoot, file)}:${i + 1}  ${line.trim().slice(0, 100)}`);
      }
    });
}

if (found.length) {
  console.error(`${found.length} pre-redesign screenshot reference(s) in Guides:\n${found.join("\n")}`);
  console.error("Replace them with a recipe-generated shot (scripts/doc-shots/, .ai/doc-screenshots-guide.md).");
  process.exit(1);
}
console.log("Guides show no pre-redesign screenshots.");
