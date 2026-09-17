import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { LoadedCase } from "./case";
import { readVerdict } from "./review";
import type { CaseResult } from "./run-case";

/**
 * Locks in the frame hashes of a reviewed run, for one tier.
 *
 * Refuses unless all oracles agree: automated checks green (XFAIL allowed) and a `pass` verdict on
 * file. A core that carries a known failure is *not* approved - that would freeze the bug as the
 * reference picture. Headless results are keyed by core (`ts`, `wasm`); browser results by `browser`
 * (the page runs the WASM core, so WASM known failures block it).
 */
export function approveCase(loaded: LoadedCase, runDir: string, tier: "headless" | "browser" = "headless"): { ok: boolean; message: string } {
  const outDir = tier === "browser" ? join(runDir, loaded.spec.id, "browser") : join(runDir, loaded.spec.id);
  const resultPath = join(outDir, "result.json");
  if (!existsSync(resultPath)) return { ok: false, message: `${loaded.spec.id}: no ${tier} result in ${runDir}` };
  const result = JSON.parse(readFileSync(resultPath, "utf8")) as CaseResult;
  if (result.status !== "pass") return { ok: false, message: `${loaded.spec.id}: run status is ${result.status}` };
  const verdict = readVerdict(outDir);
  if (!verdict) return { ok: false, message: `${loaded.spec.id}: no verdict.json - review it first (${join(outDir, "review.md")})` };
  const corePass = (key: string) => (verdict.cores?.[key] ?? verdict.verdict) === "pass";
  if (!Object.keys(result.hashes).some(corePass)) {
    return { ok: false, message: `${loaded.spec.id}: review verdict is ${verdict.verdict}` };
  }

  const golden: Record<string, Record<string, string>> = { ...((loaded.golden as Record<string, Record<string, string>>) ?? {}) };
  const approved: string[] = [];
  const skipped: string[] = [];
  for (const [key, frames] of Object.entries(result.hashes as Record<string, Record<string, string>>)) {
    const core = key === "browser" ? "wasm" : key;
    if (!corePass(key) || result.checks.some((c) => c.core === core && c.status === "xfail")) {
      skipped.push(key);
      continue;
    }
    golden[key] = frames;
    approved.push(key);
  }
  if (!approved.length) return { ok: false, message: `${loaded.spec.id}: every core has a known failure; nothing to approve` };
  writeFileSync(join(loaded.dir, "golden.json"), JSON.stringify(golden, null, 2) + "\n");
  return {
    ok: true,
    message: `${loaded.spec.id}: approved ${approved.join(", ")}${skipped.length ? ` (not ${skipped.join(", ")}: known failure or review)` : ""}`
  };
}
