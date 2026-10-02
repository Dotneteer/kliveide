import path from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports of the module under test)
// ---------------------------------------------------------------------------

// Mock ffmpegAvailable so tests don't require the real binary on any platform.
vi.mock("@main/recording/ffmpegAvailable", () => ({
  isFFmpegAvailable: () => true,
  getFFmpegPath: () => "/fake/ffmpeg",
}));

// Mock child_process.spawn.
// The fake process auto-resolves the exit promise via a microtask when
// stdin.end() is called, so `await backend.finish()` works naturally.
const failures = vi.hoisted(() => ({
  exit: null as ((code: number | null, signal?: string) => void) | null,
  error: null as ((err: Error) => void) | null,
  stderr: null as ((chunk: string) => void) | null,
  /** When set, closing stdin exits FFmpeg with this code instead of 0 */
  exitCodeOnEnd: 0
}));

vi.mock("child_process", () => {
  let _exitCb: ((code: number | null) => void) | null = null;

  const mockStdin = {
    write: vi.fn(() => true),
    end: vi.fn(() => {
      // Simulate FFmpeg exiting (cleanly, unless a test says otherwise) after stdin is closed.
      Promise.resolve().then(() => _exitCb?.(failures.exitCodeOnEnd));
    }),
    on: vi.fn(),
  };

  const mockAudioPipe = {
    write: vi.fn(() => true),
    end: vi.fn(),
    on: vi.fn(),
  };

  const mockStderr = {
    setEncoding: vi.fn(),
    on: vi.fn((event: string, cb: (chunk: string) => void) => {
      if (event === "data") failures.stderr = cb;
    }),
  };

  const mockProcess = {
    stdin: mockStdin,
    stdio: [mockStdin, undefined, mockStderr, mockAudioPipe],
    stderr: mockStderr,
    once: vi.fn((event: string, cb: (arg: any) => void) => {
      if (event === "exit") {
        _exitCb = cb;
        failures.exit = cb;
      }
      if (event === "error") failures.error = cb;
    }),
  };

  return { spawn: vi.fn(() => mockProcess) };
});

// ---------------------------------------------------------------------------
// Imports after mocks are declared
// ---------------------------------------------------------------------------
import { spawn } from "child_process";
import { FfmpegRecordingBackend } from "@main/recording/FfmpegRecordingBackend";
import { expectConsole } from "../expectedConsole";

// --- The backend rebuilds the path with path.join, so the expectation must use the
// --- native separator too (backslashes on Windows).
const OUTPUT = path.join("/tmp/KliveExports", "recording_20260228_140500.mp4");
const W = 352;
const H = 288;
const FPS = 50;
const RGBA = new Uint8Array(W * H * 4).fill(128);

describe("FfmpegRecordingBackend", () => {
  let backend: FfmpegRecordingBackend;

  beforeEach(() => {
    vi.clearAllMocks();
    failures.exitCodeOnEnd = 0;
    backend = new FfmpegRecordingBackend();
  });

  // ---- B1: spawn is called with correct arguments ------------------------

  it("start() spawns ffmpeg with the correct rawvideo arguments", () => {
    backend.start(OUTPUT, W, H, FPS);
    expect(spawn).toHaveBeenCalledOnce();
    const [bin, args] = vi.mocked(spawn).mock.calls[0];
    expect(bin).toBe("/fake/ffmpeg");
    expect(args).toContain("-f");
    expect(args).toContain("rawvideo");
    expect(args).toContain("-pix_fmt");
    expect(args).toContain("rgba");
    expect(args).toContain(`${W}x${H}`);
    expect(args).toContain(String(FPS));
    expect(args).toContain("pipe:0");
    expect(args).toContain("libx264");
    expect(args.some((a: string) => a.includes("format=yuv420p"))).toBe(true);
    expect(args[args.length - 1]).toBe(OUTPUT);
  });

  it("start() includes audio input args for pipe:3 (f32le stereo)", () => {
    backend.start(OUTPUT, W, H, FPS, 1, 1, 44100);
    const args = vi.mocked(spawn).mock.calls[0][1];
    expect(args).toContain("f32le");
    expect(args).toContain("44100");
    expect(args).toContain("2");
    expect(args).toContain("pipe:3");
    expect(args).toContain("aac");
    expect(args).toContain("192k");
  });

  it("start() does not probe the raw audio input (its format is given in full)", () => {
    backend.start(OUTPUT, W, H, FPS);
    const args = vi.mocked(spawn).mock.calls[0][1] as string[];
    const audioInput = args.indexOf("pipe:3");
    const probe = args.indexOf("-analyzeduration");
    expect(probe).toBeGreaterThan(args.indexOf("pipe:0"));
    expect(probe).toBeLessThan(audioInput);
    expect(args[probe + 1]).toBe("0");
    expect(args[args.indexOf("-probesize") + 1]).toBe("32");
  });

  it("start() passes stdio: ['pipe','ignore','pipe','pipe'] for video+audio", () => {
    backend.start(OUTPUT, W, H, FPS);
    const opts = vi.mocked(spawn).mock.calls[0][2];
    expect(opts?.stdio).toEqual(["pipe", "ignore", "pipe", "pipe"]);
  });

  // ---- B2: appendFrame writes to stdin -----------------------------------

  it("appendFrame() writes the RGBA buffer to ffmpeg stdin", () => {
    backend.start(OUTPUT, W, H, FPS);
    backend.appendFrame(RGBA);
    const { stdin } = (spawn as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(stdin.write).toHaveBeenCalledOnce();
    const written: Buffer = stdin.write.mock.calls[0][0];
    expect(written.byteLength).toBe(RGBA.byteLength);
  });

  it("appendFrame() is a no-op before start()", () => {
    // should not throw
    expect(() => backend.appendFrame(RGBA)).not.toThrow();
  });

  // ---- B3: holdFrame re-sends last frame ---------------------------------

  it("holdFrame() re-writes the last frame buffer", () => {
    backend.start(OUTPUT, W, H, FPS);
    backend.appendFrame(RGBA);
    backend.holdFrame();
    const { stdin } = (spawn as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(stdin.write).toHaveBeenCalledTimes(2);
    // Both write calls should carry the same content
    expect(stdin.write.mock.calls[1][0]).toEqual(stdin.write.mock.calls[0][0]);
  });

  it("holdFrame() also re-sends the last audio chunk to the audio pipe", () => {
    backend.start(OUTPUT, W, H, FPS);
    const proc = (spawn as ReturnType<typeof vi.fn>).mock.results[0].value;
    const AUDIO = new Float32Array([0.1, -0.1, 0.2, -0.2]);
    backend.appendFrame(RGBA);
    backend.appendAudioSamples(AUDIO);
    backend.holdFrame();
    // Audio pipe write should have been called: once for appendAudioSamples, once for holdFrame
    expect(proc.stdio[3].write).toHaveBeenCalledTimes(2);
    expect(proc.stdio[3].write.mock.calls[1][0]).toEqual(proc.stdio[3].write.mock.calls[0][0]);
  });

  // ---- C2: audio pipe ---------------------------------------------------

  it("appendAudioSamples() writes raw f32le bytes to the audio pipe (fd 3)", () => {
    backend.start(OUTPUT, W, H, FPS);
    const proc = (spawn as ReturnType<typeof vi.fn>).mock.results[0].value;
    const AUDIO = new Float32Array([0.5, -0.5, 0.25, -0.25]);
    backend.appendAudioSamples(AUDIO);
    expect(proc.stdio[3].write).toHaveBeenCalledOnce();
    const written: Buffer = proc.stdio[3].write.mock.calls[0][0];
    expect(written.byteLength).toBe(AUDIO.byteLength);
    // Verify actual bytes match the Float32Array
    const view = new Float32Array(written.buffer, written.byteOffset, written.byteLength / 4);
    expect(Array.from(view)).toEqual(Array.from(AUDIO));
  });

  it("appendAudioSamples() is a no-op before start()", () => {
    const AUDIO = new Float32Array([0.1, 0.2]);
    expect(() => backend.appendAudioSamples(AUDIO)).not.toThrow();
  });

  it("finish() closes both stdin and the audio pipe before resolving", async () => {
    backend.start(OUTPUT, W, H, FPS);
    const proc = (spawn as ReturnType<typeof vi.fn>).mock.results[0].value;
    await backend.finish();
    expect(proc.stdin.end).toHaveBeenCalledOnce();
    expect(proc.stdio[3].end).toHaveBeenCalledOnce();
  });

  // ---- B4: pixel stretching -----------------------------------------------

  it("with xRatio=1, yRatio=1 the written buffer has the same size as the input", () => {
    backend.start(OUTPUT, W, H, FPS, 1, 1);
    backend.appendFrame(RGBA);
    const { stdin } = (spawn as ReturnType<typeof vi.fn>).mock.results[0].value;
    const written: Buffer = stdin.write.mock.calls[0][0];
    expect(written.byteLength).toBe(W * H * 4);
  });

  it("with xRatio=0.5, yRatio=1 (scaleY=2) the written buffer has double height", () => {
    // ratX=0.5, ratY=1 → min=0.5, scaleX=1, scaleY=2 → outW=W, outH=H*2
    backend.start(OUTPUT, W, H, FPS, 0.5, 1);
    backend.appendFrame(RGBA);
    const { stdin } = (spawn as ReturnType<typeof vi.fn>).mock.results[0].value;
    const written: Buffer = stdin.write.mock.calls[0][0];
    expect(written.byteLength).toBe(W * H * 2 * 4);
  });

  it("with xRatio=0.5, yRatio=1 output row 0 and row 1 are identical (line duplication)", () => {
    // Fill source with gradient so each row has a unique value
    const src = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        src[(y * W + x) * 4]     = y & 0xff; // R encodes row
        src[(y * W + x) * 4 + 1] = x & 0xff; // G encodes col
        src[(y * W + x) * 4 + 2] = 0;
        src[(y * W + x) * 4 + 3] = 255;
      }
    }
    backend.start(OUTPUT, W, H, FPS, 0.5, 1);
    backend.appendFrame(src);
    const { stdin } = (spawn as ReturnType<typeof vi.fn>).mock.results[0].value;
    const out: Buffer = stdin.write.mock.calls[0][0];
    // Output row 0 and row 1 must both be copies of source row 0
    for (let ox = 0; ox < W; ox++) {
      expect(out[ox * 4]).toBe(0);       // R = source row 0
      expect(out[(W + ox) * 4]).toBe(0); // row 1 R = source row 0
    }
    // Output row 2 must be a copy of source row 1
    for (let ox = 0; ox < W; ox++) {
      expect(out[(2 * W + ox) * 4]).toBe(1); // R = source row 1
    }
  });

  it("with xRatio=1, yRatio=0.5 (scaleX=2) the written buffer has double width", () => {
    // ratX=1, ratY=0.5 → min=0.5, scaleX=2, scaleY=1 → outW=W*2, outH=H
    backend.start(OUTPUT, W, H, FPS, 1, 0.5);
    backend.appendFrame(RGBA);
    const { stdin } = (spawn as ReturnType<typeof vi.fn>).mock.results[0].value;
    const written: Buffer = stdin.write.mock.calls[0][0];
    expect(written.byteLength).toBe(W * 2 * H * 4);
  });

  it("FFmpeg is told the stretched dimensions, not raw dimensions", () => {
    // xRatio=0.5, yRatio=1 → outW=W, outH=H*2
    backend.start(OUTPUT, W, H, FPS, 0.5, 1);
    const args = vi.mocked(spawn).mock.calls[0][1];
    const sIdx = args.indexOf("-s") + 1;
    expect(args[sIdx]).toBe(`${W}x${H * 2}`);
  });

  // ---- B5: finish ends stdin and returns path ----------------------------

  it("finish() calls stdin.end() and returns the output path", async () => {
    backend.start(OUTPUT, W, H, FPS);
    const result = await backend.finish();
    const { stdin } = (spawn as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(stdin.end).toHaveBeenCalledOnce();
    expect(result).toBe(OUTPUT);
  });

  it("finish() resolves only after the process exits", async () => {
    backend.start(OUTPUT, W, H, FPS);
    const result = await backend.finish();
    expect(result).toBe(OUTPUT);
  });

  it("finish() before start() returns empty string without throwing", async () => {
    await expect(backend.finish()).resolves.toBe("");
  });

  // ---- B6: a recording that wrote nothing says so (issue #1374) -----------

  it("finish() rejects with the reason when FFmpeg could not be started", async () => {
    const consoleError = expectConsole("error");
    // --- A packaged build spawning the binary's path inside app.asar: the folder was created and
    // --- nothing else, and finish() used to report success
    backend.start(OUTPUT, W, H, FPS);
    failures.error!(Object.assign(new Error("spawn ENOTDIR"), { code: "ENOTDIR" }));
    backend.appendFrame(RGBA); // --- ignored once FFmpeg is gone
    await expect(backend.finish()).rejects.toThrow(/could not be started \(\/fake\/ffmpeg\): spawn ENOTDIR/);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("[FFmpegBackend] FFmpeg could not be started")
    );
  });

  it("finish() rejects with FFmpeg's last words when it exits early", async () => {
    const consoleError = expectConsole("error");
    backend.start(OUTPUT, W, H, FPS);
    failures.stderr!("Input #0, rawvideo\nSomething odd\n[aac] Too many bits\n");
    failures.exit!(1);
    await expect(backend.finish()).rejects.toThrow(/exited with code 1:[\s\S]*Too many bits/);
    expect(consoleError).toHaveBeenCalledWith(
      "[FFmpegBackend] FFmpeg exited with code 1"
    );
  });

  it("finish() rejects when FFmpeg fails while finishing the file", async () => {
    const consoleError = expectConsole("error");
    backend.start(OUTPUT, W, H, FPS);
    failures.exitCodeOnEnd = 1;
    await expect(backend.finish()).rejects.toThrow(/exited with code 1/);
    expect(consoleError).toHaveBeenCalledWith(
      "[FFmpegBackend] FFmpeg exited with code 1"
    );
  });

  it("a failure does not leak into the next recording", async () => {
    const consoleError = expectConsole("error");
    backend.start(OUTPUT, W, H, FPS);
    failures.exit!(1);
    await expect(backend.finish()).rejects.toThrow();
    backend.start(OUTPUT, W, H, FPS);
    await expect(backend.finish()).resolves.toBe(OUTPUT);
    expect(consoleError).toHaveBeenCalledWith(
      "[FFmpegBackend] FFmpeg exited with code 1"
    );
  });

  // ---- IDE + Emulator recording options ----------------------------------

  describe("window recording options", () => {
    const stdinOf = () => (spawn as ReturnType<typeof vi.fn>).mock.results[0].value.stdin;

    it("start() with pixelFormat bgra tells FFmpeg the frames are BGRA", () => {
      backend.start(OUTPUT, W, H, 30, 1, 1, 44100, 18, "mp4", { pixelFormat: "bgra" });
      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      expect(args[args.indexOf("-pix_fmt") + 1]).toBe("bgra");
    });

    it("realtime selects the veryfast preset for H.264 and H.265", () => {
      backend.start(OUTPUT, W, H, 30, 1, 1, 44100, 18, "mp4", { realtime: true });
      let args = vi.mocked(spawn).mock.calls[0][1] as string[];
      expect(args[args.indexOf("-preset") + 1]).toBe("veryfast");
      backend.start(OUTPUT, W, H, 30, 1, 1, 44100, 18, "mkv", { realtime: true });
      args = vi.mocked(spawn).mock.calls[1][1] as string[];
      expect(args[args.indexOf("-preset") + 1]).toBe("veryfast");
    });

    it("realtime keeps VP9 in realtime mode even when lossless", () => {
      backend.start(OUTPUT, W, H, 30, 1, 1, 44100, 0, "webm", { realtime: true });
      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      expect(args[args.indexOf("-deadline") + 1]).toBe("realtime");
    });

    it("without options the presets are unchanged", () => {
      backend.start(OUTPUT, W, H, 30, 1, 1, 44100, 18, "mp4");
      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      expect(args[args.indexOf("-preset") + 1]).toBe("fast");
    });

    it("appendFrame() returns write()'s backpressure flag and passes the callback", () => {
      backend.start(OUTPUT, W, H, FPS);
      const stdin = stdinOf();
      stdin.write.mockImplementationOnce((_buf: Buffer, cb?: () => void) => {
        cb?.();
        return false;
      });
      const written = vi.fn();
      expect(backend.appendFrame(RGBA, written)).toBe(false);
      expect(written).toHaveBeenCalledOnce();
      expect(backend.appendFrame(RGBA)).toBe(true);
    });

    it("onceDrained() calls back at once when FFmpeg is not backed up", () => {
      backend.start(OUTPUT, W, H, FPS);
      const cb = vi.fn();
      backend.onceDrained(cb);
      expect(cb).toHaveBeenCalledOnce();
    });

    it("onceDrained() waits for 'drain' when FFmpeg is backed up", () => {
      backend.start(OUTPUT, W, H, FPS);
      const stdin = stdinOf();
      const handlers: Record<string, () => void> = {};
      stdin.writableNeedDrain = true;
      stdin.once = vi.fn((event: string, fn: () => void) => (handlers[event] = fn));
      stdin.off = vi.fn();
      const cb = vi.fn();
      backend.onceDrained(cb);
      expect(cb).not.toHaveBeenCalled();
      handlers.drain();
      handlers.close();
      expect(cb).toHaveBeenCalledOnce();
      stdin.writableNeedDrain = false;
    });

    it("appendFrame() before start() still releases the buffer", () => {
      const cb = vi.fn();
      expect(backend.appendFrame(RGBA, cb)).toBe(true);
      expect(cb).toHaveBeenCalledOnce();
    });
  });
});
