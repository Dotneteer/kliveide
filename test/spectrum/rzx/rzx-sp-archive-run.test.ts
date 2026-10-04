import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, it } from "vitest";

import { parseRzxFile } from "@common/spectrum/rzx/rzxFile";
import { mapRzxToKlive } from "@common/spectrum/rzx/rzxMapping";
import { rzxCreatorText } from "@common/spectrum/rzx/rzxModel";
import { RzxPlayer } from "@emu/machines/zxSpectrum/rzx/RzxPlayer";
import type { IRzxMachine } from "@emu/machines/zxSpectrum/rzx/rzxSession";
import { createHarnessSpectrumMachine } from "../../harness/sp128";

/**
 * The RZX archive check's runner (`.plans/RZX_PLAN.md` Phase 8). `scripts/rzx-archive-check.cjs`
 * starts this file with `RZX_ARCHIVE_DIR` naming a local folder of `.rzx` files and
 * `RZX_ARCHIVE_REPORT` naming the JSON report to write; otherwise there is nothing to do. Every file
 * plays headless on the real core of the machine it maps to, until it ends, desyncs or is refused.
 * The files are never committed: the RZX Archive has no licence statement (§7).
 */

export type RzxArchiveResult = {
  file: string;
  creator: string;
  outcome: "pass" | "desync" | "refused" | "error";
  machine?: string;
  frames?: number;
  /** The frame that desynced, or that the run stopped at */
  frame?: number;
  message?: string;
  ms: number;
};

const DIR = process.env.RZX_ARCHIVE_DIR;
const REPORT = process.env.RZX_ARCHIVE_REPORT;
/** Long recordings are cut here: a desync after it is not seen (frames; 0 = no limit) */
const MAX_FRAMES = Number(process.env.RZX_ARCHIVE_MAX_FRAMES ?? 0);

function rzxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...rzxFiles(full));
    else if (/\.rzx$/i.test(entry)) out.push(full);
  }
  return out.sort();
}

async function check(path: string): Promise<RzxArchiveResult> {
  const started = Date.now();
  const file = relative(DIR!, path);
  let creator = "unknown creator";
  try {
    const rzx = parseRzxFile(new Uint8Array(readFileSync(path)));
    creator = rzxCreatorText(rzx.creator);
    const { mapping } = mapRzxToKlive(rzx);
    const machine = (await createHarnessSpectrumMachine(mapping.machineId!, mapping.modelIds[0], {})) as unknown as IRzxMachine & {
      executeMachineFrame(): number;
    };
    const player = new RzxPlayer(machine, rzx);
    machine.rzxSession = player;
    player.start();
    while (player.active) {
      machine.executeMachineFrame();
      if (MAX_FRAMES && player.frame >= MAX_FRAMES) break;
    }
    const stop = player.stop;
    const base = { file, creator, machine: mapping.kliveName, frames: player.frames, ms: Date.now() - started };
    if (!stop) return { ...base, outcome: "pass", frame: player.frame, message: `cut at frame ${player.frame}` };
    return {
      ...base,
      outcome: stop.kind === "ended" ? "pass" : "desync",
      frame: stop.frame,
      message: stop.kind === "ended" ? undefined : stop.message
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const refused = err instanceof Error && err.name === "RzxError";
    return { file, creator, outcome: refused ? "refused" : "error", message, ms: Date.now() - started };
  }
}

describe.skipIf(!DIR)("RZX archive check", () => {
  it(
    "plays every recording in the folder",
    async () => {
      const results: RzxArchiveResult[] = [];
      for (const path of rzxFiles(DIR!)) {
        const result = await check(path);
        results.push(result);
        console.log(`${result.outcome.padEnd(7)} ${result.file} (${result.creator})${result.message ? `: ${result.message}` : ""}`);
      }
      if (REPORT) writeFileSync(REPORT, JSON.stringify(results, null, 2));
    },
    24 * 60 * 60 * 1000
  );
});
