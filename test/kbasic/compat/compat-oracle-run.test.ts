import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it } from "vitest";

import { runBinary } from "../codegen/run-kit";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { itemResult } = require("../../../scripts/kbasic-compat.cjs") as { itemResult(item: { rows?: number }, row: number, line: (row: number) => string): string };

/**
 * The compatibility suites' oracle runner (compatibility plan C2). `scripts/kbasic-compat.cjs oracle`
 * compiles the suites' programs with zxbc into a temporary folder and starts this file with
 * `KBASIC_COMPAT_MANIFEST` naming them; otherwise there is nothing to do. Each program runs on the
 * 48K harness, and what each row shows becomes its item's result in
 * `test/kbasic/compat/oracle/<suite>.json`: only what was printed, never code.
 */
type Manifest = {
  zxbc: string;
  suites: Record<string, { programs: { bin: string; org: number; ids: string[]; rows: number[]; frames?: number }[]; rejected: Record<string, string>; accepted?: string[] }>;
};
export type CompatItemResult = { out: string } | { error: string };
export type CompatOracle = { zxbc: string; items: Record<string, CompatItemResult> };

const MANIFEST = process.env.KBASIC_COMPAT_MANIFEST;

describe.skipIf(!MANIFEST)("compatibility suites: the zxbc oracle", () => {
  const manifest: Manifest = MANIFEST ? JSON.parse(readFileSync(MANIFEST, "utf8")) : { zxbc: "", suites: {} };
  for (const [suite, entry] of Object.entries(manifest.suites)) {
    it(suite, { timeout: 1_800_000 }, async () => {
      const items: Record<string, CompatItemResult> = {};
      for (const [id, error] of Object.entries(entry.rejected)) items[id] = { error };
      for (const id of entry.accepted ?? []) items[id] = { out: "accepted" };
      for (const program of entry.programs) {
        const { session } = await runBinary(new Uint8Array(readFileSync(program.bin)), program.org, { frames: program.frames ?? 300 });
        program.ids.forEach((id, row) => (items[id] = { out: itemResult({ rows: program.rows[row] }, row, (r) => session.screenLine(r)) }));
      }
      const dir = join(__dirname, "oracle");
      mkdirSync(dir, { recursive: true });
      const out: CompatOracle = { zxbc: manifest.zxbc, items };
      writeFileSync(join(dir, `${suite}.json`), JSON.stringify(out, null, 1) + "\n");
    });
  }
});
