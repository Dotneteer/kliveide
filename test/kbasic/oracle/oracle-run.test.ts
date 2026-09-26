import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { describe, it } from "vitest";

import { runBinary } from "../codegen/run-kit";
import { readExpectations, type OracleResult } from "../corpus/expectations";

/**
 * The behavioural oracle's runner (plan D12, R9). `scripts/kbasic-oracle.cjs` compiles corpus
 * programs with a locally installed `zxbc` into a temporary folder and starts this file with
 * `KBASIC_ORACLE_MANIFEST` naming them; without it (in CI, in a normal test run) there is nothing to
 * do. Each binary runs on the 48K harness as a corpus program does, and only what was observed is
 * written, to `test/kbasic/oracle/<area>/<name>.json`: never the generated code.
 */
type ManifestEntry = { program: string; source: string; bin?: string; org: number; compileError?: string };
type Manifest = { zxbc: string; entries: ManifestEntry[] };

const MANIFEST = process.env.KBASIC_ORACLE_MANIFEST;

describe.skipIf(!MANIFEST)("behavioural oracle (zxbc)", () => {
  const manifest: Manifest = MANIFEST ? JSON.parse(readFileSync(MANIFEST, "utf8")) : { zxbc: "", entries: [] };

  for (const entry of manifest.entries) {
    it(entry.program, { timeout: 120_000 }, async () => {
      const result: OracleResult = { program: entry.program, zxbc: manifest.zxbc };
      if (entry.compileError || !entry.bin) {
        result.compileError = entry.compileError ?? "no output";
      } else {
        const expectations = readExpectations(readFileSync(entry.source, "utf8"));
        const frames = expectations.find((e) => e.kind === "frames");
        const keys = expectations.find((e) => e.kind === "keys");
        const errorExpected = expectations.some((e) => e.kind === "error");
        const { session, ended } = await runBinary(new Uint8Array(readFileSync(entry.bin)), entry.org, {
          frames: frames?.count ?? (errorExpected ? 100 : 500),
          ...(keys ? { before: (s) => s.keyDown(...keys.keys) } : {})
        });
        result.ended = ended;
        result.screen = Array.from({ length: 24 }, (_, row) => session.screenLine(row).trimEnd());
        const peeks: Record<string, number> = {};
        for (const e of expectations) {
          if (e.kind === "peek") peeks[`peek ${e.address}`] = session.peek(e.address);
          if (e.kind === "peekw") peeks[`peekw ${e.address}`] = session.peekWord(e.address);
        }
        if (Object.keys(peeks).length) result.peeks = peeks;
      }
      const out = join(__dirname, entry.program.replace(/\.zxbas$/, ".json"));
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
    });
  }
});
