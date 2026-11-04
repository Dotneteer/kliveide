/**
 * The scripts find the repository root through one helper (`dev/scripts/repo-root.cjs`), so the scripts
 * folder can live at any depth (`.plans/ROOT_DECLUTTER_PLAN.md`, steps 10-11).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(__dirname, "../..");
const SCRIPTS = path.join(REPO, "dev", "scripts");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { REPO_ROOT, findRepoRoot } = require(path.join(SCRIPTS, "repo-root.cjs"));

function scriptFiles(folder: string): string[] {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : scriptFiles(full);
    return /\.(c|m)?js$/.test(entry.name) ? [full] : [];
  });
}

describe("dev/scripts/repo-root.cjs", () => {
  it("finds the folder holding Klive's package.json", () => {
    expect(REPO_ROOT).toBe(REPO);
    expect(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")).name).toBe("klive-ide");
  });

  it("finds it from any depth, and never stops at the docs site's package.json", () => {
    expect(findRepoRoot(path.join(SCRIPTS, "doc-shots", "recipes"))).toBe(REPO);
    expect(findRepoRoot(path.join(REPO, "docs"))).toBe(REPO);
  });

  it("is the only way a script reaches outside its own folder from __dirname", () => {
    const call = /(?:path\.)?(?:join|resolve)\(\s*__dirname\s*,\s*((?:"[^"\\]*"\s*,\s*)*"[^"\\]*")\s*\)/g;
    const offenders: string[] = [];
    for (const file of scriptFiles(SCRIPTS)) {
      const text = fs.readFileSync(file, "utf8");
      for (const match of text.matchAll(call)) {
        const segments = [...match[1].matchAll(/"([^"\\]*)"/g)].map((m) => m[1]);
        const target = path.resolve(path.dirname(file), ...segments);
        if (target !== SCRIPTS && !target.startsWith(SCRIPTS + path.sep)) {
          offenders.push(`${path.relative(REPO, file)}: ${match[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("is the only way a script loads a module from outside its own folder", () => {
    const load = /(?:require\(|import\(|from\s+)\s*["'](\.{1,2}\/[^"']+)["']/g;
    const offenders: string[] = [];
    for (const file of scriptFiles(SCRIPTS)) {
      for (const match of fs.readFileSync(file, "utf8").matchAll(load)) {
        const target = path.resolve(path.dirname(file), match[1]);
        if (!target.startsWith(SCRIPTS + path.sep)) offenders.push(`${path.relative(REPO, file)}: ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
