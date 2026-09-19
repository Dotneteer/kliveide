import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { LoadedCase } from "./case";
import { readVerdict } from "./review";
import type { CaseResult } from "./run-case";

/**
 * Locks in the frame hashes of a reviewed run, for one tier.
 *
 * Refuses unless all oracles agree: automated checks green (XFAIL allowed) and a `pass` verdict on
 * file. A run that carries a known failure is *not* approved - that would freeze the bug as the
 * reference picture. Headless results are keyed `wasm`, browser results `browser`.
 */
export function approveCase(loaded: LoadedCase, runDir: string, tier: "headless" | "browser" = "headless"): { ok: boolean; message: string } {
  const outDir = tier === "browser" ? join(runDir, loaded.spec.id, "browser") : join(runDir, loaded.spec.id);
  const resultPath = join(outDir, "result.json");
  if (!existsSync(resultPath)) return { ok: false, message: `${loaded.spec.id}: no ${tier} result in ${runDir}` };
  const result = JSON.parse(readFileSync(resultPath, "utf8")) as CaseResult;
  if (result.status !== "pass") return { ok: false, message: `${loaded.spec.id}: run status is ${result.status}` };
  const verdict = readVerdict(outDir);
  if (!verdict) return { ok: false, message: `${loaded.spec.id}: no verdict.json - review it first (${join(outDir, "review.md")})` };
  if (verdict.verdict !== "pass") return { ok: false, message: `${loaded.spec.id}: review verdict is ${verdict.verdict}` };
  if (result.checks.some((c) => c.status === "xfail")) {
    return { ok: false, message: `${loaded.spec.id}: the run has a known failure; nothing to approve` };
  }

  const golden: Record<string, Record<string, string>> = { ...((loaded.golden as Record<string, Record<string, string>>) ?? {}) };
  const approved = Object.keys(result.hashes);
  for (const [key, frames] of Object.entries(result.hashes as Record<string, Record<string, string>>)) golden[key] = frames;
  writeFileSync(join(loaded.dir, "golden.json"), JSON.stringify(golden, null, 2) + "\n");
  return { ok: true, message: `${loaded.spec.id}: approved ${approved.join(", ")}` };
}
