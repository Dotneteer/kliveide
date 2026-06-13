import { describe, expect, it } from "vitest";
import type { MainApi } from "../../src/common/messaging/MainApi";
import type { Action } from "../../src/common/state/Action";
import { RecordingManager } from "../../src/renderer/lib/recording/RecordingManager";

class FakeMainApi implements Partial<MainApi> {
  frameCount = 0;
  audioBatches: Float32Array[] = [];
  started: unknown[] | undefined;
  stopped = false;

  async startScreenRecording(...args: unknown[]): Promise<string> {
    this.started = args;
    return "/tmp/recording.mp4";
  }

  async appendRecordingFrame(_rgba: Uint8Array): Promise<void> {
    this.frameCount++;
  }

  async appendRecordingAudio(samples: Float32Array): Promise<void> {
    this.audioBatches.push(samples);
  }

  async stopScreenRecording(): Promise<string> {
    this.stopped = true;
    return "/tmp/recording.mp4";
  }
}

describe("RecordingManager", () => {
  it("starts when an armed machine starts running", async () => {
    const api = new FakeMainApi();
    const actions: Action[] = [];
    const manager = new RecordingManager(api as MainApi, (action) => actions.push(action));

    manager.arm();
    await manager.onMachineRunning(352, 296, 50, 1, 1, 48000);

    expect(manager.state).toBe("recording");
    expect(api.started).toEqual([352, 296, 50, 1, 1, 48000, 18, "mp4"]);
    expect(actions.at(-1)).toEqual({
      type: "SET_SCREEN_RECORDING_STATE",
      payload: { id: "recording", value: "/tmp/recording.mp4", text: "native" }
    });
  });

  it("skips matching frame and audio batches in half-fps mode", async () => {
    const api = new FakeMainApi();
    const manager = new RecordingManager(api as MainApi, () => undefined);

    manager.setFpsPreference("half");
    manager.arm();
    await manager.onMachineRunning(352, 296, 50, 1, 1, 48000);
    await manager.submitFrame(new Uint8Array(4));
    await manager.submitAudioSamples([{ left: 32768, right: 0 }]);
    await manager.submitFrame(new Uint8Array(4));
    await manager.submitAudioSamples([{ left: 32768, right: 0 }]);

    expect(api.started?.[2]).toBe(25);
    expect(api.frameCount).toBe(1);
    expect(api.audioBatches).toHaveLength(1);
    expect([...api.audioBatches[0]]).toEqual([1, 1]);
  });

  it("finalizes active recordings when stopped", async () => {
    const api = new FakeMainApi();
    const actions: Action[] = [];
    const manager = new RecordingManager(api as MainApi, (action) => actions.push(action));

    manager.arm();
    await manager.onMachineRunning(352, 296, 50);
    await manager.onMachineStopped();

    expect(manager.state).toBe("idle");
    expect(api.stopped).toBe(true);
    expect(actions.at(-1)).toEqual({
      type: "SET_SCREEN_RECORDING_STATE",
      payload: { id: "idle", value: undefined, text: undefined }
    });
  });
});
