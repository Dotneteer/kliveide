/**
 * Writes the website's "What's new" page (docs/content/en/reference/whats-new.mdx) from
 * CHANGELOG.md, so the release notes on the site are never behind the repository's. The page is
 * generated on every docs build and is not committed.
 *
 * CHANGELOG.md is Markdown; the page is MDX, where `{`, `}` and `<` outside code start
 * expressions and tags. They are escaped in prose and left alone inside code spans and fences.
 *
 * Usage: node scripts/build-doc-changelog.cjs
 */
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const repoRoot = join(__dirname, "..");
const source = readFileSync(join(repoRoot, "CHANGELOG.md"), "utf8");
const target = join(repoRoot, "docs", "content", "en", "reference", "whats-new.mdx");

/** Escapes MDX's special characters outside inline code. */
function escapeProse(line) {
  return line
    .split(/(`[^`]*`)/)
    .map((part, i) =>
      i % 2 ? part : part.replace(/\{/g, "&#123;").replace(/\}/g, "&#125;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    )
    .join("");
}

let inFence = false;
const lines = [];
for (const line of source.split("\n")) {
  if (/^```/.test(line)) {
    inFence = !inFence;
    lines.push(inFence && line.trim() === "```" ? "```text" : line);
    continue;
  }
  if (inFence) {
    lines.push(line);
    continue;
  }
  // --- The file's own title becomes the page's; releases become sections
  if (/^# /.test(line)) continue;
  lines.push(escapeProse(line).replace(/^&gt; /, "> "));
}

const page = `---
description: "What changed in each Klive IDE release, newest first."
---

{/* Generated from CHANGELOG.md by scripts/build-doc-changelog.cjs on every docs build. Edit CHANGELOG.md. */}

# What's new

Every release of Klive IDE, newest first. **Unreleased** lists what is already in the source code and comes with the next release. Download a release from the [releases page](https://github.com/Dotneteer/kliveide/releases).

${lines.join("\n").trim()}
`;
writeFileSync(target, page);
console.log(`What's new: ${(source.match(/^## /gm) ?? []).length} release sections.`);
