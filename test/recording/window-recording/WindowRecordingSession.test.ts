import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  FIRST_FRAME_TIMEOUT_MS,
  PRIMING_FRAMES,
  POINTER_AWAY_RESET_MS,
  WindowRecordingSession,
  type RecordedWindow,
  type WindowRecordingOptions
} from "@main/recording/window-recording/WindowRecordingSession";
import type { FrameImage } from "@main/recording/window-recording/WindowFrameSource";
import type { MouseButton } from "@main/recording/window-recording/ClickTracker";
import type { IRecordingBackend } from "@main/recording/IRecordingBackend";

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

/** A solid-colour BGRA image of the given size */
function image(width: number, height: number, r = 0, g = 0, b = 0): FrameImage {
  const self: FrameImage = {
    getSize: () => ({ width, height }),
    isEmpty: () => false,
    resize: ({ width: w, height: h }) => image(w, h, r, g, b),
    toBitmap: () => {
      const out = new Uint8Array(width * height * 4);
      for (let i = 0; i < width * height; i++) {
        out[i * 4] = b;
        out[i * 4 + 1] = g;
        out[i * 4 + 2] = r;
        out[i * 4 + 3] = 255;
      }
      return out;
    }
  };
  return self;
}

class FakeWindow implements RecordedWindow {
  frameCallback: ((image: FrameImage) => void) | null = null;
  endCalls = 0;
  invalidated = 0;
  focused = false;
  destroyed = false;
  mouseListeners: ((button: MouseButton, down: boolean) => void)[] = [];
  blurListeners: (() => void)[] = [];
  closedListeners: (() => void)[] = [];

  constructor(
    public bounds: { x: number; y: number; width: number; height: number },
    public scaleFactor = 1
  ) {}

  capture = {
    beginFrameSubscription: (cb: (image: FrameImage) => void) => {
      this.frameCallback = cb;
    },
    endFrameSubscription: () => {
      this.endCalls++;
      this.frameCallback = null;
    },
    invalidate: () => {
      this.invalidated++;
    }
  };

  paint(img: FrameImage) {
    this.frameCallback?.(img);
  }
  getContentBounds() {
    return this.bounds;
  }
  getScaleFactor() {
    return this.scaleFactor;
  }
  isFocused() {
    return this.focused;
  }
  isDestroyed() {
    return this.destroyed;
  }
  onMouseButton(cb: (button: MouseButton, down: boolean) => void) {
    this.mouseListeners.push(cb);
    return () => (this.mouseListeners = this.mouseListeners.filter((l) => l !== cb));
  }
  onBlur(cb: () => void) {
    this.blurListeners.push(cb);
    return () => (this.blurListeners = this.blurListeners.filter((l) => l !== cb));
  }
  onClosed(cb: () => void) {
    this.closedListeners.push(cb);
    return () => (this.closedListeners = this.closedListeners.filter((l) => l !== cb));
  }
  press(button: MouseButton, down: boolean) {
    this.mouseListeners.forEach((l) => l(button, down));
  }
}

class FakeBackend implements IRecordingBackend {
  started: any[] | null = null;
  frames: Uint8Array[] = [];
  audio: Float32Array[] = [];
  backedUp = false;
  drainCallbacks: (() => void)[] = [];
  finished = false;
  start(...args: any[]) {
    this.started = args;
  }
  appendFrame(frame: Uint8Array, onWritten?: () => void) {
    this.frames.push(frame);
    onWritten?.();
    return !this.backedUp;
  }
  onceDrained(cb: () => void) {
    if (!this.backedUp) cb();
    else this.drainCallbacks.push(cb);
  }
  drain() {
    this.backedUp = false;
    const cbs = this.drainCallbacks;
    this.drainCallbacks = [];
    cbs.forEach((cb) => cb());
  }
  holdFrame() {}
  appendAudioSamples(samples: Float32Array) {
    this.audio.push(samples);
  }
  async finish() {
    this.finished = true;
    return "/out/recording.mp4";
  }
}

const COLORS = {
  fill: { r: 1, g: 2, b: 3 },
  primary: { r: 250, g: 0, b: 0 },
  secondary: { r: 0, g: 0, b: 250 }
};

function options(overrides: Partial<WindowRecordingOptions> = {}): WindowRecordingOptions {
  return {
    outputPath: "/out/recording.mp4",
    idePosition: "left",
    pointer: true,
    clicks: true,
    hiDpi: false,
    fps: 10, // 100 ms per frame
    crf: 18,
    format: "mp4",
    sampleRate: 1000,
    colors: COLORS,
    ...overrides
  };
}

// --- BGRA pixel reader
const px = (buf: Uint8Array, width: number, x: number, y: number) => {
  const i = (y * width + x) * 4;
  return { r: buf[i + 2], g: buf[i + 1], b: buf[i] };
};

describe("WindowRecordingSession", () => {
  let now: number;
  let ide: FakeWindow;
  let emu: FakeWindow;
  let backend: FakeBackend;
  let cursor: { x: number; y: number };
  let captured: boolean;
  let aborted: number;

  const clock = {
    now: () => now,
    // --- Ticks are driven by hand with session.tick()
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn()
  };

  const create = (o: Partial<WindowRecordingOptions> = {}) =>
    new WindowRecordingSession(options(o), {
      backend,
      ide,
      emu,
      clock,
      cursor: () => cursor,
      mouseCaptured: () => captured,
      onAborted: () => aborted++
    });

  beforeEach(() => {
    now = 1000;
    ide = new FakeWindow({ x: 0, y: 0, width: 40, height: 30 }, 2);
    emu = new FakeWindow({ x: 500, y: 0, width: 20, height: 10 }, 2);
    backend = new FakeBackend();
    cursor = { x: -100, y: -100 };
    captured = false;
    aborted = 0;
    clock.setTimeout.mockClear();
    clock.clearTimeout.mockClear();
  });

  it("starts the backend with the layout size, BGRA and realtime", () => {
    const s = create();
    s.start();
    expect(backend.started?.slice(0, 4)).toEqual(["/out/recording.mp4", 60, 30, 10]);
    expect(backend.started?.[9]).toEqual({ pixelFormat: "bgra", realtime: true });
    expect(ide.invalidated).toBe(1);
    expect(emu.invalidated).toBe(1);
  });

  it("HiDPI doubles the video size on a 2x display", () => {
    const s = create({ hiDpi: true });
    expect(s.layout.width).toBe(120);
    expect(s.layout.height).toBe(60);
  });

  it("waits for both first frames before the clock starts", () => {
    const s = create();
    s.start();
    ide.paint(image(80, 60));
    s.tick();
    expect(backend.frames.length).toBe(0);
    emu.paint(image(40, 20));
    s.tick();
    // --- The two priming frames
    expect(backend.frames.length).toBe(PRIMING_FRAMES);
  });

  it("starts anyway after the first-frame timeout", () => {
    const s = create();
    s.start();
    now += FIRST_FRAME_TIMEOUT_MS;
    s.tick();
    expect(backend.frames.length).toBe(PRIMING_FRAMES);
  });

  it("writes the frames that fell due, repeating the latest picture", () => {
    const s = create();
    s.start();
    ide.paint(image(80, 60));
    emu.paint(image(40, 20));
    s.tick(); // priming frames 0 and 1; the clock reads 100 ms (frame 1's time)
    now += 350; // 450 ms: frames 2, 3, 4 due
    s.tick();
    expect(backend.frames.length).toBe(5);
    expect(backend.frames[2]).toBe(backend.frames[4]);
    expect(s.repeatedFrames).toBe(2);
  });

  it("downscales the 2x page to 1x and places both windows", () => {
    const s = create();
    s.start();
    ide.paint(image(80, 60, 255, 0, 0));
    emu.paint(image(40, 20, 0, 255, 0));
    s.tick();
    const frame = backend.frames[0];
    expect(px(frame, 60, 0, 0)).toEqual({ r: 255, g: 0, b: 0 });
    expect(px(frame, 60, 45, 15)).toEqual({ r: 0, g: 255, b: 0 });
    expect(px(frame, 60, 45, 0)).toEqual(COLORS.fill);
  });

  it("composes nothing new while the encoder is backed up, but keeps the length", () => {
    const s = create();
    s.start();
    ide.paint(image(80, 60));
    emu.paint(image(40, 20));
    s.tick(); // priming frames 0, 1; the clock starts
    backend.backedUp = true;
    now += 100;
    s.tick(); // frame 2 written; encoder now backed up
    now += 300;
    s.tick();
    expect(backend.frames.length).toBe(3);
    backend.drain();
    s.tick();
    // --- 500 ms on the clock: frames 3, 4, 5 written as repeats of one fresh frame
    expect(backend.frames.length).toBe(6);
  });

  it("starts the clock only once the encoder has taken the first frame", () => {
    const s = create();
    s.start();
    ide.paint(image(80, 60));
    emu.paint(image(40, 20));
    backend.backedUp = true;
    s.tick(); // first priming frame written; FFmpeg is setting its encoder up
    now += 1200;
    s.tick();
    expect(backend.frames.length).toBe(1);
    backend.drain(); // the encoder runs: second priming frame, and the clock starts
    expect(backend.frames.length).toBe(2);
    now += 150;
    s.tick();
    // --- 250 ms on the clock at 10 fps: frame 2 is due, not the 12 that passed during start-up
    expect(backend.frames.length).toBe(3);
    expect(s.repeatedFrames).toBe(0);
  });

  it("pads silence while no sound arrives and trims sound running ahead", () => {
    const s = create();
    s.start();
    ide.paint(image(80, 60));
    emu.paint(image(40, 20));
    s.tick(); // the clock starts, reading 100 ms (the second priming frame's time)
    now += 500;
    s.tick();
    const padded = backend.audio.reduce((n, a) => n + a.length / 2, 0);
    // --- 600 ms on the clock, padded up to 50 ms behind it
    expect(padded).toBe(550);
    s.appendAudio(new Float32Array(1000 * 2));
    const total = backend.audio.reduce((n, a) => n + a.length / 2, 0);
    // --- due 600 + 250 ms lead
    expect(total).toBe(850);
  });

  it("writes the priming frames' silence before the frames themselves", () => {
    const order: string[] = [];
    const appendFrame = backend.appendFrame.bind(backend);
    const appendAudio = backend.appendAudioSamples.bind(backend);
    backend.appendFrame = (f, cb) => (order.push("frame"), appendFrame(f, cb));
    backend.appendAudioSamples = (a) => (order.push(`audio:${a.length / 2}`), appendAudio(a));
    const s = create();
    s.start();
    ide.paint(image(80, 60));
    emu.paint(image(40, 20));
    s.tick();
    // --- 2 frames at 10 fps = 200 ms of silence at 1000 Hz, ahead of the first frame
    expect(order).toEqual(["audio:200", "frame", "frame"]);
  });

  it("drops sound that arrives before the clock starts", () => {
    const s = create();
    s.start();
    s.appendAudio(new Float32Array(100));
    expect(backend.audio.length).toBe(0);
  });

  it("draws the pointer over the window it is in", () => {
    const s = create();
    s.start();
    ide.paint(image(80, 60, 255, 255, 255));
    emu.paint(image(40, 20, 255, 255, 255));
    cursor = { x: 10, y: 10 };
    s.tick();
    // --- The arrow's outline at the hot spot
    expect(px(backend.frames[0], 60, 10, 10)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("no pointer while the emulator holds the mouse", () => {
    const s = create();
    s.start();
    ide.paint(image(80, 60, 255, 255, 255));
    emu.paint(image(40, 20, 255, 255, 255));
    cursor = { x: 10, y: 10 };
    captured = true;
    s.tick();
    expect(px(backend.frames[0], 60, 10, 10)).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("subscribes to mouse buttons only with clicks on, and unsubscribes on stop", async () => {
    const without = create({ clicks: false });
    without.start();
    expect(ide.mouseListeners.length).toBe(0);
    await without.stop();

    const s = create();
    s.start();
    expect(ide.mouseListeners.length).toBe(1);
    expect(emu.blurListeners.length).toBe(1);
    await s.stop();
    expect(ide.mouseListeners.length).toBe(0);
    expect(ide.closedListeners.length).toBe(0);
    expect(ide.endCalls).toBeGreaterThan(0);
    expect(backend.finished).toBe(true);
  });

  it("draws a held ring in the primary colour while the left button is down", () => {
    ide = new FakeWindow({ x: 0, y: 0, width: 80, height: 80 }, 1);
    emu = new FakeWindow({ x: 500, y: 0, width: 20, height: 20 }, 1);
    const big = create();
    big.start();
    ide.paint(image(80, 80));
    emu.paint(image(20, 20));
    cursor = { x: 40, y: 40 };
    ide.press("left", true);
    big.tick();
    // --- Left of the arrow, inside the ring's disc
    expect(px(backend.frames[0], big.layout.width, 32, 40).r).toBeGreaterThan(0);
    expect(px(backend.frames[0], big.layout.width, 32, 40).b).toBe(0);
  });

  it("a press is cleared when the pointer stays outside both windows", () => {
    ide = new FakeWindow({ x: 0, y: 0, width: 80, height: 80 }, 1);
    emu = new FakeWindow({ x: 500, y: 0, width: 20, height: 20 }, 1);
    const s = create();
    s.start();
    ide.paint(image(80, 80));
    emu.paint(image(20, 20));
    ide.press("left", true);
    cursor = { x: -50, y: -50 };
    s.tick();
    now += POINTER_AWAY_RESET_MS;
    s.tick();
    cursor = { x: 40, y: 40 };
    now += 100;
    s.tick();
    const last = backend.frames[backend.frames.length - 1];
    expect(px(last, s.layout.width, 32, 40).r).toBe(0);
  });

  it("a closed window aborts the recording", () => {
    const s = create();
    s.start();
    ide.closedListeners.forEach((l) => l());
    expect(aborted).toBe(1);
  });
});
