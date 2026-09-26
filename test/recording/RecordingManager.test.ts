import { describe, it, expect, vi, beforeEach } from "vitest";
import { RECORDING_SURROUND, RecordingManager } from "@renderer/appEmu/recording/RecordingManager";

// ---------------------------------------------------------------------------
// Minimal mock for MainApi — only the three recording methods are needed
// ---------------------------------------------------------------------------
const makeMainApi = () => ({
  startScreenRecording: vi.fn().mockResolvedValue("/tmp/recording_test.txt"),
  appendRecordingFrame: vi.fn().mockResolvedValue(undefined),
  appendRecordingAudio: vi.fn().mockResolvedValue(undefined),
  stopScreenRecording: vi.fn().mockResolvedValue("/tmp/recording_test.txt")
});

const makeDispatch = () => vi.fn();

const RGBA = new Uint8Array(352 * 296 * 4);
const W = 352;
const H = 296;
const FPS = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeManager() {
  const mainApi = makeMainApi();
  const dispatch = makeDispatch();
  const manager = new RecordingManager(mainApi as any, dispatch);
  return { manager, mainApi, dispatch };
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------
describe("RecordingManager — state machine", () => {
  it("initial state is idle", () => {
    const { manager } = makeManager();
    expect(manager.state).toBe("idle");
  });

  it("arm() moves idle → armed and dispatches", () => {
    const { manager, dispatch } = makeManager();
    manager.arm("native");
    expect(manager.state).toBe("armed");
    expect(dispatch).toHaveBeenCalledOnce();
  });

  it("arm() is a no-op when not idle", () => {
    const { manager, dispatch } = makeManager();
    manager.arm("native");
    manager.arm("half"); // second call — should be ignored
    expect(manager.state).toBe("armed");
    expect(dispatch).toHaveBeenCalledOnce();
  });

  it("disarm() from armed cancels without IPC call", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("native");
    await manager.disarm();
    expect(manager.state).toBe("idle");
    expect(mainApi.stopScreenRecording).not.toHaveBeenCalled();
  });

  it("disarm() from idle is a no-op", async () => {
    const { manager, dispatch } = makeManager();
    await manager.disarm();
    expect(manager.state).toBe("idle");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("onMachineRunning while armed → recording; calls startScreenRecording", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("native");
    await manager.onMachineRunning(W, H, FPS);
    expect(manager.state).toBe("recording");
    expect(mainApi.startScreenRecording).toHaveBeenCalledWith(W, H, FPS, 1, 1, 44100, 18, "mp4");
  });

  it("onMachineRunning while idle → stays idle", async () => {
    const { manager, mainApi } = makeManager();
    await manager.onMachineRunning(W, H, FPS);
    expect(manager.state).toBe("idle");
    expect(mainApi.startScreenRecording).not.toHaveBeenCalled();
  });

  it("onMachinePaused while recording → paused", async () => {
    const { manager } = makeManager();
    manager.arm("native");
    await manager.onMachineRunning(W, H, FPS);
    manager.onMachinePaused();
    expect(manager.state).toBe("paused");
  });

  it("onMachinePaused while idle → stays idle", () => {
    const { manager } = makeManager();
    manager.onMachinePaused();
    expect(manager.state).toBe("idle");
  });

  it("onMachineRunning while paused → recording resumes (no new IPC start)", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("native");
    await manager.onMachineRunning(W, H, FPS);
    manager.onMachinePaused();
    await manager.onMachineRunning(W, H, FPS);
    expect(manager.state).toBe("recording");
    // startScreenRecording called only once (on first start, not on resume)
    expect(mainApi.startScreenRecording).toHaveBeenCalledOnce();
  });

  it("onMachineStopped while recording → idle; calls stopScreenRecording", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("native");
    await manager.onMachineRunning(W, H, FPS);
    await manager.onMachineStopped();
    expect(manager.state).toBe("idle");
    expect(mainApi.stopScreenRecording).toHaveBeenCalledOnce();
  });

  it("onMachineStopped while paused → idle; calls stopScreenRecording", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("native");
    await manager.onMachineRunning(W, H, FPS);
    manager.onMachinePaused();
    await manager.onMachineStopped();
    expect(manager.state).toBe("idle");
    expect(mainApi.stopScreenRecording).toHaveBeenCalledOnce();
  });

  it("onMachineStopped while armed → idle; does NOT call stopScreenRecording", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("native");
    await manager.onMachineStopped();
    expect(manager.state).toBe("idle");
    expect(mainApi.stopScreenRecording).not.toHaveBeenCalled();
  });

  it("disarm() while recording → idle; calls stopScreenRecording", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("native");
    await manager.onMachineRunning(W, H, FPS);
    await manager.disarm();
    expect(manager.state).toBe("idle");
    expect(mainApi.stopScreenRecording).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Frame submission
// ---------------------------------------------------------------------------
describe("RecordingManager — submitFrame", () => {
  it("submitFrame while idle does not call appendRecordingFrame", async () => {
    const { manager, mainApi } = makeManager();
    await manager.submitFrame(RGBA);
    expect(mainApi.appendRecordingFrame).not.toHaveBeenCalled();
  });

  it("submitFrame while recording calls appendRecordingFrame", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("native");
    await manager.onMachineRunning(W, H, FPS);
    await manager.submitFrame(RGBA);
    expect(mainApi.appendRecordingFrame).toHaveBeenCalledOnce();
  });

  it("submitFrame while paused does not send frame", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("native");
    await manager.onMachineRunning(W, H, FPS);
    manager.onMachinePaused();
    await manager.submitFrame(RGBA);
    expect(mainApi.appendRecordingFrame).not.toHaveBeenCalled();
  });

  it("native fps: every frame is sent", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("native");
    await manager.onMachineRunning(W, H, FPS);
    for (let i = 0; i < 4; i++) await manager.submitFrame(RGBA);
    expect(mainApi.appendRecordingFrame).toHaveBeenCalledTimes(4);
  });

  it("half fps: every other frame is sent", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("half");
    await manager.onMachineRunning(W, H, FPS);
    for (let i = 0; i < 6; i++) await manager.submitFrame(RGBA);
    // captureCount goes 1,2,3,4,5,6 — odd counts (1,3,5) are skipped
    expect(mainApi.appendRecordingFrame).toHaveBeenCalledTimes(3);
  });

  it("startScreenRecording uses half the fps for half mode", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("half");
    await manager.onMachineRunning(W, H, FPS);
    expect(mainApi.startScreenRecording).toHaveBeenCalledWith(W, H, 25, 1, 1, 44100, 18, "mp4"); // 50/2
  });

  it("startScreenRecording forwards xRatio and yRatio from onMachineRunning", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("native");
    await manager.onMachineRunning(W, H, FPS, 0.5, 1);
    expect(mainApi.startScreenRecording).toHaveBeenCalledWith(W, H, FPS, 0.5, 1, 44100, 18, "mp4");
  });

  it("startScreenRecording forwards sampleRate from onMachineRunning", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("native");
    await manager.onMachineRunning(W, H, FPS, 1, 1, 48000);
    expect(mainApi.startScreenRecording).toHaveBeenCalledWith(W, H, FPS, 1, 1, 48000, 18, "mp4");
  });

  it("captureCount resets on each new recording session", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("half");
    await manager.onMachineRunning(W, H, FPS);
    for (let i = 0; i < 4; i++) await manager.submitFrame(RGBA); // sends 2
    await manager.disarm();

    manager.arm("half");
    await manager.onMachineRunning(W, H, FPS);
    for (let i = 0; i < 4; i++) await manager.submitFrame(RGBA); // sends 2 again

    // 2 from first + 2 from second = 4 total
    expect(mainApi.appendRecordingFrame).toHaveBeenCalledTimes(4);
  });
});

// ---------------------------------------------------------------------------
// Audio submission
// ---------------------------------------------------------------------------

const AUDIO_SAMPLES = Array.from({ length: 882 }, (_, i) => ({
  left: i % 2 === 0 ? 0.5 : -0.5,
  right: i % 2 === 0 ? 0.5 : -0.5
}));

describe("RecordingManager — submitAudioSamples", () => {
  it("submitAudioSamples while idle does not call appendRecordingAudio", async () => {
    const { manager, mainApi } = makeManager();
    await manager.submitAudioSamples(AUDIO_SAMPLES);
    expect(mainApi.appendRecordingAudio).not.toHaveBeenCalled();
  });

  it("submitAudioSamples while recording calls appendRecordingAudio", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("native");
    await manager.onMachineRunning(W, H, FPS);
    await manager.submitFrame(RGBA); // captureCount = 1
    await manager.submitAudioSamples(AUDIO_SAMPLES);
    expect(mainApi.appendRecordingAudio).toHaveBeenCalledOnce();
  });

  it("submitAudioSamples converts AudioSample[] to interleaved Float32Array", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("native");
    await manager.onMachineRunning(W, H, FPS);
    await manager.submitFrame(RGBA);
    const twoSamples = [{ left: 0.1, right: 0.2 }, { left: 0.3, right: 0.4 }];
    await manager.submitAudioSamples(twoSamples);
    const sent: Float32Array = mainApi.appendRecordingAudio.mock.calls[0][0];
    expect(sent).toBeInstanceOf(Float32Array);
    expect(sent.length).toBe(4);
    // Float32 has limited precision; check values are close to expected
    const expected = [0.1, 0.2, 0.3, 0.4];
    for (let i = 0; i < expected.length; i++) {
      expect(sent[i]).toBeCloseTo(expected[i], 5);
    }
  });

  it("submitAudioSamples while paused does not send audio", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("native");
    await manager.onMachineRunning(W, H, FPS);
    manager.onMachinePaused();
    await manager.submitAudioSamples(AUDIO_SAMPLES);
    expect(mainApi.appendRecordingAudio).not.toHaveBeenCalled();
  });

  it("half fps: every frame's audio is kept, even when its video frame is skipped", async () => {
    // --- Half fps halves the frames *and* the frame rate, so the video keeps its duration. Dropping
    // --- the skipped frames' audio left a recording with half its sound: with the real FFmpeg,
    // --- 2 s of half-fps video carried 0.98 s of audio (issue #1374).
    const { manager, mainApi } = makeManager();
    manager.arm("half");
    await manager.onMachineRunning(W, H, FPS);
    // Frame 1: captureCount=1 (odd) - video skipped, audio kept
    await manager.submitFrame(RGBA);
    await manager.submitAudioSamples(AUDIO_SAMPLES);
    expect(mainApi.appendRecordingFrame).not.toHaveBeenCalled();
    expect(mainApi.appendRecordingAudio).toHaveBeenCalledOnce();
    // Frame 2: captureCount=2 (even) - both sent
    await manager.submitFrame(RGBA);
    await manager.submitAudioSamples(AUDIO_SAMPLES);
    expect(mainApi.appendRecordingFrame).toHaveBeenCalledOnce();
    expect(mainApi.appendRecordingAudio).toHaveBeenCalledTimes(2);
  });

  it("half fps: a machine sending audio for several frames per video frame keeps all of it", async () => {
    // --- The Cambridge Z88: eight 5 ms audio frames per displayed (and captured) frame
    const { manager, mainApi } = makeManager();
    manager.arm("half");
    await manager.onMachineRunning(W, H, 25);
    for (let uiFrame = 0; uiFrame < 4; uiFrame++) {
      for (let i = 0; i < 8; i++) await manager.submitAudioSamples(AUDIO_SAMPLES);
      await manager.submitFrame(RGBA);
    }
    expect(mainApi.appendRecordingFrame).toHaveBeenCalledTimes(2);
    expect(mainApi.appendRecordingAudio).toHaveBeenCalledTimes(32);
  });

  it("submitAudioSamples with empty array is a no-op", async () => {
    const { manager, mainApi } = makeManager();
    manager.arm("native");
    await manager.onMachineRunning(W, H, FPS);
    await manager.submitFrame(RGBA);
    await manager.submitAudioSamples([]);
    expect(mainApi.appendRecordingAudio).not.toHaveBeenCalled();
  });

  // ---- A picture with no border of its own (the Cambridge Z88's LCD, issue #1374) --------------

  describe("the surround of a picture with no border of its own", () => {
    const LW = 4;
    const LH = 2;
    const LCD_UNLIT = 0xffb9e0d2; // --- ABGR: the Z88 core's unlit pixel, bytes 210,224,185,255
    const LCD_OFF = 0xffa0a0a0;
    const picture = new Uint8Array(LW * LH * 4).map((_, i) => (i % 4 === 3 ? 255 : 7));

    it("records the picture inside a RECORDING_SURROUND-pixel surround in the machine's colour", async () => {
      const { manager, mainApi } = makeManager();
      manager.arm("native");
      await manager.onMachineRunning(LW, LH, 25, 1, 1, 44100, () => LCD_UNLIT);
      const outW = LW + 2 * RECORDING_SURROUND;
      const outH = LH + 2 * RECORDING_SURROUND;
      expect(mainApi.startScreenRecording.mock.calls[0].slice(0, 2)).toEqual([outW, outH]);

      await manager.submitFrame(picture);
      const sent: Uint8Array = mainApi.appendRecordingFrame.mock.calls[0][0];
      expect(sent.length).toBe(outW * outH * 4);
      const px = (x: number, y: number) => Array.from(sent.subarray((y * outW + x) * 4, (y * outW + x) * 4 + 4));
      // --- The corners the player rounds are surround...
      expect(px(0, 0)).toEqual([210, 224, 185, 255]);
      expect(px(outW - 1, outH - 1)).toEqual([210, 224, 185, 255]);
      // --- ...and the picture is unchanged inside it
      for (let y = 0; y < LH; y++) {
        for (let x = 0; x < LW; x++) {
          expect(px(x + RECORDING_SURROUND, y + RECORDING_SURROUND)).toEqual([7, 7, 7, 255]);
        }
      }
    });

    it("follows the machine's colour from frame to frame (the LCD switched off)", async () => {
      const { manager, mainApi } = makeManager();
      let color = LCD_UNLIT;
      manager.arm("native");
      await manager.onMachineRunning(LW, LH, 25, 1, 1, 44100, () => color);
      await manager.submitFrame(picture);
      const first = Array.from((mainApi.appendRecordingFrame.mock.calls[0][0] as Uint8Array).subarray(0, 4));
      color = LCD_OFF;
      await manager.submitFrame(picture);
      const second = Array.from((mainApi.appendRecordingFrame.mock.calls[1][0] as Uint8Array).subarray(0, 4));
      expect(first).toEqual([210, 224, 185, 255]);
      expect(second).toEqual([160, 160, 160, 255]);
    });

    it("records a machine with its own border (a Spectrum) exactly as before", async () => {
      const { manager, mainApi } = makeManager();
      manager.arm("native");
      await manager.onMachineRunning(W, H, FPS);
      expect(mainApi.startScreenRecording.mock.calls[0].slice(0, 2)).toEqual([W, H]);
      await manager.submitFrame(RGBA);
      expect(mainApi.appendRecordingFrame).toHaveBeenCalledWith(RGBA);
    });
  });
});
