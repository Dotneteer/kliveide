// Shared SVG helpers for the audio series' figure generators (docs/authoring/next-audio/*-figures.cjs).
// Figures are inline JSX-flavoured SVG in MDX: camelCase attributes, `style={{ ... }}`, `currentColor`
// for neutral strokes and text.
"use strict";

const fs = require("fs");

// --- One colour per source across the series (.plans/NEXT_AUDIO_ARTICLES_PLAN.md §0.3)
const BEEPER = "#3b82f6"; // beeper, EAR, MIC, tape
const PSG = "#e8912d"; // AY/YM chips (TurboSound)
const DAC = "#30a46c"; // 8-bit DACs
const PI = "#a855f7"; // Raspberry Pi I2S
const MIX = "#e5484d"; // mixer sums, clipping, "what you hear"

const r = (v) => Math.round(v * 10) / 10;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Maps time and level to a plot box. */
function box(x, y, w, h, t0, t1, v0, v1) {
  return {
    x, y, w, h,
    px: (t) => r(x + ((t - t0) / (t1 - t0)) * w),
    py: (v) => r(y + h - ((v - v0) / (v1 - v0)) * h)
  };
}

/** A polyline through [t, v] points. */
const poly = (b, pts) => "M" + pts.map(([t, v]) => `${b.px(t)},${b.py(v)}`).join(" L");

/** Samples drawn as a staircase: each sample held for one sample period. */
function sampleStairs(b, values, t0, dt) {
  const pts = [];
  values.forEach((v, i) => pts.push([t0 + i * dt, v], [t0 + (i + 1) * dt, v]));
  return poly(b, pts);
}

const svgOpen = (w, h, label) =>
  `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" style={{ width: "100%", maxWidth: "${w}px", height: "auto" }}>`;

function text(x, y, s, o = {}) {
  return `  <text x="${r(x)}" y="${r(y)}"${o.anchor ? ` textAnchor="${o.anchor}"` : ""} fill="${o.fill ?? "currentColor"}" fontSize="${o.size ?? 13}"${o.bold ? ' fontWeight="bold"' : ""}${o.family ? ` fontFamily="${o.family}"` : ""}>${esc(s)}</text>`;
}
/** Several lines of text, `lh` apart. */
const lines = (x, y, arr, o = {}) => arr.map((s, i) => text(x, y + i * (o.lh ?? 15), s, o)).join("\n");

function line(x1, y1, x2, y2, o = {}) {
  return `  <line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${o.stroke ?? "currentColor"}" strokeWidth="${o.width ?? 1}"${o.dash ? ` strokeDasharray="${o.dash}"` : ""}${o.opacity !== undefined ? ` strokeOpacity="${o.opacity}"` : ""}${o.marker ? ` markerEnd="url(#${o.marker})"` : ""} />`;
}
function pathEl(d, o = {}) {
  return `  <path d="${d}" fill="${o.fill ?? "none"}" stroke="${o.stroke ?? "currentColor"}" strokeWidth="${o.width ?? 2}"${o.dash ? ` strokeDasharray="${o.dash}"` : ""}${o.opacity !== undefined ? ` strokeOpacity="${o.opacity}"` : ""}${o.marker ? ` markerEnd="url(#${o.marker})"` : ""} strokeLinejoin="round" />`;
}
function rect(x, y, w, h, o = {}) {
  return `  <rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}"${o.rx ? ` rx="${o.rx}"` : ""} fill="${o.fill ?? "none"}"${o.fillOpacity !== undefined ? ` fillOpacity="${o.fillOpacity}"` : ""} stroke="${o.stroke ?? "currentColor"}" strokeWidth="${o.width ?? 1.5}"${o.dash ? ` strokeDasharray="${o.dash}"` : ""}${o.opacity !== undefined ? ` strokeOpacity="${o.opacity}"` : ""} />`;
}
/** Arrowhead markers, one per colour, ids `<prefix>-<n>`. */
function arrows(prefix, colours) {
  const m = colours.map(
    (c, i) =>
      `    <marker id="${prefix}-${i}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">\n      <path d="M0,0 L10,5 L0,10 z" fill="${c}" />\n    </marker>`
  );
  return `  <defs>\n${m.join("\n")}\n  </defs>`;
}

/** Rewrites the figures between {/* fig:<name> *\/} markers of a page. */
function writeFigures(page, figures) {
  let src = fs.readFileSync(page, "utf8");
  for (const [name, out] of Object.entries(figures)) {
    const re = new RegExp(`(\\{/\\* fig:${name} \\*/\\}\\n)[\\s\\S]*?(\\{/\\* /fig:${name} \\*/\\})`);
    if (!re.test(src)) throw new Error(`marker for figure "${name}" not found in ${page}`);
    src = src.replace(re, (_, open, close) => open + out.join("\n") + "\n" + close);
  }
  fs.writeFileSync(page, src);
}

module.exports = { BEEPER, PSG, DAC, PI, MIX, r, box, poly, sampleStairs, svgOpen, text, lines, line, pathEl, rect, arrows, writeFigures };
