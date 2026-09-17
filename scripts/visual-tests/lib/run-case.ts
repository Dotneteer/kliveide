import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { captureFrame, frameHash, framePng, summarizeRows, type Frame } from "./capture";
import { READY_REG, READY_VALUE, type CaseSpec, type KnownFailure, type LoadedCase, type OracleName } from "./case";
import { compileNexFile } from "./compile-nex";
import { contactSheet, diffPng } from "./images";
import { loadNexDirect } from "./load-nex-direct";
import { createCore, runDisplayedFrame, type CoreName } from "./machines";
import { evaluateMotions, motionFrames } from "./motion";
import { diffFrames, evaluateProbe, probeName } from "./probes";
import { writeReviewPrompt } from "./review";

export type CheckStatus = "pass" | "fail" | "xfail" | "xpass";

export type CheckResult = {
  oracle: OracleName;
  core?: CoreName;
  name?: string;
  status: CheckStatus;
  detail: string;
  knownReason?: string;
};

export type GoldenState = { state: "none" | "match" | "changed"; changes: string[] };

export type CaseResult = {
  id: string;
  title: string;
  status: "pass" | "fail";
  checks: CheckResult[];
  golden: GoldenState;
  hashes: Partial<Record<CoreName, Record<string, string>>>;
  outDir: string;
  images: string[];
  directLoadDifferences: string[];
  elapsedMs: number;
};

export type RunCaseOptions = {
  cores: CoreName[];
  long?: boolean;
  outRoot: string;
  /**
   * Test seam: called with each displayed frame before it is stored. The harness's own mutation
   * tests use it to plant a defect and prove the oracles notice.
   */
  tamper?: (core: CoreName, frameNo: number, frame: Frame) => void;
};

export function framesOf(spec: CaseSpec, long: boolean): { png: number[]; all: Set<number>; last: number } {
  const png = [...spec.capture, ...(long ? spec.longCapture ?? [] : [])];
  const all = new Set<number>(png);
  for (const m of spec.motion ?? []) for (const f of motionFrames(m)) all.add(f);
  for (const f of spec.contactSheet?.frames ?? []) all.add(f);
  for (const p of spec.probes ?? []) for (const f of p.frames ?? []) all.add(f);
  const readyBy = spec.readyBy ?? 10;
  const last = Math.max(readyBy, ...all);
  return { png: [...new Set(png)].sort((a, b) => a - b), all, last };
}

export function readNextRegDirect(machine: ZxNextMachine, reg: number): number {
  return machine instanceof ZxNextWasmV2Machine
    ? machine.wasmV2Runtime!.exports.zxnextGetNextRegisterDirect(reg)
    : machine.nextRegDevice.directGetRegValue(reg);
}

export function judge(
  known: KnownFailure[],
  oracle: OracleName,
  core: CoreName | undefined,
  name: string | undefined,
  pass: boolean,
  detail: string
): CheckResult {
  const k = known.find(
    (kf) => kf.oracle === oracle && (kf.core === undefined || kf.core === core) && (kf.name === undefined || kf.name === name)
  );
  const status: CheckStatus = k ? (pass ? "xpass" : "xfail") : pass ? "pass" : "fail";
  return { oracle, core, name, status, detail, knownReason: k?.reason };
}

export const pad = (f: number) => String(f).padStart(5, "0");

/** One displayed frame of a case on a headless core, for comparing against another tier. */
export async function renderHeadlessFrame(loaded: LoadedCase, core: CoreName, frameNo: number): Promise<Frame> {
  const nex = await compileNexFile(loaded.programPath);
  const machine = await createCore(core);
  loadNexDirect(machine, nex.contents);
  let frame: Frame | undefined;
  for (let f = 1; f <= frameNo; f++) runDisplayedFrame(machine, () => { if (f === frameNo) frame = captureFrame(machine); });
  return frame!;
}

export type EvaluatedFrames = { checks: CheckResult[]; images: string[]; hashes: Record<string, string> };

/**
 * The per-core oracles and artefacts, shared by both tiers: PNGs and row summaries of the capture
 * frames, the contact sheet, probes, motion and the static-screen check. `dir` receives the files;
 * `label` names them (`ts/frame-00050.png`, `browser/frame-00050.png`).
 */
export async function evaluateFrames(
  spec: CaseSpec,
  core: CoreName,
  frames: Map<number, Frame>,
  pngFrames: number[],
  outDir: string,
  label: string
): Promise<EvaluatedFrames> {
  const known = spec.knownFailures ?? [];
  const checks: CheckResult[] = [];
  const images: string[] = [];
  const hashes: Record<string, string> = {};

  mkdirSync(join(outDir, label), { recursive: true });
  for (const f of pngFrames) {
    const frame = frames.get(f);
    if (!frame) continue;
    hashes[String(f)] = frameHash(frame);
    const png = join(outDir, label, `frame-${pad(f)}.png`);
    writeFileSync(png, await framePng(frame));
    writeFileSync(join(outDir, label, `rows-${pad(f)}.json`), JSON.stringify(summarizeRows(frame), null, 1));
    images.push(png);
  }
  if (spec.contactSheet && spec.contactSheet.frames.every((f) => frames.has(f))) {
    const sheet = join(outDir, `contact-sheet-${label}.png`);
    writeFileSync(sheet, await contactSheet(spec.contactSheet.frames.map((f) => ({ frame: f, image: frames.get(f)! })), spec.contactSheet.columns));
    images.push(sheet);
  }

  // --- Oracle 1: probes
  (spec.probes ?? []).forEach((probe, index) => {
    const name = probeName(probe, index);
    const targets = (probe.frames ?? pngFrames).filter((f) => frames.has(f));
    const outcomes = targets.map((f) => ({ f, ...evaluateProbe(probe, frames.get(f)!) }));
    const bad = outcomes.filter((o) => !o.pass);
    // --- A static screen fails identically in every frame: say it once, with the frame list.
    const byDetail = new Map<string, number[]>();
    for (const o of bad) byDetail.set(o.detail, [...(byDetail.get(o.detail) ?? []), o.f]);
    checks.push(
      judge(known, "probes", core, name, outcomes.length > 0 && bad.length === 0,
        !outcomes.length
          ? "no captured frame to probe"
          : bad.length
            ? [...byDetail.entries()].slice(0, 2).map(([d, fs]) => `frame ${fs.join(",")}: ${d}`).join(" | ")
            : `${outcomes.length} frame(s): ${outcomes[0].detail}`)
    );
  });

  // --- Motion
  if (spec.motion?.length) {
    const outcomes = evaluateMotions(spec.motion, frames);
    writeFileSync(join(outDir, `motion-${label}.json`), JSON.stringify(outcomes, null, 1));
    for (const o of outcomes) checks.push(judge(known, "motion", core, o.name, o.pass, o.detail));
  }

  // --- Static screen: identical across captured frames
  if (spec.expectIdenticalFrames) {
    const distinct = new Map<string, number[]>();
    for (const [f, h] of Object.entries(hashes)) distinct.set(h, [...(distinct.get(h) ?? []), Number(f)]);
    checks.push(
      judge(known, "identical", core, undefined, distinct.size === 1,
        distinct.size === 1
          ? `frames ${pngFrames.join(", ")} identical`
          : `${distinct.size} distinct images: ${[...distinct.values()].map((fs) => `[${fs.join(",")}]`).join(" ")}`)
    );
  }
  return { checks, images, hashes };
}

export async function runCase(loaded: LoadedCase, options: RunCaseOptions): Promise<CaseResult> {
  const started = Date.now();
  const { spec } = loaded;
  const outDir = join(options.outRoot, spec.id);
  mkdirSync(outDir, { recursive: true });
  const known = spec.knownFailures ?? [];
  const checks: CheckResult[] = [];
  const images: string[] = [];
  const hashes: CaseResult["hashes"] = {};
  const plan = framesOf(spec, !!options.long);

  const nex = await compileNexFile(loaded.programPath);
  writeFileSync(join(outDir, "program.nex"), nex.bytes);

  const captured = new Map<CoreName, Map<number, Frame>>();
  let directLoadDifferences: string[] = [];

  for (const core of options.cores) {
    const machine = await createCore(core);
    directLoadDifferences = loadNexDirect(machine, nex.contents).differencesFromNexload;
    const frames = new Map<number, Frame>();
    captured.set(core, frames);
    let readyAt: number | undefined;

    for (let f = 1; f <= plan.last; f++) {
      runDisplayedFrame(machine, () => {
        if (!plan.all.has(f)) return;
        const frame = captureFrame(machine);
        options.tamper?.(core, f, frame);
        frames.set(f, frame);
      });
      if (readyAt === undefined && readNextRegDirect(machine, READY_REG) === READY_VALUE) readyAt = f;
    }

    const readyBy = spec.readyBy ?? 10;
    checks.push(
      judge(known, "ready", core, undefined, readyAt !== undefined && readyAt <= readyBy,
        readyAt === undefined
          ? `the program never wrote $A5 to NextReg $7F in ${plan.last} frames (PC=$${machine.pc.toString(16)})`
          : `ready at frame ${readyAt} (required by ${readyBy})`)
    );

    const evaluated = await evaluateFrames(spec, core, frames, plan.png, outDir, core);
    checks.push(...evaluated.checks);
    images.push(...evaluated.images);
    hashes[core] = evaluated.hashes;
  }

  // --- Oracle 2: core parity
  if ((spec.coreParity ?? "exact") === "exact" && captured.has("ts") && captured.has("wasm")) {
    const ts = captured.get("ts")!;
    const wasm = captured.get("wasm")!;
    const mismatches: string[] = [];
    let diffWritten = false;
    for (const f of [...plan.all].sort((a, b) => a - b)) {
      const d = diffFrames(ts.get(f)!, wasm.get(f)!);
      if (!d.differing) continue;
      mismatches.push(
        `frame ${f}: ${d.differing} px in x${d.box?.x.join("-")} y${d.box?.y.join("-")}, first (${d.first?.x},${d.first?.y}) ts ${d.first?.a} wasm ${d.first?.b}`
      );
      if (!diffWritten) {
        const png = join(outDir, `diff-ts-wasm-${pad(f)}.png`);
        writeFileSync(png, await diffPng(ts.get(f)!, wasm.get(f)!));
        images.push(png);
        diffWritten = true;
      }
    }
    checks.push(
      judge(known, "parity", undefined, undefined, mismatches.length === 0,
        mismatches.length ? `${mismatches.length} frame(s) differ; ${mismatches.slice(0, 2).join(" | ")}` : `${plan.all.size} frame(s) identical`)
    );
  }

  const golden = compareGolden(loaded, options.cores, hashes);
  const failed = checks.some((c) => c.status === "fail" || c.status === "xpass") || golden.state === "changed";
  const result: CaseResult = {
    id: spec.id,
    title: spec.title,
    status: failed ? "fail" : "pass",
    checks,
    golden,
    hashes,
    outDir,
    images,
    directLoadDifferences,
    elapsedMs: Date.now() - started
  };
  writeFileSync(join(outDir, "result.json"), JSON.stringify(result, null, 1));
  writeReviewPrompt(loaded, result);
  return result;
}

/** Golden hashes are approved per core (`ts`, `wasm`) or tier (`browser`). */
export function compareGolden(loaded: LoadedCase, keys: string[], hashes: Record<string, Record<string, string>>): GoldenState {
  const golden: GoldenState = { state: "none", changes: [] };
  const approved = loaded.golden as Record<string, Record<string, string>> | undefined;
  if (!approved || !keys.some((k) => approved[k])) return golden;
  golden.state = "match";
  for (const key of keys) {
    for (const [frame, hash] of Object.entries(approved[key] ?? {})) {
      const now = hashes[key]?.[frame];
      if (now !== undefined && now !== hash) golden.changes.push(`${key} frame ${frame}: approved ${hash}, now ${now}`);
    }
  }
  if (golden.changes.length) golden.state = "changed";
  return golden;
}
