import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { compileBasic, startBasic } from "../codegen/run-kit";
import type { CompatItemResult, CompatOracle } from "./compat-oracle-run.test";

/**
 * The generated compatibility suites (compatibility plan C2, §3.3): every item zxbc's oracle recorded
 * (`test/kbasic/compat/oracle/<suite>.json`) is compiled and run by Klive BASIC and compared on its
 * own - what its row shows, or that both compilers reject it.
 *
 * `baseline.json` lists the items that still differ, with both results. It is a ratchet, like the
 * optimiser's size baseline: an item that differs and is not listed fails, and so does a listed item
 * that now agrees, until `KBASIC_COMPAT_UPDATE=1` rewrites the list. Level 3 must print what level 0
 * prints for every item, whatever zxbc does.
 */
type Item = { id: string; decl: string[]; expr: string };
type Suite = { suite: string; perProgram: number; items: Item[] };
type Diff = { klive: string; zxbc: string };
type Baseline = Record<string, Record<string, Diff>>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const compat = require("../../../scripts/kbasic-compat.cjs") as { buildProgram(items: Item[]): string; chunk(items: Item[], size: number): Item[][] };

const DIR = __dirname;
const BASELINE_FILE = join(DIR, "baseline.json");
const UPDATE = process.env.KBASIC_COMPAT_UPDATE === "1";
const baseline: Baseline = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, "utf8")) : {};
const next: Baseline = {};

const suites: Suite[] = existsSync(join(DIR, "suites"))
  ? readdirSync(join(DIR, "suites"))
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => JSON.parse(readFileSync(join(DIR, "suites", f), "utf8")))
  : [];

const show = (r: CompatItemResult | undefined): string => (!r ? "(nothing)" : "error" in r ? `rejected: ${r.error}` : r.out);

/** Klive BASIC's result for every item: the row it printed, or its compile error. */
async function kliveResults(items: Item[], perProgram: number, level: number): Promise<Record<string, CompatItemResult>> {
  const out: Record<string, CompatItemResult> = {};
  const run = async (group: Item[]): Promise<void> => {
    const source = compat.buildProgram(group);
    try {
      await compileBasic(source, { optimize: level });
    } catch (e) {
      if (group.length === 1) {
        out[group[0].id] = { error: (e as Error).message.replace(/^[^:]*errors: /, "") };
        return;
      }
      // --- One rejected item must not hide the others: halve until it stands alone
      const half = Math.ceil(group.length / 2);
      await run(group.slice(0, half));
      await run(group.slice(half));
      return;
    }
    const { session, done } = await startBasic(source, { optimize: level });
    try {
      session.runTo(done, { maxFrames: 300 });
    } catch (e) {
      if (!/Timed out/.test((e as Error).message)) throw e;
    }
    group.forEach((item, row) => (out[item.id] = { out: session.screenLine(row).trimEnd() }));
  };
  for (const group of compat.chunk(items, perProgram)) await run(group);
  return out;
}

const agrees = (a: CompatItemResult | undefined, b: CompatItemResult | undefined): boolean =>
  !!a && !!b && ("error" in a ? "error" in b : "out" in b && a.out === b.out);

describe("compatibility suites: Klive BASIC against zxbc", () => {
  for (const suite of suites) {
    const oracleFile = join(DIR, "oracle", `${suite.suite}.json`);
    if (!existsSync(oracleFile)) continue;
    it(suite.suite, { timeout: 1_800_000 }, async () => {
      const oracle: CompatOracle = JSON.parse(readFileSync(oracleFile, "utf8"));
      const items = suite.items.filter((i) => oracle.items[i.id]);
      const level0 = await kliveResults(items, suite.perProgram, 0);
      const level3 = await kliveResults(items, suite.perProgram, 3);
      const optimiser = items.filter((i) => show(level0[i.id]) !== show(level3[i.id])).map((i) => `${i.id}: level 0 "${show(level0[i.id])}", level 3 "${show(level3[i.id])}"`);
      expect(optimiser, "level 3 prints what level 0 prints").toEqual([]);

      const diffs: Record<string, Diff> = {};
      for (const item of items) {
        if (!agrees(level0[item.id], oracle.items[item.id])) diffs[item.id] = { klive: show(level0[item.id]), zxbc: show(oracle.items[item.id]) };
      }
      next[suite.suite] = diffs;
      if (UPDATE) return;
      const known = baseline[suite.suite] ?? {};
      const fresh = Object.keys(diffs).filter((id) => !known[id] || known[id].klive !== diffs[id].klive).map((id) => `${id}: Klive "${diffs[id].klive}", zxbc "${diffs[id].zxbc}"`);
      const fixed = Object.keys(known).filter((id) => !diffs[id]);
      expect(fresh, "items that differ from zxbc and are not in the baseline").toEqual([]);
      expect(fixed, "items that now agree: lock them in with KBASIC_COMPAT_UPDATE=1").toEqual([]);
    });
  }

  afterAll(() => {
    if (!UPDATE) return;
    const merged = { ...baseline, ...next };
    const sorted = Object.fromEntries(Object.keys(merged).sort().map((s) => [s, merged[s]]));
    writeFileSync(BASELINE_FILE, JSON.stringify(sorted, null, 1) + "\n");
  });
});
