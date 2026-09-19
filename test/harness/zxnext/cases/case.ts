import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { MotionSpec } from "./motion";
import type { Probe } from "./probes";

export type OracleName = "ready" | "probes" | "motion" | "identical" | "headless" | "canvas";

/**
 * A mismatch the case expects, with the reason. It is reported as XFAIL instead of failing the run,
 * and becomes a failure (XPASS) the moment it starts passing, so the entry cannot outlive the bug.
 */
export type KnownFailure = { oracle: OracleName; /** probe or motion name */ name?: string; reason: string };

export type CaseSpec = {
  id: string;
  title: string;
  /** Default `program.asm`. */
  program?: string;
  /** Frames (1-based, counted from the entry point) saved as PNG and checked by `probes`. */
  capture: number[];
  /** Extra frames captured with `--long`. */
  longCapture?: number[];
  /** Every captured frame must hash identically (a static screen). */
  expectIdenticalFrames?: boolean;
  /** The frame by which the program must have written $A5 to NextReg $7F. Default 10. */
  readyBy?: number;
  probes?: Probe[];
  motion?: MotionSpec[];
  /** Frames tiled into `contact-sheet-<tier key>.png` (`wasm`, `browser`) for review. */
  contactSheet?: { frames: number[]; columns?: number };
  knownFailures?: KnownFailure[];
  /** Only run with `--long` (e.g. thousands of frames). */
  longOnly?: boolean;
  /** Which tiers run this case. Default headless only. */
  tiers?: Array<"headless" | "browser">;
};

export type LoadedCase = {
  spec: CaseSpec;
  dir: string;
  programPath: string;
  expectMd: string;
  golden?: Golden;
};

/** Approved frame hashes per tier: `wasm` (headless) and `browser`. */
export type Golden = Partial<Record<"wasm" | "browser", Record<string, string>>>;

export const READY_REG = 0x7f;
export const READY_VALUE = 0xa5;

export function casesRoot(repoRoot: string): string {
  return join(repoRoot, "test/visual");
}

/** Every `test/visual/<suite>/<case>/case.json`, sorted by id. */
export function discoverCases(repoRoot: string): LoadedCase[] {
  const root = casesRoot(repoRoot);
  const found: LoadedCase[] = [];
  for (const suite of readdirSync(root, { withFileTypes: true })) {
    if (!suite.isDirectory()) continue;
    for (const entry of readdirSync(join(root, suite.name), { withFileTypes: true })) {
      const dir = join(root, suite.name, entry.name);
      if (entry.isDirectory() && existsSync(join(dir, "case.json"))) found.push(loadCase(dir));
    }
  }
  return found.sort((a, b) => a.spec.id.localeCompare(b.spec.id));
}

export function loadCase(dir: string): LoadedCase {
  const spec = JSON.parse(readFileSync(join(dir, "case.json"), "utf8")) as CaseSpec;
  if (!spec.id || !spec.title || !Array.isArray(spec.capture) || !spec.capture.length) {
    throw new Error(`${dir}/case.json needs id, title and a non-empty capture list`);
  }
  const expectPath = join(dir, "expect.md");
  if (!existsSync(expectPath)) throw new Error(`${dir} has no expect.md; every case states what it expects`);
  const goldenPath = join(dir, "golden.json");
  return {
    spec,
    dir,
    programPath: join(dir, spec.program ?? "program.asm"),
    expectMd: readFileSync(expectPath, "utf8"),
    golden: existsSync(goldenPath) ? JSON.parse(readFileSync(goldenPath, "utf8")) : undefined
  };
}

/** `C0` matches C00..C09; an exact id matches only itself. */
export function selectCases(all: LoadedCase[], filters: string[]): LoadedCase[] {
  if (!filters.length) return all;
  return all.filter((c) => filters.some((f) => c.spec.id === f || c.spec.id.startsWith(f)));
}
