import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { discoverCases, selectCases } from "../cases/case";
import { approveCase } from "../cases/golden";
import { assertWasmArtifactFresh, REPO_ROOT } from "../core/machines";
import { readVerdict } from "../cases/review";
import { runCase, type CaseResult } from "../cases/run-case";
import { launchBrowserTier } from "../cases/browser-tier";
import type { ViteDevServer } from "../server/vite-types";

type Options = {
  filters: string[];
  long: boolean;
  approve: boolean;
  list: boolean;
  verbose: boolean;
  tier: "headless" | "browser";
  headed: boolean;
  out?: string;
  run?: string;
};

const HELP = `Usage: npm run test:visual -- [case-id-or-prefix ...] [options]

Runs the visual tests in test/visual/<suite>/<case>/.

Options:
  --tier headless|browser  headless (default): the WASM core in Node, direct NEX load.
                        browser: cases whose tiers include "browser", in your installed Chrome -
                        NextZXOS boots from a clone of ~/Klive/ks2.cim and .nexload's the program
  --headed              browser tier: show the Chrome window
  --long                Also capture each case's longCapture frames
  --out <dir>           Run folder (default .visual-tests/<timestamp>)
  --list                List cases and exit
  --verbose             Also print known failures (XFAIL) with their reasons
  --approve             Approve reviewed cases from a run into golden.json (no emulation;
                        add --tier browser for browser-tier results)
  --run <dir>           Run folder for --approve (default the latest run)
`;

function parseArgs(args: string[]): Options {
  const o: Options = { filters: [], long: false, approve: false, list: false, verbose: false, tier: "headless", headed: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    switch (a) {
      case "--long": o.long = true; break;
      case "--approve": o.approve = true; break;
      case "--list": o.list = true; break;
      case "--verbose": o.verbose = true; break;
      case "--tier": {
        const v = args[++i];
        if (v !== "headless" && v !== "browser") throw new Error(`--tier ${v}? (headless|browser)`);
        o.tier = v;
        break;
      }
      case "--headed": o.headed = true; break;
      case "--out": o.out = args[++i]; break;
      case "--run": o.run = args[++i]; break;
      case "-h": case "--help": console.log(HELP); process.exit(0);
      default:
        if (a.startsWith("-")) throw new Error(`Unknown option ${a}\n\n${HELP}`);
        o.filters.push(a);
    }
  }
  return o;
}

const LATEST = join(REPO_ROOT, ".visual-tests", "LATEST");

const mark: Record<string, string> = { pass: "✓", fail: "✗", xfail: "~", xpass: "!" };

export async function runVisualTestsCli(args: string[], vite: ViteDevServer): Promise<void> {
  const o = parseArgs(args);
  const cases = selectCases(discoverCases(REPO_ROOT), o.filters).filter((c) => o.long || o.list || !c.spec.longOnly);
  if (!cases.length) throw new Error(`No cases match ${o.filters.join(", ")}`);

  if (o.list) {
    for (const c of cases) console.log(`${c.spec.id.padEnd(28)} ${c.spec.title}`);
    return;
  }

  if (o.approve) {
    const runDir = o.run ? resolve(o.run) : existsSync(LATEST) ? readFileSync(LATEST, "utf8").trim() : undefined;
    if (!runDir) throw new Error("No run to approve from; run the tests first or pass --run.");
    let failed = false;
    for (const c of cases) {
      const r = approveCase(c, runDir, o.tier);
      console.log(`${r.ok ? "✓" : "✗"} ${r.message}`);
      failed ||= !r.ok;
    }
    if (failed) process.exitCode = 1;
    return;
  }

  assertWasmArtifactFresh();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outRoot = resolve(o.out ?? join(REPO_ROOT, ".visual-tests", stamp));
  mkdirSync(outRoot, { recursive: true });
  mkdirSync(join(REPO_ROOT, ".visual-tests"), { recursive: true });
  writeFileSync(LATEST, outRoot + "\n");
  console.log(`Tier: ${o.tier}`);

  const results: CaseResult[] = [];
  const selected = o.tier === "browser" ? cases.filter((c) => c.spec.tiers?.includes("browser")) : cases;
  if (!selected.length) throw new Error("No selected case runs on this tier.");
  const browser = o.tier === "browser" ? await launchBrowserTier(vite, { headed: o.headed, log: (s) => console.log(s) }) : undefined;
  try {
  for (const c of selected) {
    const r = browser ? await browser.runCase(c, outRoot, { long: o.long }) : await runCase(c, { long: o.long, outRoot });
    results.push(r);
    const counts = r.checks.reduce<Record<string, number>>((acc, ch) => ((acc[ch.status] = (acc[ch.status] ?? 0) + 1), acc), {});
    const tally = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ");
    console.log(`${r.status === "pass" ? "✓" : "✗"} ${r.id.padEnd(28)} ${tally}; golden ${r.golden.state} (${r.elapsedMs} ms)`);
    for (const ch of r.checks.filter((x) => x.status === "fail" || x.status === "xpass" || (o.verbose && x.status === "xfail"))) {
      const line = `    ${mark[ch.status]} ${[ch.oracle, ch.name].filter(Boolean).join("/")}: ${ch.status === "xfail" ? ch.knownReason : ch.detail}`;
      console.log(line.length > 220 ? line.slice(0, 217) + "..." : line);
    }
    for (const g of r.golden.changes) console.log(`    ✗ golden ${g}`);
  }
  } finally {
    await browser?.close();
  }

  const summary = [
    `# Visual test run ${stamp}`,
    "",
    "| Case | Status | Checks | Golden | Review |",
    "|---|---|---|---|---|",
    ...results.map((r) => {
      const bad = r.checks.filter((c) => c.status !== "pass").map((c) => `${c.status}:${[c.oracle, c.name].filter(Boolean).join("/")}`);
      const needsReview = r.golden.state !== "match";
      const verdict = readVerdict(r.outDir)?.verdict;
      return `| ${r.id} | ${r.status} | ${bad.join("<br>") || "all pass"} | ${r.golden.state} | ${verdict ?? (needsReview ? `needed: \`${r.id}/review.md\`` : "not needed")} |`;
    })
  ];
  writeFileSync(join(outRoot, "summary.md"), summary.join("\n") + "\n");
  writeFileSync(join(outRoot, "summary.json"), JSON.stringify(results, null, 1));

  const failed = results.filter((r) => r.status === "fail");
  const review = results.filter((r) => r.golden.state !== "match");
  if (o.tier === "browser") console.log("Review prompts: <run>/<case>/browser/review.md");
  console.log(`\n${results.length - failed.length}/${results.length} passed. Output: ${outRoot}`);
  if (review.length) console.log(`Needs AI review (${review.length}): ${review.map((r) => r.id).join(", ")} - see summary.md`);
  if (failed.length) process.exitCode = 1;
}
