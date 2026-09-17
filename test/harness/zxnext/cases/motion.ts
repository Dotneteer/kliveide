import { parseColor } from "../core/colors";
import { pixelHex, type Frame } from "../core/frame";
import type { Range } from "./probes";

/**
 * A feature tracked across frames, for screens that change every frame.
 *
 * `firstRow` / `lastRow`: the first/last buffer row in column `x` (within `y`, default the whole
 * frame) whose pixel is `rgb` — e.g. the top edge of a moving copper bar. `null` when absent.
 * `colorAt`: the colour of one pixel — e.g. a copper colour cycle.
 */
export type MotionFeature =
  | { kind: "firstRow" | "lastRow"; x: number; rgb: string; y?: Range }
  | { kind: "colorAt"; x: number; y: number };

/**
 * - `linear`: value(f) = start + step * n, where n counts sampled frames' distance in frames from
 *   the first sample, wrapped into [wrap.min, wrap.max]. `start: "auto"` takes the first measured
 *   value (which must lie in `startWithin`): the program's phase against the emulator's frame count
 *   depends on how long its setup took, which is not a hardware fact worth pinning.
 * - `sequence`: value(f) = values[(n + phase) % length]. `phase: "auto"` aligns on the first sample.
 * - `constant`: every sample equals `value`.
 * - `follows`: value(f) = the named motion's value at frame f - lag (a delayed copy).
 */
export type MotionExpectation =
  | { kind: "linear"; start: number | "auto"; startWithin?: Range; step: number; wrap?: { min: number; max: number } }
  | { kind: "sequence"; values: Array<number | string>; phase?: number | "auto" }
  | { kind: "constant"; value: number | string }
  | { kind: "follows"; motion: string; lag: number };

export type MotionSpec = {
  name: string;
  /** Inclusive frame range, sampled every `every` frames (default 1). */
  frames: Range;
  every?: number;
  feature: MotionFeature;
  expect: MotionExpectation;
};

export type MotionSample = { frame: number; actual: number | string | null; expected: number | string | null };

export type MotionOutcome = {
  name: string;
  pass: boolean;
  detail: string;
  samples: MotionSample[];
};

export function motionFrames(spec: MotionSpec): number[] {
  const out: number[] = [];
  for (let f = spec.frames[0]; f <= spec.frames[1]; f += spec.every ?? 1) out.push(f);
  return out;
}

export function measureFeature(feature: MotionFeature, frame: Frame): number | string | null {
  if (feature.kind === "colorAt") return pixelHex(frame, feature.x, feature.y);
  const want = parseColor(feature.rgb);
  const [y0, y1] = feature.y ?? [0, frame.height - 1];
  if (feature.kind === "firstRow") {
    for (let y = y0; y <= y1; y++) if (pixelHex(frame, feature.x, y) === want) return y;
  } else {
    for (let y = y1; y >= y0; y--) if (pixelHex(frame, feature.x, y) === want) return y;
  }
  return null;
}

const norm = (v: number | string) => (typeof v === "string" ? parseColor(v) : v);

/** Evaluates all motions of a case together, because `follows` refers to another motion's samples. */
export function evaluateMotions(specs: MotionSpec[], frames: Map<number, Frame>): MotionOutcome[] {
  const measured = new Map<string, Map<number, number | string | null>>();
  for (const spec of specs) {
    const m = new Map<number, number | string | null>();
    for (const f of motionFrames(spec)) m.set(f, frames.has(f) ? measureFeature(spec.feature, frames.get(f)!) : null);
    measured.set(spec.name, m);
  }

  return specs.map((spec) => {
    const values = measured.get(spec.name)!;
    const fs = motionFrames(spec);
    const first = fs[0];
    const problems: string[] = [];
    const e = spec.expect;

    let expectedAt: (f: number) => number | string | null;
    switch (e.kind) {
      case "linear": {
        const start = e.start === "auto" ? values.get(first) : e.start;
        if (typeof start !== "number") {
          problems.push(`no measurable start value at frame ${first} (measured ${String(start)})`);
          expectedAt = () => null;
          break;
        }
        if (e.start === "auto" && e.startWithin && (start < e.startWithin[0] || start > e.startWithin[1])) {
          problems.push(`start value ${start} outside ${e.startWithin.join("-")}`);
        }
        expectedAt = (f) => {
          let v = start + e.step * (f - first);
          if (e.wrap) {
            const span = e.wrap.max - e.wrap.min + 1;
            v = e.wrap.min + ((((v - e.wrap.min) % span) + span) % span);
          }
          return v;
        };
        break;
      }
      case "sequence": {
        const seq = e.values.map(norm);
        let phase = typeof e.phase === "number" ? e.phase : 0;
        if (e.phase === "auto") {
          phase = seq.indexOf(values.get(first) as never);
          if (phase < 0) {
            problems.push(`first sample ${String(values.get(first))} is not in the sequence`);
            phase = 0;
          }
        }
        expectedAt = (f) => seq[((f - first) / (spec.every ?? 1) + phase) % seq.length];
        break;
      }
      case "constant":
        expectedAt = () => norm(e.value);
        break;
      case "follows": {
        const other = measured.get(e.motion);
        if (!other) problems.push(`follows unknown motion '${e.motion}'`);
        expectedAt = (f) => other?.get(f - e.lag) ?? null;
        break;
      }
    }

    const samples: MotionSample[] = fs.map((f) => ({ frame: f, actual: values.get(f) ?? null, expected: expectedAt(f) }));
    const judged = e.kind === "follows" ? samples.filter((s) => s.expected !== null) : samples;
    const wrong = judged.filter((s) => s.actual !== s.expected);
    for (const s of wrong.slice(0, 4)) problems.push(`frame ${s.frame}: expected ${s.expected}, measured ${s.actual}`);
    if (!judged.length) problems.push("nothing to compare");
    return {
      name: spec.name,
      pass: problems.length === 0,
      detail: problems.length ? `${wrong.length}/${judged.length} samples wrong; ${problems.join("; ")}` : `${judged.length} samples match`,
      samples
    };
  });
}
