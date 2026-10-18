import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assembleSection,
  bumpVersion,
  changesetKind,
  compareVersions,
  extractSection,
  featureUnlocks,
  formatEntry,
  gateDecision,
  insertSection,
  latestReleaseFromTags,
  nextVersion,
  parseChangeset,
  parseFeatures,
  releasePrBody,
  renderChangesetForDisplay,
  serializeChangeset,
  slugFrom,
  type Changeset
} from "../../scripts/changes-lib.cjs";

function cs(frontMatter: string, body = "Some entry.", file = "x.md", addedAt = 0): Changeset {
  const parsed = parseChangeset(`---\n${frontMatter}\n---\n\n${body}\n`, file);
  parsed.addedAt = addedAt;
  return parsed;
}

describe("changeset parsing and validation", () => {
  it("reads every front matter key", () => {
    const c = cs('type: fix\nissues: [1417, #1418]\nhighlight: "A \\"quoted\\" line" # comment\nkey: true', "Text.");
    expect(c.errors).toEqual([]);
    expect(c).toMatchObject({ type: "fix", issues: [1417, 1418], highlight: 'A "quoted" line', key: true, body: "Text." });
  });

  it("accepts a single issue number and comments", () => {
    const c = cs("type: feature   # a feature\nissues: 12");
    expect(c.errors).toEqual([]);
    expect(c.issues).toEqual([12]);
  });

  it("reports a missing front matter block", () => {
    expect(parseChangeset("Just text").errors[0]).toMatch(/front matter/);
  });

  it.each([
    ["type: feat", /not one of/],
    ["issues: [x]", /missing "type"/],
    ["type: fix\nissues: [abc]", /not an issue number/],
    ["type: fix\nbump: huge", /bump "huge"/],
    ["type: feature\nbump: patch", /lower than a feature implies/],
    ["type: feature\nkey: true", /only for fixes/],
    ["type: internal\nbump: minor", /no meaning on an internal/],
    ["type: fix\ncolour: red", /unknown front matter key/],
    ["type: fix\nhighlight: \"\"", /non-empty/]
  ])("rejects %j", (fm, message) => {
    expect(cs(fm).errors.join("\n")).toMatch(message);
  });

  it("requires an entry text except for internal changesets", () => {
    expect(cs("type: fix", "").errors.join()).toMatch(/empty/);
    expect(cs("type: internal", "").errors).toEqual([]);
  });

  it("rejects headings and inline code split across lines", () => {
    expect(cs("type: fix", "### Fixes\nText").errors.join()).toMatch(/headings/);
    expect(cs("type: fix", "a `split\ncode` span").errors.join()).toMatch(/split across lines/);
    expect(cs("type: fix", "fenced:\n\n```\n`odd\n```").errors).toEqual([]);
  });

  it("round-trips what serializeChangeset writes", () => {
    const text = serializeChangeset({ type: "fix", issues: [5], key: "Short summary", body: "Long text." });
    const c = parseChangeset(text);
    expect(c.errors).toEqual([]);
    expect(c).toMatchObject({ type: "fix", issues: [5], key: "Short summary", body: "Long text." });
  });
});

describe("kinds and versions", () => {
  it("maps types to kinds, breaking as minor while 0.x", () => {
    expect(changesetKind(cs("type: feature"), "0.63.0")).toBe("minor");
    expect(changesetKind(cs("type: fix"), "0.63.0")).toBe("patch");
    expect(changesetKind(cs("type: breaking"), "0.63.0")).toBe("minor");
    expect(changesetKind(cs("type: breaking"), "1.2.0")).toBe("major");
    expect(changesetKind(cs("type: internal", ""), "0.63.0")).toBe("none");
    expect(changesetKind(cs("type: known-issue"), "0.63.0")).toBe("none");
    expect(changesetKind(cs("type: fix\nbump: minor"), "0.63.0")).toBe("minor");
  });

  it("compares and bumps plain versions", () => {
    expect(compareVersions("0.10.0", "0.9.9")).toBe(1);
    expect(bumpVersion("0.63.2", "minor")).toBe("0.64.0");
    expect(bumpVersion("0.63.2", "patch")).toBe("0.63.3");
    expect(bumpVersion("0.63.2", "major")).toBe("1.0.0");
    expect(latestReleaseFromTags(["v0.9.0", "v0.10.0", "v0.11.0-rc.1", "z88-last", "0.99.0"])).toBe("0.10.0");
  });

  it("computes the next version from the highest kind", () => {
    const next = nextVersion({ lastRelease: "0.63.0", packageVersion: "0.63.0", changesets: [cs("type: fix"), cs("type: fix")] });
    expect(next).toMatchObject({ version: "0.63.1", kind: "patch" });
    expect(next!.reason).toBe("patch: 2 fixes");
    expect(nextVersion({ lastRelease: "0.63.0", packageVersion: "0.63.0", changesets: [cs("type: fix"), cs("type: feature")] })!.version).toBe("0.64.0");
  });

  it("keeps a pre-bumped package.json version (D2 migration)", () => {
    expect(nextVersion({ lastRelease: "0.63.0", packageVersion: "0.64.0", changesets: [cs("type: fix")] })!.version).toBe("0.64.0");
    expect(nextVersion({ lastRelease: "0.63.0", packageVersion: "0.64.0", changesets: [cs("type: feature")] })!.version).toBe("0.64.0");
    expect(nextVersion({ lastRelease: "0.63.0", packageVersion: "0.63.1", changesets: [cs("type: feature")] })!.version).toBe("0.64.0");
  });

  it("asks for no release when only internal changes are pending", () => {
    expect(nextVersion({ lastRelease: "0.63.0", packageVersion: "0.63.0", changesets: [cs("type: internal", "")] })).toBeUndefined();
  });
});

describe("assembling a CHANGELOG section", () => {
  it("formats an entry as a bullet with indented continuation lines and issue numbers", () => {
    expect(formatEntry("First line\nsecond line.", [1400])).toBe("- First line\n  second line (#1400).");
    expect(formatEntry("Mentions #1400 already.", [1400])).toBe("- Mentions #1400 already.");
    expect(formatEntry("- a\n- b", [])).toBe("- a\n- b");
  });

  it("wraps lines over 100 columns, never inside a code span", () => {
    const long = `**Lead:** ${"word ".repeat(18)}\`a code span\`, and more words here.`;
    const entry = formatEntry(long, [1446]);
    const lines = entry.split("\n");
    expect(lines.length).toBe(2);
    expect(lines.every((l) => l.length <= 100)).toBe(true);
    expect(lines[1].startsWith("  ")).toBe(true);
    expect(entry).toContain("`a code span`,");
    expect(entry.replace(/\n\s+/g, " ")).toBe(`- ${long.slice(0, -1)} (#1446).`);
    expect(formatEntry("short line", [])).toBe("- short line");
  });

  it("puts entries in the fixed section order, oldest changeset first", () => {
    const section = assembleSection({
      version: "0.64.0",
      date: "2026-10-25",
      changesets: [
        cs("type: fix", "Later fix.", "b.md", 2),
        cs('type: feature\nhighlight: "Big thing"', "**Thing:** detail.", "a.md", 1),
        cs("type: fix\nkey: true", "Key fix.", "c.md", 3),
        cs('type: fix\nkey: "Short key"', "Long fix.", "d.md", 0),
        cs("type: breaking", "Breaks.", "e.md", 4),
        cs("type: known-issue", "Known.", "f.md", 5),
        cs("type: internal", "", "g.md", 6)
      ]
    });
    expect(section).toBe(
      [
        "## 0.64.0 (2026-10-25)",
        "",
        "### Highlights",
        "",
        "- Big thing",
        "",
        "### Key fixes",
        "",
        "- Short key",
        "- Key fix.",
        "",
        "### Breaking changes",
        "",
        "- Breaks.",
        "",
        "### Features",
        "",
        "- **Thing:** detail.",
        "",
        "### Fixes",
        "",
        "- Long fix.",
        "- Later fix.",
        "",
        "### Known issues",
        "",
        "- Known.",
        ""
      ].join("\n")
    );
  });
});

describe("CHANGELOG.md", () => {
  const changelog = "# Klive IDE Changelog\n\n## 0.63.0\n\n### Fixes\n\n- Old.\n\n## 0.61.0\n\n- Older.\n";

  it("inserts a section above the newest release and reads it back", () => {
    const section = "## 0.64.0 (2026-10-25)\n\n### Fixes\n\n- New.\n";
    const updated = insertSection(changelog, section, "0.64.0");
    expect(updated).toBe("# Klive IDE Changelog\n\n## 0.64.0 (2026-10-25)\n\n### Fixes\n\n- New.\n\n## 0.63.0\n\n### Fixes\n\n- Old.\n\n## 0.61.0\n\n- Older.\n");
    expect(extractSection(updated, "0.64.0")).toBe("### Fixes\n\n- New.\n");
    expect(extractSection(updated, "0.63.0")).toBe("### Fixes\n\n- Old.\n");
    expect(extractSection(updated, "0.61.0")).toBe("- Older.\n");
    expect(extractSection(updated, "0.6.0")).toBeUndefined();
  });

  it("refuses an Unreleased section or a duplicate version", () => {
    expect(() => insertSection("## Unreleased\n\n## 0.1.0\n", "## 0.2.0\n", "0.2.0")).toThrow(/Unreleased/);
    expect(() => insertSection(changelog, "## 0.63.0\n", "0.63.0")).toThrow(/already/);
  });

  it("finds every release section of the real CHANGELOG.md", () => {
    const real = readFileSync(join(__dirname, "../../CHANGELOG.md"), "utf8");
    expect(real).not.toMatch(/^## Unreleased/m);
    expect(extractSection(real, "0.63.0")).toMatch(/### Highlights/);
  });
});

describe("display, slugs and the PR gate", () => {
  it("shows the path, kind and content", () => {
    const text = "---\ntype: feature\nissues: [1468]\n---\n\n**X:** y.\n";
    expect(renderChangesetForDisplay(".changes/x.md", text, parseChangeset(text), "0.63.0")).toBe(
      "Changeset `.changes/x.md` — **minor** (feature, #1468)\n\n```markdown\n" + text.trimEnd() + "\n```\n"
    );
  });

  it("makes short slugs without Markdown", () => {
    expect(slugFrom("**Copper and DMA regions in `.NEX` annotations:** mark")).toBe("copper-dma-regions-annotations-mark");
    expect(slugFrom("", "fix")).toBe("fix");
  });

  it.each([
    [{ files: [{ path: "src/main/a.ts", status: "M" }] }, false],
    [{ files: [{ path: "src/main/a.ts", status: "M" }, { path: ".changes/a-1234.md", status: "A" }] }, true],
    [{ files: [{ path: "src/main/a.ts", status: "M" }, { path: ".changes/README.md", status: "M" }] }, false],
    [{ files: [{ path: "src/main/a.ts", status: "M" }, { path: ".changes/a-1234.md", status: "D" }] }, false],
    [{ files: [{ path: "docs/content/en/x.mdx", status: "M" }, { path: "README.md", status: "M" }, { path: "test/x.test.ts", status: "A" }] }, true],
    [{ files: [{ path: "src/a.ts", status: "M" }], labels: ["no-changeset"] }, true],
    [{ files: [{ path: "package.json", status: "M" }], author: "dependabot[bot]" }, true],
    [{ files: [{ path: "package.json", status: "M" }], headRef: "release/v0.64.0" }, true]
  ])("gate %#", (input, ok) => {
    expect(gateDecision(input).ok).toBe(ok);
  });
});

describe("landing-page features", () => {
  it("parses the real features.ts", () => {
    const features = parseFeatures(readFileSync(join(__dirname, "../../docs/landing/features.ts"), "utf8"));
    expect(features.length).toBeGreaterThan(3);
    expect(features[0]).toEqual({ id: "allInOne", since: "0.1.0" });
  });

  it("lists unlocked and never-released features", () => {
    const features = [
      { id: "a", since: "0.63.0" },
      { id: "b", since: "0.64.0" },
      { id: "c", since: "0.63.5" },
      { id: "d", since: "0.65.0" }
    ];
    const u = featureUnlocks(features, { version: "0.64.0", lastRelease: "0.63.0" });
    expect(u.unlocked.map((f) => f.id)).toEqual(["b"]);
    expect(u.stale.map((f) => f.id)).toEqual(["c"]);
    expect(u.future.map((f) => f.id)).toEqual(["d"]);
    const body = releasePrBody({ version: "0.64.0", lastRelease: "0.63.0", section: "## 0.64.0\n", reason: "minor", unlocks: u, consumed: 1 });
    expect(body).toMatch(/unlocks: `b` \(since 0\.64\.0\)/);
    expect(body).toMatch(/1 changeset consumed/);
  });
});
