import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The architectural boundaries of `.plans/SHARED_Z80_BACKEND_PLAN.md`:
 *
 * - **Part A (§1.2, §4.4):** the shared back end imports nothing from a language, and a language
 *   imports only the back-end files of §4.4 and does no Z80 code generation of its own.
 * - **Part B (§12):** the source-level debug layers (model, engine, presentation core) import
 *   nothing from a language or a producer, and write no language keyword in code.
 *
 * While the plan is carried out, `build/boundary-baseline.json` lists the violations that still
 * exist; a count may only go down (`BOUNDARY_BASELINE_UPDATE=1` records a lower one). The baseline
 * is empty when the plan is complete.
 */
const ROOT = resolve(__dirname, "../..");
const BASELINE = join(ROOT, "build/boundary-baseline.json");

const ALIASES: [string, string][] = [
  ["@abstractions/", "src/common/abstractions/"],
  ["@common/", "src/common/"],
  ["@messaging/", "src/common/messaging/"],
  ["@state/", "src/common/state/"],
  ["@utils/", "src/common/utils/"],
  ["@renderer/", "src/renderer/"],
  ["@emu/", "src/emu/"],
  ["@appIde/", "src/renderer/appIde/"],
  ["@main/", "src/main/"],
  ["@controls/", "src/renderer/controls/"],
  ["@mvc/", "src/renderer/mvc/"]
];

/** Language and producer folders: what a neutral layer must not depend on. */
const LANGUAGES = ["src/main/kbasic/", "src/main/boriel-integration/", "src/main/z88dk-integration/", "src/main/zxb-integration/"];

/**
 * The shared back end and the shared compiler shell, plus the Klive BASIC files the plan moves into
 * them (removed from this list as they move), so the boundary holds from Phase 0 on.
 */
const BACKEND = [
  "src/main/z80-backend/",
  "src/main/compiler-shell/",
  "src/main/kbasic/debug/",
  "src/main/kbasic/runtime/runtime-linker.ts",
  "src/main/kbasic/runtime/runtime-types.ts",
  "src/main/kbasic/emit-files.ts"
];

/** The back-end files a front end may import (plan §4.4). */
const FRONT_END_API = [
  "src/main/z80-backend/mir/mir.ts",
  "src/main/z80-backend/mir/builder.ts",
  "src/main/z80-backend/link/compile-module.ts",
  "src/main/z80-backend/options.ts",
  "src/main/z80-backend/problems.ts",
  "src/main/z80-backend/runtime/runtime-types.ts",
  "src/main/z80-backend/runtime/representations.ts",
  "src/main/z80-backend/numeric/float40.ts",
  "src/main/compiler-shell/Z80LanguageCompiler.ts",
  "src/main/compiler-shell/emit-files.ts"
];

/** The source-level debug layers (plan §12): model, engine and presentation core. */
const DEBUG_CORE = [
  "src/common/abstractions/SourceDebugInfo.ts",
  "src/common/utils/source-debug-sidecar.ts",
  "src/emu/machines/SourceStepDecision.ts",
  "src/renderer/appIde/debugger/source/",
  "src/renderer/appIde/utils/source-location.ts",
  "src/renderer/appIde/SideBarPanels/CallStackPanel.tsx",
  "src/common/profile/routineMap.ts"
];

/** Language plugins of the debugger: the registry is the only file that may import them. */
const DEBUG_PLUGINS = "src/renderer/appIde/debugger/languages/";

/** A language keyword in a string literal of a debug-core file (comments are not code). */
const LANGUAGE_WORDS = /\b(gosub|GOSUB|on-gosub|Klive BASIC|BASIC)\b/;

function files(path: string): string[] {
  const abs = join(ROOT, path);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [path];
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(`${path}${e.name}/`) : /\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.ts") ? [`${path}${e.name}`] : []
  );
}

/** The project-relative files a source file imports (aliases and relative paths; packages are skipped). */
function importsOf(file: string): string[] {
  const text = readFileSync(join(ROOT, file), "utf8");
  const out: string[] = [];
  for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g)) {
    const spec = m[1];
    let target: string | undefined;
    if (spec.startsWith(".")) target = relative(ROOT, resolve(dirname(join(ROOT, file)), spec));
    else {
      const alias = ALIASES.find(([a]) => spec.startsWith(a));
      if (alias) target = alias[1] + spec.slice(alias[0].length);
    }
    if (target) out.push(target.replace(/\\/g, "/"));
  }
  return out;
}

const under = (path: string, roots: string[]) => roots.some((r) => (r.endsWith("/") ? path.startsWith(r) : path === r || path === r.replace(/\.tsx?$/, "")));

/** Code without comments, so a keyword in a doc comment is not a violation. */
function codeOf(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/** Every violation, as `rule|file` -> count. */
function violations(): Record<string, number> {
  const found: Record<string, number> = {};
  const add = (rule: string, file: string) => (found[`${rule}|${file}`] = (found[`${rule}|${file}`] ?? 0) + 1);

  // --- A1: the back end imports no language
  const language = (path: string) => under(path, LANGUAGES) && !under(path, BACKEND);
  for (const file of BACKEND.flatMap(files)) for (const target of importsOf(file)) if (language(target)) add("A1 back end imports a language", file);

  // --- A2: a language imports only the front-end API of the back end, and no Z80 assembler for code generation
  for (const file of ["src/main/kbasic/"].flatMap(files).filter(language)) {
    for (const target of importsOf(file)) {
      if (under(target, BACKEND) && !FRONT_END_API.some((api) => target === api || target === api.replace(/\.tsx?$/, ""))) add("A2 language imports a back-end internal", file);
      if (target.startsWith("src/main/z80-compiler/z80-assembler")) add("A2 language runs the Z80 assembler", file);
    }
  }

  // --- B1: the debug core imports no language or producer, and no debugger plugin
  const core = DEBUG_CORE.flatMap(files);
  for (const file of core) {
    for (const target of importsOf(file)) {
      if (under(target, LANGUAGES)) add("B1 debug core imports a language", file);
      if (target.startsWith(DEBUG_PLUGINS) && target !== `${DEBUG_PLUGINS}registry`) add("B1 debug core imports a language plugin", file);
    }
    // --- B2: no language keyword in a string literal
    const code = codeOf(readFileSync(join(ROOT, file), "utf8"));
    for (const m of code.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) if (LANGUAGE_WORDS.test(m[2])) add("B2 debug core names a language construct", file);
  }

  // --- B3: only the registry imports a plugin
  for (const file of files("src/").filter((f) => !f.startsWith(DEBUG_PLUGINS))) {
    for (const target of importsOf(file)) {
      if (target.startsWith(DEBUG_PLUGINS) && target !== `${DEBUG_PLUGINS}registry`) add("B3 a plugin is imported outside the registry", file);
    }
  }
  for (const file of files(DEBUG_PLUGINS).filter((f) => !f.endsWith("registry.ts"))) {
    for (const other of files(DEBUG_PLUGINS)) {
      if (other === file || other.endsWith("registry.ts")) continue;
      if (importsOf(other).some((t) => t === file.replace(/\.tsx?$/, "") || t === file)) add("B3 a plugin is imported outside the registry", other);
    }
  }
  return found;
}

describe("architectural boundaries (shared back end, debug core)", () => {
  it("has no violation beyond the baseline, and the baseline is current", () => {
    const actual = violations();
    if (process.env.BOUNDARY_BASELINE_UPDATE === "1") {
      const sorted = Object.fromEntries(Object.entries(actual).sort(([a], [b]) => a.localeCompare(b)));
      writeFileSync(BASELINE, `${JSON.stringify(sorted, null, 2)}\n`);
      return;
    }
    const baseline: Record<string, number> = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};
    const worse = Object.entries(actual).filter(([k, n]) => n > (baseline[k] ?? 0)).map(([k, n]) => `${k}: ${n} (baseline ${baseline[k] ?? 0})`);
    expect(worse, "new boundary violations (plan §1.2, §12)").toEqual([]);
    const stale = Object.entries(baseline).filter(([k, n]) => (actual[k] ?? 0) < n).map(([k, n]) => `${k}: ${actual[k] ?? 0} < ${n}`);
    expect(stale, "violations fixed but still in build/boundary-baseline.json: run with BOUNDARY_BASELINE_UPDATE=1").toEqual([]);
  });
});
