import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { expect } from "vitest";

import { compileBasic } from "../../kbasic/codegen/run-kit";
import { programs } from "../../kbasic/corpus/expectations";

/**
 * The shared back end's output snapshot (`.plans/SHARED_Z80_BACKEND_PLAN.md` §5, Phase 0): every
 * Klive BASIC corpus program compiled at optimisation levels 0-3, with a hash of each artefact the
 * refactoring must keep identical - the generated program text, the assembled bytes of every
 * segment, the source-level debug tables, the classic debug tables and the diagnostics. It only
 * compiles (no machine core), so it belongs to the unit tier; one test file per level
 * (`backend-snapshot-o<n>.test.ts`) lets the levels run in parallel.
 *
 * `BACKEND_SNAPSHOT_UPDATE=1` re-records the goldens; that is a reviewed change, never a fix for a
 * failing phase (plan §1.1).
 */
const CORPUS = join(__dirname, "../../kbasic/corpus");

type Entry = { text: string; bytes: string; sourceLevel: string; classic: string; diagnostics: string[] };

const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex").slice(0, 16);

async function snapshotOf(source: string, optimize: number): Promise<Entry> {
  const { generated, diagnostics } = await compileBasic(source, { optimize });
  const bytes = createHash("sha256");
  for (const s of generated.output.segments) {
    bytes.update(`${s.startAddress}:${s.bank ?? "-"}:${s.bankOffset ?? "-"}:`);
    bytes.update(Uint8Array.from(s.emittedCode));
  }
  const { classic, sourceLevel } = generated.debug;
  return {
    text: hash(generated.emitted.text),
    bytes: bytes.digest("hex").slice(0, 16),
    sourceLevel: hash(JSON.stringify(sourceLevel)),
    classic: hash(JSON.stringify(classic)),
    diagnostics: diagnostics.items.map((d) => `${d.severity} ${d.code} ${d.span.file}:${d.span.start}`)
  };
}

/** Compiles the corpus at one level and compares it with that level's golden (`backend-snapshot-o<level>.golden.json`). */
export async function checkSnapshot(level: number): Promise<void> {
  const golden = join(__dirname, `backend-snapshot-o${level}.golden.json`);
  const actual: Record<string, Entry> = {};
  for (const file of programs(CORPUS)) {
    const name = relative(CORPUS, file).replace(/\\/g, "/");
    actual[name] = await snapshotOf(readFileSync(file, "utf8"), level);
  }
  if (process.env.BACKEND_SNAPSHOT_UPDATE === "1" || !existsSync(golden)) {
    writeFileSync(golden, `${JSON.stringify(actual, null, 1)}\n`);
    return;
  }
  const recorded = JSON.parse(readFileSync(golden, "utf8")) as Record<string, Entry>;
  const changed: string[] = [];
  for (const key of new Set([...Object.keys(recorded), ...Object.keys(actual)])) {
    const a = actual[key];
    const g = recorded[key];
    if (!a || !g) {
      changed.push(`${key}: ${a ? "new" : "missing"}`);
      continue;
    }
    for (const artefact of Object.keys(g) as (keyof Entry)[]) {
      if (JSON.stringify(a[artefact]) !== JSON.stringify(g[artefact])) changed.push(`${key}: ${artefact}`);
    }
  }
  expect(changed, `artefacts that differ from backend-snapshot-o${level}.golden.json`).toEqual([]);
}
