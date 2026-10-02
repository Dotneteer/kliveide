import { describe, it, expect } from "vitest";
import {
  computeLayout,
  evenUp,
  fitSize,
  placeInSlot
} from "@main/recording/window-recording/layout";
import { AudioPadder } from "@main/recording/window-recording/AudioPadder";
import { ClickTracker } from "@main/recording/window-recording/ClickTracker";
import { FrameComposer } from "@main/recording/window-recording/FrameComposer";
import { drawPointer, drawRing } from "@main/recording/window-recording/pointer";
import {
  parseCssColor,
  toComposerColors,
  THEME_COLOR_TOKENS
} from "@main/recording/window-recording/themeColors";
import { recordingQualityToCrf } from "@common/utils/recordingCrf";

// --- BGRA helpers
const px = (buf: Uint8Array, width: number, x: number, y: number) => {
  const i = (y * width + x) * 4;
  return { b: buf[i], g: buf[i + 1], r: buf[i + 2], a: buf[i + 3] };
};
const solid = (width: number, height: number, r: number, g: number, b: number) => {
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = b;
    pixels[i * 4 + 1] = g;
    pixels[i * 4 + 2] = r;
    pixels[i * 4 + 3] = 255;
  }
  return { pixels, width, height };
};

const COLORS = {
  fill: { r: 10, g: 20, b: 30 },
  primary: { r: 200, g: 0, b: 0 },
  secondary: { r: 0, g: 0, b: 200 }
};

describe("window recording layout", () => {
  it("evenUp rounds up to an even number", () => {
    expect(evenUp(4)).toBe(4);
    expect(evenUp(5)).toBe(6);
    expect(evenUp(5.2)).toBe(6);
    expect(evenUp(0)).toBe(2);
  });

  it("left: IDE then emulator, height of the taller, shorter one centred", () => {
    const l = computeLayout({ width: 800, height: 600 }, { width: 400, height: 300 }, "left");
    expect(l.width).toBe(1200);
    expect(l.height).toBe(600);
    expect(l.ide).toEqual({ x: 0, y: 0, width: 800, height: 600 });
    expect(l.emu).toEqual({ x: 800, y: 150, width: 400, height: 300 });
  });

  it("right: emulator then IDE", () => {
    const l = computeLayout({ width: 800, height: 600 }, { width: 400, height: 300 }, "right");
    expect(l.emu.x).toBe(0);
    expect(l.ide.x).toBe(400);
  });

  it("top: IDE above the emulator, width of the wider, narrower one centred", () => {
    const l = computeLayout({ width: 800, height: 600 }, { width: 400, height: 300 }, "top");
    expect(l.width).toBe(800);
    expect(l.height).toBe(900);
    expect(l.ide).toEqual({ x: 0, y: 0, width: 800, height: 600 });
    expect(l.emu).toEqual({ x: 200, y: 600, width: 400, height: 300 });
  });

  it("bottom: emulator above the IDE", () => {
    const l = computeLayout({ width: 800, height: 600 }, { width: 400, height: 300 }, "bottom");
    expect(l.emu.y).toBe(0);
    expect(l.ide.y).toBe(300);
  });

  it("odd sizes give even video dimensions", () => {
    const l = computeLayout({ width: 801, height: 601 }, { width: 400, height: 299 }, "left");
    expect(l.width % 2).toBe(0);
    expect(l.height % 2).toBe(0);
    expect(l.width).toBeGreaterThanOrEqual(1201);
  });

  it("fitSize keeps the aspect ratio inside the slot", () => {
    expect(fitSize({ width: 800, height: 600 }, { width: 800, height: 600 })).toEqual({ width: 800, height: 600 });
    expect(fitSize({ width: 1600, height: 1200 }, { width: 800, height: 600 })).toEqual({ width: 800, height: 600 });
    // --- Window made wider: limited by width
    expect(fitSize({ width: 1000, height: 600 }, { width: 800, height: 600 })).toEqual({ width: 800, height: 480 });
    // --- Window made smaller: scaled up to the slot
    expect(fitSize({ width: 400, height: 400 }, { width: 800, height: 600 })).toEqual({ width: 600, height: 600 });
  });

  it("placeInSlot centres the picture", () => {
    expect(placeInSlot({ width: 600, height: 600 }, { x: 100, y: 0, width: 800, height: 600 })).toEqual({
      x: 200,
      y: 0,
      width: 600,
      height: 600
    });
  });
});

describe("AudioPadder", () => {
  const RATE = 1000; // 1 frame per ms keeps the arithmetic readable

  it("pads silence when no sound arrives (emulator paused)", () => {
    const p = new AudioPadder(RATE);
    expect(p.padding(50)).toBeNull(); // within the 100 ms allowance
    const silence = p.padding(200)!;
    // --- Padded up to 50 ms behind the clock: 150 frames, stereo
    expect(silence.length).toBe(150 * 2);
    expect(silence.every((v) => v === 0)).toBe(true);
    expect(p.framesWritten).toBe(150);
  });

  it("does not pad while the sound keeps up", () => {
    const p = new AudioPadder(RATE);
    p.accept(new Float32Array(200 * 2), 200);
    expect(p.padding(250)).toBeNull();
  });

  it("drops sound running more than 250 ms ahead of the clock", () => {
    const p = new AudioPadder(RATE);
    const accepted = p.accept(new Float32Array(400 * 2).fill(0.5), 100);
    // --- due 100 + lead 250 = 350 frames
    expect(accepted.length).toBe(350 * 2);
    expect(p.accept(new Float32Array(10 * 2), 100).length).toBe(0);
  });

  it("prefill writes silence up front and counts it", () => {
    const p = new AudioPadder(RATE);
    const silence = p.prefill(66);
    expect(silence.length).toBe(66 * 2);
    expect(p.framesWritten).toBe(66);
    expect(p.padding(66)).toBeNull();
  });

  it("keeps the total equal to the clock after a pause and resume", () => {
    const p = new AudioPadder(RATE);
    p.accept(new Float32Array(100 * 2), 100);
    p.padding(1000); // paused for 900 ms
    expect(p.framesWritten).toBe(950);
  });
});

describe("ClickTracker", () => {
  it("shows a held press while the button is down", () => {
    const c = new ClickTracker(300);
    c.mouseDown("left");
    expect(c.frame(0)).toEqual({ held: "left" });
    expect(c.frame(33)).toEqual({ held: "left" });
  });

  it("starts a ripple on release that fades out", () => {
    const c = new ClickTracker(300);
    c.mouseDown("right");
    c.frame(0);
    c.mouseUp("right", 100);
    expect(c.frame(250)).toEqual({ ripple: { button: "right", progress: 0.5 } });
    expect(c.frame(400)).toEqual({});
  });

  it("latch: a click between two frames is still shown once", () => {
    const c = new ClickTracker(300);
    c.mouseDown("left");
    c.mouseUp("left", 10);
    expect(c.frame(66)).toEqual({ held: "left" });
    const next = c.frame(132);
    expect(next.held).toBeUndefined();
    expect(next.ripple?.button).toBe("left");
    expect(next.ripple?.progress).toBeCloseTo(66 / 300);
  });

  it("reset clears a press without a ripple", () => {
    const c = new ClickTracker(300);
    c.mouseDown("left");
    c.frame(0);
    c.reset();
    c.mouseUp("left", 10);
    expect(c.frame(20)).toEqual({});
  });
});

describe("FrameComposer", () => {
  const layout = computeLayout({ width: 8, height: 6 }, { width: 4, height: 2 }, "left");

  it("fills the background and places both pictures", () => {
    const composer = new FrameComposer(layout, COLORS);
    const out = new Uint8Array(composer.frameBytes);
    composer.compose(out, solid(8, 6, 255, 0, 0), solid(4, 2, 0, 255, 0));
    expect(px(out, layout.width, 0, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    // --- Emulator centred vertically: rows 2..3
    expect(px(out, layout.width, 8, 2)).toEqual({ r: 0, g: 255, b: 0, a: 255 });
    expect(px(out, layout.width, 8, 0)).toEqual({ ...COLORS.fill, a: 255 });
  });

  it("a missing picture leaves its slot filled", () => {
    const composer = new FrameComposer(layout, COLORS);
    const out = new Uint8Array(composer.frameBytes);
    composer.compose(out, undefined, solid(4, 2, 0, 255, 0));
    expect(px(out, layout.width, 3, 3)).toEqual({ ...COLORS.fill, a: 255 });
  });

  it("a smaller (resized) picture is centred in its slot", () => {
    const composer = new FrameComposer(layout, COLORS);
    const out = new Uint8Array(composer.frameBytes);
    composer.compose(out, solid(6, 6, 255, 0, 0), undefined);
    expect(px(out, layout.width, 0, 0)).toEqual({ ...COLORS.fill, a: 255 });
    expect(px(out, layout.width, 1, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
  });

  it("draws the pointer clipped to its slot, with the held ring under it", () => {
    const big = computeLayout({ width: 64, height: 64 }, { width: 64, height: 64 }, "left");
    const composer = new FrameComposer(big, COLORS);
    const out = new Uint8Array(composer.frameBytes);
    composer.compose(out, solid(64, 64, 0, 0, 0), solid(64, 64, 0, 0, 0), {
      x: 60,
      y: 30,
      scale: 1,
      clip: big.ide,
      click: { held: "left" }
    });
    // --- Arrow outline at the hot spot
    expect(px(out, big.width, 60, 30)).toMatchObject({ r: 0, g: 0, b: 0 });
    // --- Ring tinted with the primary colour left of the pointer, inside the IDE slot
    expect(px(out, big.width, 50, 30).r).toBeGreaterThan(0);
    // --- Nothing drawn over the emulator slot (clipped)
    expect(px(out, big.width, 70, 30)).toMatchObject({ r: 0, g: 0, b: 0 });
  });
});

describe("pointer drawing", () => {
  it("scales the arrow by an integer factor", () => {
    const canvas = { pixels: new Uint8Array(40 * 40 * 4), width: 40, height: 40 };
    drawPointer(canvas, 0, 0, 2);
    // --- Row 2 of the arrow is "X.X": at 2x, pixel (2,4) is fill (white)
    expect(px(canvas.pixels, 40, 2, 4)).toMatchObject({ r: 255, g: 255, b: 255 });
  });

  it("drawRing leaves the centre of a thin ring untouched", () => {
    const canvas = { pixels: new Uint8Array(40 * 40 * 4), width: 40, height: 40 };
    drawRing(canvas, 20, 20, 10, 2, { r: 255, g: 0, b: 0 }, 1);
    expect(px(canvas.pixels, 40, 20, 20).r).toBe(0);
    expect(px(canvas.pixels, 40, 29, 20).r).toBeGreaterThan(200);
  });
});

describe("theme colours", () => {
  it("parses the token formats", () => {
    expect(parseCssColor("#abc")).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc });
    expect(parseCssColor("#102030")).toEqual({ r: 16, g: 32, b: 48 });
    expect(parseCssColor("#102030ff")).toEqual({ r: 16, g: 32, b: 48 });
    expect(parseCssColor("rgb(1, 2, 3)")).toEqual({ r: 1, g: 2, b: 3 });
    expect(parseCssColor("rgba(1 2 3 / 50%)")).toEqual({ r: 1, g: 2, b: 3 });
    expect(parseCssColor("var(--x)")).toBeUndefined();
    expect(parseCssColor("")).toBeUndefined();
  });

  it("falls back when a token is missing", () => {
    const colors = toComposerColors({ [THEME_COLOR_TOKENS.primary]: "#ff0000" });
    expect(colors.primary).toEqual({ r: 255, g: 0, b: 0 });
    expect(colors.fill).toBeDefined();
    expect(toComposerColors(undefined).secondary).toBeDefined();
  });
});

describe("recordingQualityToCrf", () => {
  it("maps the quality presets", () => {
    expect(recordingQualityToCrf("lossless")).toBe(0);
    expect(recordingQualityToCrf("high")).toBe(10);
    expect(recordingQualityToCrf("good")).toBe(18);
    expect(recordingQualityToCrf(undefined)).toBe(18);
  });
});
