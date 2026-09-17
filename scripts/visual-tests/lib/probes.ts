import { parseColor } from "./colors";
import { pixelHex, type Frame } from "./frame";

export type Range = [number, number];

export type Probe =
  | { kind: "pixel"; name?: string; frames?: number[]; x: number; y: number; rgb: string }
  | { kind: "rect"; name?: string; frames?: number[]; x: Range; y: Range; rgb: string }
  | { kind: "bands"; name?: string; frames?: number[]; x: Range; bands: Array<{ y: Range; rgb: string }> }
  | { kind: "columns"; name?: string; frames?: number[]; y: Range; bands: Array<{ x: Range; rgb: string }> }
  | { kind: "colors"; name?: string; frames?: number[]; exactly: string[] };

export type ProbeOutcome = {
  probe: string;
  frame: number;
  pass: boolean;
  detail: string;
};

export function probeName(probe: Probe, index: number): string {
  return probe.name ?? `#${index + 1} ${probe.kind}`;
}

/** Checks one rectangle; the detail names the first wrong pixel and how many are wrong. */
function checkRect(frame: Frame, x: Range, y: Range, rgb: string): { pass: boolean; detail: string } {
  const expected = parseColor(rgb);
  if (x[0] < 0 || y[0] < 0 || x[1] >= frame.width || y[1] >= frame.height || x[0] > x[1] || y[0] > y[1]) {
    return { pass: false, detail: `region x${x[0]}-${x[1]} y${y[0]}-${y[1]} is outside the ${frame.width}x${frame.height} frame` };
  }
  let wrong = 0;
  let first: string | undefined;
  const actualColors = new Map<string, number>();
  for (let yy = y[0]; yy <= y[1]; yy++) {
    for (let xx = x[0]; xx <= x[1]; xx++) {
      const actual = pixelHex(frame, xx, yy);
      if (actual !== expected) {
        wrong++;
        first ??= `(${xx},${yy}) is ${actual}`;
        actualColors.set(actual, (actualColors.get(actual) ?? 0) + 1);
      }
    }
  }
  const total = (x[1] - x[0] + 1) * (y[1] - y[0] + 1);
  if (!wrong) return { pass: true, detail: `x${x[0]}-${x[1]} y${y[0]}-${y[1]} all ${expected}` };
  const seen = [...actualColors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${c}×${n}`);
  return {
    pass: false,
    detail: `x${x[0]}-${x[1]} y${y[0]}-${y[1]} expected ${expected}: ${wrong}/${total} pixels differ, first ${first}; seen ${seen.join(", ")}`
  };
}

export function evaluateProbe(probe: Probe, frame: Frame): { pass: boolean; detail: string } {
  switch (probe.kind) {
    case "pixel": {
      const expected = parseColor(probe.rgb);
      const actual = pixelHex(frame, probe.x, probe.y);
      return { pass: actual === expected, detail: `(${probe.x},${probe.y}) expected ${expected}, is ${actual}` };
    }
    case "rect":
      return checkRect(frame, probe.x, probe.y, probe.rgb);
    case "bands":
    case "columns": {
      const failures: string[] = [];
      probe.bands.forEach((band, i) => {
        const r =
          probe.kind === "bands"
            ? checkRect(frame, probe.x, (band as { y: Range }).y, band.rgb)
            : checkRect(frame, (band as { x: Range }).x, probe.y, band.rgb);
        if (!r.pass) failures.push(`band ${i + 1}: ${r.detail}`);
      });
      return failures.length
        ? { pass: false, detail: failures.join("; ") }
        : { pass: true, detail: `${probe.bands.length} bands match` };
    }
    case "colors": {
      const expected = new Set(probe.exactly.map(parseColor));
      const actual = new Set<string>();
      for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) actual.add(pixelHex(frame, x, y));
      const missing = [...expected].filter((c) => !actual.has(c));
      const extra = [...actual].filter((c) => !expected.has(c));
      return missing.length || extra.length
        ? { pass: false, detail: `missing ${missing.join(",") || "-"}; unexpected ${extra.join(",") || "-"}` }
        : { pass: true, detail: `exactly ${[...expected].join(", ")}` };
    }
  }
}

export type PixelDiff = {
  differing: number;
  box?: { x: Range; y: Range };
  first?: { x: number; y: number; a: string; b: string };
};

export function diffFrames(a: Frame, b: Frame): PixelDiff {
  if (a.width !== b.width || a.height !== b.height) {
    return { differing: Math.max(a.width * a.height, b.width * b.height) };
  }
  let differing = 0;
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  let first: PixelDiff["first"];
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      if (a.rgba[i] !== b.rgba[i] || a.rgba[i + 1] !== b.rgba[i + 1] || a.rgba[i + 2] !== b.rgba[i + 2]) {
        differing++;
        first ??= { x, y, a: pixelHex(a, x, y), b: pixelHex(b, x, y) };
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  return differing ? { differing, first, box: { x: [minX, maxX], y: [minY, maxY] } } : { differing: 0 };
}
