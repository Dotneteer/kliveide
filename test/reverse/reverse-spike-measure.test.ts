/*
 * The reverse-debugging spike's measurements (`.plans/REVERSE_DEBUGGING_PLAN.md` Phase 0 (a)-(c)):
 * page-shared keyframe cost, T5's render-buffer classification and replay time, on three workloads
 * per machine. Behind a dev flag - it runs only with `KLIVE_REVERSE_SPIKE=1`:
 *
 *   KLIVE_REVERSE_SPIKE=1 npm test -- test/reverse/reverse-spike-measure.test.ts
 *
 * Optional: `KLIVE_WASM_MAP_DIR=<folder>` (set it for the core builds as well) attributes changed
 * pages to the core's statics; `KLIVE_REVERSE_SPIKE_OUT=<file.json>` writes the raw results. The
 * NextZXOS workload needs `~/Klive/ks2.cim` (cloned, never written) and is skipped without it.
 */
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { BinaryReader } from "@common/utils/BinaryReader";
import { TapReader } from "@emu/machines/tape/TapReader";
import { sp48TapeLoadFlow } from "@emu/machines/tapeLoadFlows";
import { KEYFRAME_PAGE_SIZE, type KeyframeStore, type MemoryRange } from "@emu/machines/reverse/KeyframeStore";
import type { TimelinePosition } from "@emu/machines/reverse/timelinePosition";
import { CimHandler } from "@main/fat32/CimHandlers";
import { createSp48Session } from "../harness/sp48";
import { createSession as createNextSession } from "../harness/zxnext";
import type { SdCardBacking } from "../harness/zxnext/script/sd-card";
import { ReverseRig, seededRandom, type SpikeCoreId } from "../harness/reverseSupport";
import { Timeline, type TimelineMachine } from "@emu/machines/reverse/Timeline";
import { comparePositions } from "@emu/machines/reverse/timelinePosition";

const ENABLED = process.env.KLIVE_REVERSE_SPIKE === "1";
const ROOT = join(__dirname, "../..");

/** Keyframe interval, in frames (D5's default; `KLIVE_REVERSE_SPIKE_K` overrides it) */
const K = Number(process.env.KLIVE_REVERSE_SPIKE_K ?? 25);
/** Frames measured per workload: 60 s at 50 Hz */
const MEASURED_FRAMES = 3000;
/** Random step-back targets per workload */
const STEP_BACK_SAMPLES = 60;
const FRAME_MS = 20;

type Workload = {
  name: string;
  coreId: SpikeCoreId;
  /** Builds and prepares the machine; returns the rig and a per-frame driver */
  setup(): Promise<Session>;
};

type Session = {
  rig: ReverseRig;
  /** The machine itself, for a real `Timeline` (the session measurement) */
  machine: TimelineMachine & { frameJustCompleted: boolean };
  /** Runs one frame the way the emulator does (input included) */
  frame(index: number): Promise<void>;
  /** A fresh machine of the same kind for replay */
  replayMachine(): Promise<ReverseRig>;
  /** The SD calls so far (the NextZXOS workload), to leave intervals with SD traffic out of replay */
  sdCalls?(): number;
  dispose?(): void;
};

// ------------------------------------------------------------------------------------------------
// Statistics

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0);
  const mean = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
  return { n: sorted.length, mean, p50: at(0.5), p90: at(0.9), max: sorted[sorted.length - 1] ?? 0 };
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// ------------------------------------------------------------------------------------------------
// Symbol attribution (optional: the linker map the build left in KLIVE_WASM_MAP_DIR)

type Sym = { symbol: string; address: number; size: number };

function loadSymbols(prefixes: string[], check: { symbol: string; address: number }): Sym[] | undefined {
  const dir = process.env.KLIVE_WASM_MAP_DIR;
  if (!dir || !existsSync(dir)) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { parseLinkerMap } = require(join(ROOT, "scripts/wasm-layout.cjs"));
  for (const prefix of prefixes) {
    for (const file of readdirSync(dir).filter((f) => f.startsWith(prefix))) {
      const symbols = (parseLinkerMap(readFileSync(join(dir, file), "utf8")).symbols as Sym[]).filter((s) => !s.symbol.startsWith("."));
      if (symbols.some((s) => s.symbol === check.symbol && s.address === check.address)) return symbols;
    }
  }
  return undefined;
}

/** The static holding a byte, or where it lies when no static does */
function symbolAt(symbols: Sym[] | undefined, address: number): string {
  if (!symbols) return "?";
  for (const s of symbols) if (address >= s.address && address < s.address + Math.max(1, s.size)) return s.symbol;
  return "(stack/heap)";
}

/** The statics whose bytes differ between two images, with the number of differing bytes */
function differingSymbols(symbols: Sym[] | undefined, a: Uint8Array, b: Uint8Array, skip: MemoryRange[] = []): Map<string, number> {
  const out = new Map<string, number>();
  const skipped = (i: number) => skip.some((r) => i >= r.address && i < r.address + r.size);
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i] && !skipped(i)) {
      const name = symbolAt(symbols, i);
      out.set(name, (out.get(name) ?? 0) + 1);
    }
  }
  return out;
}

function rangesOf(symbols: Sym[] | undefined, names: string[]): { name: string; range: MemoryRange }[] {
  if (!symbols) return [];
  return names.flatMap((name) => {
    const s = symbols.find((x) => x.symbol === name);
    return s ? [{ name, range: { address: s.address, size: s.size } }] : [];
  });
}

// ------------------------------------------------------------------------------------------------
// The measurement

type Result = Record<string, unknown>;
const results: Result[] = [];

async function measure(w: Workload, candidates: string[]): Promise<Result> {
  const session = await w.setup();
  const rig = session.rig;
  // --- The same workload's frame time with the recorder off: what recording costs (T9)
  rig.port.setEnabled(false);
  const plainMs: number[] = [];
  for (let f = 0; f < 100; f++) {
    const t0 = performance.now();
    await session.frame(f);
    plainMs.push(performance.now() - t0);
  }
  const pcAfterSetup = (rig as unknown as { raw: Record<string, () => number> }).raw[w.coreId === "sp48" ? "sp48GetCpuPc" : "zxnextGetCpuPc"]();
  rig.port.setEnabled(true);
  const exports = (rig as unknown as { raw: Record<string, () => number> }).raw;
  const symbols =
    w.coreId === "sp48"
      ? loadSymbols(["harness-sp48", "zx-spectrum48"], { symbol: "sp48PixelBuffer", address: exports.sp48PixelBufferPtr() })
      : loadSymbols(["zx-spectrum-next"], { symbol: "zxnextPixelBuffer", address: exports.zxnextPixelBufferPtr() });

  const store = rig.createStore(Number.MAX_SAFE_INTEGER);
  // --- The same keyframes without T5's candidates, to see what leaving them out would save
  const candidateRanges = rangesOf(symbols, candidates);
  const lean = rig.createStore(
    Number.MAX_SAFE_INTEGER,
    candidateRanges.map((c) => c.range)
  );
  const frameMs: number[] = [];
  const sdAtKeyframe: number[] = [];
  // --- Which statics change between keyframes, in bytes (sampled: every 10th keyframe interval)
  const changedBySymbol = new Map<string, number>();
  let sampledIntervals = 0;
  let previousImage: Uint8Array | undefined;
  for (let f = 0; f < MEASURED_FRAMES; f++) {
    if (f % K === 0) {
      const seed = rig.port.captureSeed();
      store.capture(rig.memory.buffer, seed, rig.frames, rig.journal.length);
      lean.capture(rig.memory.buffer, seed, rig.frames, rig.journal.length);
      sdAtKeyframe.push(session.sdCalls?.() ?? 0);
      const index = f / K;
      if (index % 10 === 1 && previousImage) {
        for (const [name, n] of differingSymbols(symbols, previousImage, rig.image())) {
          changedBySymbol.set(name, (changedBySymbol.get(name) ?? 0) + n);
        }
        sampledIntervals++;
      }
      previousImage = index % 10 === 0 ? rig.image() : undefined;
    }
    const t0 = performance.now();
    await session.frame(f);
    frameMs.push(performance.now() - t0);
  }
  const keyframes = store.keyframes;
  const later = keyframes.slice(1);
  const newPages = stats(later.map((k) => k.newPages));
  const leanNewPages = stats(lean.keyframes.slice(1).map((k) => k.newPages));
  const capture = stats(later.map((k) => k.captureMs));
  const baseBytes = keyframes[0].newPages * KEYFRAME_PAGE_SIZE;
  const bytesPerSecond = (newPages.mean * KEYFRAME_PAGE_SIZE) / ((K * FRAME_MS) / 1000);
  const leanBytesPerSecond = (leanNewPages.mean * KEYFRAME_PAGE_SIZE) / ((K * FRAME_MS) / 1000);
  const seconds = (budgetMb: number, base: number, perSecond: number) =>
    perSecond > 0 ? round((budgetMb * 1024 * 1024 - base) / perSecond, 0) : Infinity;

  // --- Replay on a separate machine: every interval end-to-end (D9's check), then random step backs
  const replayRig = await session.replayMachine();
  replayRig.port.setEnabled(true);
  const engine = replayRig.createEngine(store, rig.journal);
  const intervalMs: number[] = [];
  const restoreMs: number[] = [];
  // --- Intervals with SD traffic replay too: the journal holds the sector data (Phase 6, D14)
  let intervalsWithSd = 0;
  let intervalsDiverged = 0;
  const replayable: number[] = [];
  for (let k = 0; k + 1 < keyframes.length; k++) {
    if (sdAtKeyframe[k + 1] !== sdAtKeyframe[k]) intervalsWithSd++;
    const t0 = performance.now();
    const { result, diffPages } = engine.verifyInterval(keyframes[k], keyframes[k + 1]);
    intervalMs.push(performance.now() - t0);
    restoreMs.push(result.restoreMs);
    if (diffPages.length) intervalsDiverged++;
    replayable.push(k);
  }
  const stepBackMs: number[] = [];
  const rnd = seededRandom(4242);
  for (let i = 0; i < STEP_BACK_SAMPLES && replayable.length; i++) {
    const k = replayable[Math.floor(rnd() * replayable.length)];
    const from = keyframes[k].seed.position.sequence;
    const to = keyframes[k + 1].seed.position.sequence;
    const target: TimelinePosition = { sequence: from + 1 + Math.floor(rnd() * Math.max(1, to - from - 1)), sub: 1, phase: 0 };
    const t0 = performance.now();
    engine.replayTo(target, { from: keyframes[k] });
    stepBackMs.push(performance.now() - t0);
  }

  // --- T5: restore with a candidate filled with garbage, replay an interval, and compare with the
  // --- next keyframe byte by byte. Garbage reaching any other static means the core reads the buffer
  // --- across the frame boundary; garbage left in the buffer itself means the core does not rewrite
  // --- all of it in an interval (what is left shows on screen, D18).
  const t5: Record<string, string> = {};
  const probeIntervals = replayable.filter((_, i) => i % Math.max(1, Math.floor(replayable.length / 6)) === 0).slice(0, 6);
  const expected = new ArrayBuffer(replayRig.memory.buffer.byteLength);
  const excluded = rig.layout.volatile.map((v) => ({ address: v.address, size: v.size }));
  for (const c of candidateRanges) {
    let readElsewhere = new Map<string, number>();
    let leftInBuffer = 0;
    for (const k of probeIntervals) {
      // --- By hand rather than `replayTo`, which would restore over the garbage
      engine.restore(keyframes[k]);
      new Uint8Array(replayRig.memory.buffer, c.range.address, c.range.size).fill(0xa5);
      runInterval(engine, keyframes, k);
      new Uint8Array(expected).fill(0);
      store.restore(keyframes[k + 1], expected);
      const live = new Uint8Array(replayRig.memory.buffer);
      const want = new Uint8Array(expected);
      const elsewhere = differingSymbols(symbols, live, want, [...excluded, c.range]);
      for (const [name, n] of elsewhere) readElsewhere.set(name, (readElsewhere.get(name) ?? 0) + n);
      for (let i = c.range.address; i < c.range.address + c.range.size; i++) if (live[i] !== want[i]) leftInBuffer++;
      if (readElsewhere.size) break;
    }
    t5[c.name] = !probeIntervals.length
      ? "not probed"
      : readElsewhere.size
        ? `READ across the boundary (garbage reached ${[...readElsewhere.keys()].join(", ")})`
        : leftInBuffer
          ? `not read; ${leftInBuffer} bytes not rewritten in ${probeIntervals.length} intervals`
          : "not read; fully rewritten";
    readElsewhere = new Map();
  }

  const top = [...changedBySymbol.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const result: Result = {
    workload: w.name,
    core: w.coreId,
    pcAfterSetup: pcAfterSetup.toString(16),
    imagePages: store.stats.storedPagesPerKeyframe,
    keyframes: keyframes.length,
    frameMs: round(stats(frameMs).mean, 3),
    frameMsWithoutHistory: round(stats(plainMs).mean, 3),
    k: K,
    captureMs: { mean: round(capture.mean), p90: round(capture.p90), max: round(capture.max) },
    capturePctOfFramePeriod: round((capture.mean / (K * FRAME_MS)) * 100, 3),
    capturePctOfEmulation: round((capture.mean / (K * stats(frameMs).mean)) * 100, 2),
    newPages: { mean: round(newPages.mean, 1), p90: newPages.p90, max: newPages.max },
    newPagesWithoutT5: { mean: round(leanNewPages.mean, 1), p90: leanNewPages.p90, max: leanNewPages.max },
    baseKeyframeMb: round(baseBytes / 1048576),
    mbPerMinute: round((bytesPerSecond * 60) / 1048576, 1),
    seconds512: seconds(512, baseBytes, bytesPerSecond),
    seconds256: seconds(256, baseBytes, bytesPerSecond),
    seconds512WithoutT5: seconds(512, lean.keyframes[0].newPages * KEYFRAME_PAGE_SIZE, leanBytesPerSecond),
    intervalReplayMs: (() => {
      const s = stats(intervalMs);
      return { mean: round(s.mean, 1), p90: round(s.p90, 1), max: round(s.max, 1) };
    })(),
    restoreMs: round(stats(restoreMs).mean),
    stepBackMs: (() => {
      const s = stats(stepBackMs);
      return { p50: round(s.p50, 1), p90: round(s.p90, 1), max: round(s.max, 1) };
    })(),
    intervalsReplayed: intervalMs.length,
    intervalsWithSd,
    intervalsDiverged,
    journalEntries: rig.journal.length,
    changedBytesPerInterval: Object.fromEntries(top.map(([k, v]) => [k, Math.round(v / Math.max(1, sampledIntervals))])),
    t5
  };
  results.push(result);
  session.dispose?.();
  return result;
}

/** Replays one keyframe interval on the live (already restored) core */
function runInterval(engine: ReturnType<ReverseRig["createEngine"]>, keyframes: readonly { seed: { position: TimelinePosition }; journalIndex: number }[], k: number): void {
  const e = engine as unknown as { journal: { entries: { position: TimelinePosition }[] }; core: { apply(e: unknown): void } };
  const end = keyframes[k + 1];
  for (let i = keyframes[k].journalIndex; i < end.journalIndex; i++) {
    const entry = e.journal.entries[i];
    engine.runTo(entry.position);
    e.core.apply(entry);
  }
  engine.runTo(end.seed.position);
}

// ------------------------------------------------------------------------------------------------
// Workloads

function tapBlocks(path: string) {
  const reader = new TapReader(new BinaryReader(new Uint8Array(readFileSync(path))));
  if (reader.readContent()) throw new Error(`Cannot read ${path}`);
  return reader.dataBlocks;
}

const YANKEE = join(ROOT, "_input/A Yankee in Iraq v1.3.3.tap");
const GAME_KEYS_48 = ["Q", "A", "O", "P", "Space", "M", "N1", "Enter"];

/** A player: a key goes down or up every few frames */
function player(rnd: () => number, keys: string[], press: (k: string, down: boolean) => void) {
  const held = new Set<string>();
  return (f: number) => {
    if (f % 7 !== 0) return;
    const key = keys[Math.floor(rnd() * keys.length)];
    const down = !held.has(key);
    if (down) held.add(key);
    else held.delete(key);
    press(key, down);
  };
}

async function sp48Booted() {
  const s = await createSp48Session();
  s.bootToBasic();
  return s;
}

const sp48Replay = async () => new ReverseRig("sp48", (await createSp48Session()).machine);

const workloads48: Workload[] = [
  {
    name: "48K game (A Yankee in Iraq, playing)",
    coreId: "sp48",
    async setup() {
      const s = await sp48Booted();
      s.insertTape(tapBlocks(YANKEE));
      s.typeFlowKeys(sp48TapeLoadFlow(), { gap: 8 });
      s.runFrames(1500);
      const rig = new ReverseRig("sp48", s.machine);
      const play = player(seededRandom(1), GAME_KEYS_48, (k, d) => (d ? s.keyDown(k) : s.keyUp(k)));
      return {
        rig,
        machine: s.machine,
        frame: async (f) => {
          play(f);
          s.runFrames(1);
        },
        replayMachine: sp48Replay
      };
    }
  },
  {
    name: "48K BASIC (FOR loop printing)",
    coreId: "sp48",
    async setup() {
      const s = await sp48Booted();
      // --- 10 FOR I=1 TO 1E9: PRINT AT 0,0;I: NEXT I, then RUN
      const k = (...c: string[]) => c;
      s.typeKeys([
        k("N1"), k("N0"), k("F"), k("I"), k("SShift", "L"), k("N1"), k("SShift", "F"), k("N1"), k("E"), k("N9"),
        k("SShift", "Z"), k("P"), k("SShift", "I"), k("N0"), k("SShift", "N"), k("N0"), k("SShift", "O"), k("I"),
        k("SShift", "Z"), k("N"), k("I"), k("Enter"), k("R"), k("Enter")
      ]);
      s.runFrames(50);
      return { rig: new ReverseRig("sp48", s.machine), machine: s.machine, frame: async () => void s.runFrames(1), replayMachine: sp48Replay };
    }
  },
  {
    name: "48K tape loading at normal speed",
    coreId: "sp48",
    async setup() {
      const s = await sp48Booted();
      s.insertTape(tapBlocks(YANKEE), { fastLoad: false });
      s.typeFlowKeys(sp48TapeLoadFlow(), { gap: 8 });
      return { rig: new ReverseRig("sp48", s.machine), machine: s.machine, frame: async () => void s.runFrames(1), replayMachine: sp48Replay };
    }
  }
];

const nextReplay = async () => new ReverseRig("zxnext", (await createNextSession()).machine);
const NEXT_KEYS = ["Q", "A", "O", "P", "SPACE", "M", "1", "ENTER"];

// --- The real home: the test setup points HOME at a scratch folder
const KS2 = process.env.KLIVE_REVERSE_SPIKE_CIM ?? join(userInfo().homedir, "Klive", "ks2.cim");

/** The developer's card, cloned (never written): `server/sd-session.ts`'s rule */
function cimBacking(): { backing: SdCardBacking; dispose(): void } {
  const folder = mkdtempSync(join(tmpdir(), "klive-reverse-spike-"));
  const clone = join(folder, "ks2.cim");
  copyFileSync(KS2, clone);
  const card = new CimHandler(clone);
  const info = card.cimInfo;
  return {
    backing: {
      totalSectors: (info.maxSize * 2048) / info.sectorSize,
      readSector: (sector) => card.readSector(sector),
      writeSector: (sector, data) => card.writeSector(sector, data)
    },
    dispose: () => rmSync(folder, { recursive: true, force: true })
  };
}

/*
 * A worst case for page sharing: the whole 48K of Layer 2 rewritten as fast as a 28 MHz Z80 can
 * (about once a frame), so every Layer 2 page changes between keyframes.
 */
const LAYER2_STRESS = `
      .org $8000
start:
      nextreg $07,3
      nextreg $12,9
      ld bc,$123b
      ld a,2
      out (c),a
      ld e,0
frame:
      ld d,18
page:
      ld a,d
      nextreg $57,a
      ld hl,$e000
      ld a,e
fill:
      ld (hl),a
      inc a
      inc l
      jr nz,fill
      inc h
      jr nz,fill
      inc d
      ld a,d
      cp 24
      jr nz,page
      inc e
      jr frame
`;

function nextProgram(name: string, load: (s: Awaited<ReturnType<typeof createNextSession>>) => Promise<unknown>): Workload {
  return {
    name,
    coreId: "zxnext",
    async setup() {
      const s = await createNextSession();
      await load(s);
      s.runFrames(50);
      const play = player(seededRandom(2), NEXT_KEYS, (k, d) => (d ? s.keyDown(k as never) : s.keyUp(k as never)));
      return {
        rig: new ReverseRig("zxnext", s.machine),
        machine: s.machine,
        frame: async (f) => {
          play(f);
          // --- The machine's own frame, without the harness's per-frame screen capture
          do s.machine.executeMachineFrame();
          while (!s.machine.frameJustCompleted);
        },
        replayMachine: nextReplay
      };
    }
  };
}

const workloadsNext: Workload[] = [
  nextProgram("Next demo (PAR-005: Copper, line interrupt, sprite, Layer 2 scroll)", (s) =>
    s.loadProgramFile(join(ROOT, "test/visual/parity/PAR-005-demo-raster/program.asm"))
  ),
  nextProgram("Next Layer 2 rewritten every frame (worst case)", (s) => s.loadCode(LAYER2_STRESS)),
  {
    name: "Next NextZXOS (boot from the SD card, then the menu)",
    coreId: "zxnext",
    async setup() {
      const s = await createNextSession();
      const card = cimBacking();
      s.attachSdCard(card.backing);
      await s.runFramesAsync(300);
      const play = player(seededRandom(3), ["UP", "DOWN", "ENTER", "SPACE"] as string[], (k, d) => (d ? s.keyDown(k as never) : s.keyUp(k as never)));
      return {
        rig: new ReverseRig("zxnext", s.machine),
        machine: s.machine,
        frame: async (f) => {
          play(f);
          await s.runFramesAsync(1);
        },
        replayMachine: nextReplay,
        sdCalls: () => Object.values(s.sdCalls).reduce((a, b) => a + b, 0),
        dispose: card.dispose
      };
    }
  }
];

const CANDIDATES_48 = ["sp48PixelBuffer", "sp48AudioSamples", "sp48AudioTransitionTacts", "sp48AudioTransitionMic"];
const CANDIDATES_NEXT = [
  "zxnextPixelBuffer",
  "zxnextLayerUla",
  "zxnextLayerTm",
  "zxnextLayerL2",
  "zxnextLayerSpr",
  "zxnextUlaSpriteCoverage",
  "zxnextBeeperTransitionTacts"
];

describe.skipIf(!ENABLED)("reverse debugging spike: measurements", () => {
  for (const w of workloads48) {
    it(w.name, async () => {
      if (!existsSync(YANKEE)) return;
      const r = await measure(w, CANDIDATES_48);
      expect(r.intervalsDiverged).toBe(0);
    }, 600_000);
  }
  for (const w of workloadsNext) {
    it(w.name, async () => {
      if (w.name.includes("NextZXOS") && !existsSync(KS2)) return;
      const r = await measure(w, CANDIDATES_NEXT);
      expect(r.intervalsDiverged).toBe(0);
    }, 900_000);
  }
  afterAll(() => {
    const out = process.env.KLIVE_REVERSE_SPIKE_OUT;
    if (out) writeFileSync(out, JSON.stringify(results, null, 2));
  });
});

// ------------------------------------------------------------------------------------------------
// Phase 3's gate: a 10-minute session on the real `Timeline` (KLIVE_REVERSE_SESSION=1)

const SESSION_ENABLED = process.env.KLIVE_REVERSE_SESSION === "1";
/** Frames per session: 10 minutes at 50 Hz (`KLIVE_REVERSE_SESSION_FRAMES` overrides it) */
const SESSION_FRAMES = Number(process.env.KLIVE_REVERSE_SESSION_FRAMES ?? 30_000);
const sessionResults: Result[] = [];

async function measureSession(w: Workload): Promise<Result> {
  const session = await w.setup();
  // --- The real timeline journals the core itself
  session.rig.dispose();
  const machine = session.machine;
  const timeline = Timeline.start(machine, { budgetBytes: 512 * 1048576 });
  // --- Where each frame ended, to turn positions into seconds; where SD traffic happened
  const frameEnds: TimelinePosition[] = [];
  const sdAt: TimelinePosition[] = [];
  let sd = session.sdCalls?.() ?? 0;
  const frameMs: number[] = [];
  for (let f = 0; f < SESSION_FRAMES; f++) {
    const t0 = performance.now();
    await session.frame(f);
    frameMs.push(performance.now() - t0);
    timeline.afterFrame(true);
    frameEnds.push(timeline.position);
    const now = session.sdCalls?.() ?? 0;
    if (now !== sd) sdAt.push(timeline.position);
    sd = now;
  }
  const lasting = timeline.store.keyframes.filter((k) => !k.transient);
  const capture = stats(lasting.slice(1).map((k) => k.captureMs));
  const captureTotal = lasting.reduce((n, k) => n + k.captureMs, 0);
  const start = timeline.startPosition!;
  const frameOf = (p: TimelinePosition) => {
    let lo = 0;
    let hi = frameEnds.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (comparePositions(frameEnds[mid], p) < 0) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const rangeSeconds = (SESSION_FRAMES - frameOf(start)) / 50;
  const intervals = lasting.slice(1).map((k, i) => frameOf(k.seed.position) - frameOf(lasting[i].seed.position));
  const poolMb = timeline.store.stats.poolBytes / 1048576;

  // --- Step backs to random points of the timeline - across SD traffic too, which the journal answers
  // --- since Phase 6 (D14) - then four more steps back from each
  const rnd = seededRandom(99);
  const present = timeline.position;
  const crossesSd = (to: TimelinePosition) => {
    const from = timeline.store.keyframeAtOrBefore(to);
    const before = from ? timeline.store.keyframeBefore(from) : undefined;
    const lo = (before ?? from)?.seed.position ?? start;
    return sdAt.some((p) => comparePositions(p, lo) >= 0 && comparePositions(p, to) <= 0);
  };
  const firstMs: number[] = [];
  const repeatMs: number[] = [];
  let sdCrossings = 0;
  for (let i = 0, tries = 0; i < 40 && tries < 400; tries++) {
    const seq = start.sequence + 1 + Math.floor(rnd() * (present.sequence - start.sequence - 10));
    let target: TimelinePosition = { sequence: seq, sub: 1, phase: 0 };
    if (crossesSd(target)) sdCrossings++;
    i++;
    timeline.store.dropTransient();
    let t0 = performance.now();
    timeline.replayTo(target);
    firstMs.push(performance.now() - t0);
    for (let k = 0; k < 4; k++) {
      target = { sequence: target.sequence - 1, sub: 1, phase: 0 };
      t0 = performance.now();
      timeline.replayTo(target);
      repeatMs.push(performance.now() - t0);
    }
  }
  const t0 = performance.now();
  timeline.returnToPresent();
  const returnMs = performance.now() - t0;
  expect(timeline.position).toEqual(present);
  const first = stats(firstMs);
  const repeat = stats(repeatMs);
  const interval = stats(intervals);
  const result: Result = {
    workload: w.name,
    frames: SESSION_FRAMES,
    frameMs: round(stats(frameMs).mean, 3),
    keyframes: lasting.length,
    evicted: timeline.store.stats.evicted,
    intervalFrames: { mean: round(interval.mean, 1), min: Math.min(...intervals), max: interval.max },
    captureMs: { mean: round(capture.mean), p90: round(capture.p90), max: round(capture.max) },
    capturePctOfFramePeriod: round((captureTotal / (SESSION_FRAMES * FRAME_MS)) * 100, 3),
    poolMb: round(poolMb, 1),
    mbPerMinute: round(poolMb / (SESSION_FRAMES / 3000), 2),
    rangeSeconds,
    projectedSecondsAt512Mb: round((512 / Math.max(poolMb, 0.001)) * (SESSION_FRAMES / 50), 0),
    stepBackMs: { n: first.n, p50: round(first.p50, 1), p90: round(first.p90, 1), max: round(first.max, 1) },
    repeatedStepBackMs: { n: repeat.n, p50: round(repeat.p50, 2), p90: round(repeat.p90, 2), max: round(repeat.max, 2) },
    returnToPresentMs: round(returnMs, 1),
    msPerFrame: round(timeline.stats.msPerFrame, 3),
    journalEntries: timeline.journal.length,
    sdStepBacks: sdCrossings
  };
  sessionResults.push(result);
  timeline.end();
  session.dispose?.();
  return result;
}

describe.skipIf(!SESSION_ENABLED)("reverse debugging: a 10-minute session (Phase 3's gate)", () => {
  for (const w of [...workloads48, ...workloadsNext]) {
    it(w.name, async () => {
      if (w.coreId === "sp48" && !existsSync(YANKEE)) return;
      if (w.name.includes("NextZXOS") && !existsSync(KS2)) return;
      await measureSession(w);
    }, 3_600_000);
  }
  afterAll(() => {
    const out = process.env.KLIVE_REVERSE_SPIKE_OUT;
    if (out) writeFileSync(out, JSON.stringify(sessionResults, null, 2));
  });
});
