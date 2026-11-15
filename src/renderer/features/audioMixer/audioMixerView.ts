/*
 * What the audio mixer's two views share (`dev/plans/AUDIO_MIXER_PLAN.md` §3.4): the IDE's Audio
 * Mixer document and the emulator's sound popover. Grouping, the group hues, level formatting and
 * the canvas drawing. The colours come from tokens (`--audio-group-n`, the surfaces), read from the
 * canvas's own computed style at draw time, so a theme change applies at the next frame.
 */

import { spectrumBandEdges, SPECTRUM_BANDS, type AudioChannelMeasures } from "@common/audio/audioAnalysis";
import type { AudioMixerChannelFrame } from "@common/audio/audioMixerModel";

/** How many group hues the tokens define (`--audio-group-1` ...) */
export const AUDIO_GROUP_HUES = 6;

/** A group of channels in the order the machine lists them, with its hue's token */
export type AudioChannelGroup = {
  group: string;
  hue: string;
  channels: AudioMixerChannelFrame[];
};

/** The channels in their groups, each group with the next hue */
export function groupChannels(channels: readonly AudioMixerChannelFrame[]): AudioChannelGroup[] {
  const groups: AudioChannelGroup[] = [];
  for (const ch of channels) {
    let g = groups.find((x) => x.group === ch.group);
    if (!g) {
      g = { group: ch.group, hue: `--audio-group-${(groups.length % AUDIO_GROUP_HUES) + 1}`, channels: [] };
      groups.push(g);
    }
    g.channels.push(ch);
  }
  return groups;
}

/** A level's dB (full scale 0 dB); -Infinity for silence */
export function levelDb(level: number): number {
  return level > 1e-6 ? 20 * Math.log10(level) : -Infinity;
}

/** The meter's range: METER_FLOOR_DB to 0 dB */
export const METER_FLOOR_DB = -48;

/** A level's position on the meter, 0..1 */
export function meterPosition(level: number): number {
  const db = levelDb(level);
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db - METER_FLOOR_DB) / -METER_FLOOR_DB));
}

/** The centre frequency of the loudest band, or undefined for silence */
export function strongestHz(measures: AudioChannelMeasures, sampleRate: number): number | undefined {
  let best = -1;
  let at = -1;
  measures.spectrum.forEach((v, i) => {
    if (v > best) {
      best = v;
      at = i;
    }
  });
  if (best <= 0.05 || at < 0) return undefined;
  const edges = spectrumBandEdges(sampleRate);
  return Math.round(Math.sqrt(edges[at] * edges[at + 1]));
}

/** A canvas's 2D context, its backing store sized to its CSS box at the device's pixel ratio */
export function fitCanvas(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return canvas.getContext?.("2d") ?? null;
}

/** A token's value as the canvas sees it */
export function tokenColor(canvas: HTMLCanvasElement, token: string): string {
  return getComputedStyle(canvas).getPropertyValue(token).trim() || "gray";
}

export type MeterOptions = { vertical: boolean; hue: string; dim: boolean };

/** A level meter: RMS solid, peak lighter behind it, the peak hold a thin line */
export function drawMeter(canvas: HTMLCanvasElement | null, measures: AudioChannelMeasures, hold: number, o: MeterOptions): void {
  const ctx = fitCanvas(canvas);
  if (!ctx || !canvas) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = tokenColor(canvas, "--surface-active");
  ctx.fillRect(0, 0, w, h);
  const color = tokenColor(canvas, o.hue);
  const bar = (position: number, alpha: number) => {
    ctx.globalAlpha = alpha * (o.dim ? 0.35 : 1);
    ctx.fillStyle = color;
    if (o.vertical) ctx.fillRect(0, h - position * h, w, position * h);
    else ctx.fillRect(0, 0, position * w, h);
  };
  bar(meterPosition(measures.peak), 0.4);
  bar(meterPosition(measures.rms * Math.SQRT2), 1);
  ctx.globalAlpha = o.dim ? 0.35 : 1;
  ctx.fillStyle = tokenColor(canvas, "--text-primary");
  const p = meterPosition(hold);
  if (p > 0) {
    if (o.vertical) ctx.fillRect(0, Math.min(h - 2, h - p * h), w, 2);
    else ctx.fillRect(Math.min(w - 2, p * w), 0, 2, h);
  }
  ctx.globalAlpha = 1;
}

export type SpectrumOptions = { hue: string; dim: boolean; grid?: { sampleRate: number } };

const GRID_HZ = [100, 250, 500, 1000, 2000, 4000, 8000];

/** The bar spectrum; with `grid`, frequency lines, and their labels in a strip of their own below the bars */
export function drawSpectrum(canvas: HTMLCanvasElement | null, spectrum: readonly number[], o: SpectrumOptions): void {
  const ctx = fitCanvas(canvas);
  if (!ctx || !canvas) return;
  const { width: w } = canvas;
  ctx.clearRect(0, 0, w, canvas.height);
  // --- The labels never sit on the bars: a loud band would cover them, grey text on the group's hue
  let h = canvas.height;
  if (o.grid) {
    const ratio = window.devicePixelRatio || 1;
    const axis = Math.round(16 * ratio);
    h = Math.max(1, canvas.height - axis);
    const edges = spectrumBandEdges(o.grid.sampleRate);
    const lo = Math.log(edges[0]);
    const span = Math.log(edges[SPECTRUM_BANDS]) - lo;
    ctx.strokeStyle = tokenColor(canvas, "--border-subtle");
    ctx.fillStyle = tokenColor(canvas, "--text-secondary");
    ctx.font = `${10 * ratio}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h + 0.5);
    ctx.lineTo(w, h + 0.5);
    ctx.stroke();
    for (const hz of GRID_HZ) {
      const x = ((Math.log(hz) - lo) / span) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h + 3 * ratio);
      ctx.stroke();
      ctx.fillText(hz >= 1000 ? `${hz / 1000}k` : `${hz}`, x + 3 * ratio, h + axis / 2);
    }
    ctx.textBaseline = "alphabetic";
  }
  const bw = w / spectrum.length;
  ctx.fillStyle = tokenColor(canvas, o.hue);
  ctx.globalAlpha = o.dim ? 0.35 : 0.95;
  const gap = o.grid ? Math.max(1, bw * 0.15) : 0;
  spectrum.forEach((v, i) => {
    const bh = v * h;
    ctx.fillRect(i * bw + gap / 2, h - bh, Math.max(1, bw - gap), bh);
  });
  ctx.globalAlpha = 1;
}

/** The waveform about its mean */
export function drawScope(canvas: HTMLCanvasElement | null, scope: readonly number[], o: { hue: string }): void {
  const ctx = fitCanvas(canvas);
  if (!ctx || !canvas) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = tokenColor(canvas, "--border-subtle");
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  const max = Math.max(0.05, ...scope.map(Math.abs));
  ctx.strokeStyle = tokenColor(canvas, o.hue);
  ctx.lineWidth = 1.5 * (window.devicePixelRatio || 1);
  ctx.beginPath();
  scope.forEach((v, i) => {
    const x = (i / Math.max(1, scope.length - 1)) * w;
    const y = h / 2 - (v / max) * h * 0.45;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.lineWidth = 1;
}

/** One more column of the spectrogram: the picture moves left, the new spectrum enters on the right */
export function drawSpectrogramColumn(canvas: HTMLCanvasElement | null, spectrum: readonly number[], o: { hue: string }): void {
  const ctx = fitCanvas(canvas);
  if (!ctx || !canvas) return;
  const { width: w, height: h } = canvas;
  const column = Math.max(2, Math.round(3 * (window.devicePixelRatio || 1)));
  // --- Moved with put, not drawn: drawing the canvas over itself composites its semi-transparent
  // --- pixels onto the old ones each frame, and the picture smears
  if (w > column) {
    const kept = ctx.getImageData(column, 0, w - column, h);
    ctx.clearRect(0, 0, w, h);
    ctx.putImageData(kept, 0, 0);
  }
  ctx.fillStyle = tokenColor(canvas, o.hue);
  const bh = h / spectrum.length;
  // --- Raised to 1.5, so the leakage floor (a few tenths) recedes and the tones stand out
  spectrum.forEach((v, i) => {
    ctx.globalAlpha = Math.pow(v, 1.5);
    ctx.fillRect(w - column, h - (i + 1) * bh, column, Math.ceil(bh));
  });
  ctx.globalAlpha = 1;
}
