/**
 * The website's zip of the Unraveling book's examples (decision D9 of dev/ai/docs-site.md): its
 * `klive.project` must stay a project file but lose the author's own machine and IDE state.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { cleanProjectFile, BOOK_PROJECT_DROPPED_KEYS } = require("../../dev/scripts/build-doc-assets.cjs");

const shipped = readFileSync(
  join(__dirname, "..", "..", "docs", "books", "unraveling-next", "examples", "klive.project"),
  "utf8"
);

describe("the Unraveling book's examples project", () => {
  it("drops media, viewOptions, workspaceSettings and debugger", () => {
    expect(BOOK_PROJECT_DROPPED_KEYS).toEqual(["media", "viewOptions", "workspaceSettings", "debugger"]);
    const source = JSON.stringify({
      kliveVersion: "0.69.0",
      machineType: "zxnext",
      media: { sdCard: "/Users/someone/Klive/card.cim" },
      viewOptions: { theme: "dark" },
      workspaceSettings: { docsWorkspace: {} },
      debugger: { breakpoints: [] },
      builder: { roots: ["code/main.kz80.asm"] }
    });
    expect(JSON.parse(cleanProjectFile(source))).toEqual({
      kliveVersion: "0.69.0",
      machineType: "zxnext",
      builder: { roots: ["code/main.kz80.asm"] }
    });
  });

  it("keeps the shipped project buildable and free of local paths", () => {
    const cleaned = cleanProjectFile(shipped);
    const project = JSON.parse(cleaned);
    expect(project.machineType).toBe("zxnext");
    expect(project.builder.roots).toContain("code/main.kz80.asm");
    for (const key of BOOK_PROJECT_DROPPED_KEYS) expect(project).not.toHaveProperty(key);
    expect(cleaned).not.toMatch(/\/Users\/|[A-Z]:\\\\/);
  });
});
