import { describe, expect, it } from "vitest";
import { emulatorStateReducer } from "../../src/common/state/emulator-state-reducer";
import type { EmulatorState } from "../../src/common/state/AppState";
import type { Action } from "../../src/common/state/Action";

function reduce(state: EmulatorState, type: Action["type"], payload: any): EmulatorState {
  return emulatorStateReducer(state, { type, payload });
}

describe("emulatorStateReducer sound level", () => {
  it("restores the last unmuted sound level when toggling mute", () => {
    let state: EmulatorState = {
      soundLevel: 0.4,
      soundMuted: false,
      savedSoundLevel: 0.4,
      machineCommandSequence: 0
    };

    state = reduce(state, "MUTE_SOUND", { flag: true });

    expect(state.soundLevel).toBe(0.0);
    expect(state.soundMuted).toBe(true);
    expect(state.savedSoundLevel).toBe(0.4);

    state = reduce(state, "MUTE_SOUND", { flag: false });

    expect(state.soundLevel).toBe(0.4);
    expect(state.soundMuted).toBe(false);
    expect(state.savedSoundLevel).toBe(0.4);
  });

  it("does not overwrite the remembered unmuted level when selecting mute", () => {
    const state = reduce(
      {
        soundLevel: 0.0,
        soundMuted: true,
        savedSoundLevel: 0.2,
        machineCommandSequence: 0
      },
      "SET_SOUND_LEVEL",
      { numValue: 0.0 }
    );

    expect(state.soundLevel).toBe(0.0);
    expect(state.soundMuted).toBe(true);
    expect(state.savedSoundLevel).toBe(0.2);
  });

  it("restores a persisted remembered unmuted level", () => {
    const state = reduce(
      {
        soundLevel: 0.8,
        soundMuted: false,
        savedSoundLevel: 0.8,
        machineCommandSequence: 0
      },
      "SET_SOUND_LEVEL",
      { numValue: 0.0, value: 0.2 }
    );

    expect(state.soundLevel).toBe(0.0);
    expect(state.soundMuted).toBe(true);
    expect(state.savedSoundLevel).toBe(0.2);
  });
});

describe("emulatorStateReducer screen recording", () => {
  it("updates recording availability", () => {
    const state = reduce(
      {
        machineCommandSequence: 0
      },
      "SET_SCREEN_RECORDING_AVAILABLE",
      { flag: false }
    );

    expect(state.screenRecordingAvailable).toBe(false);
  });

  it("updates recording state and frame rate", () => {
    const state = reduce(
      {
        machineCommandSequence: 0
      },
      "SET_SCREEN_RECORDING_STATE",
      { id: "armed", value: "/tmp/out.mp4", text: "half" }
    );

    expect(state.screenRecordingState).toBe("armed");
    expect(state.screenRecordingFile).toBe("/tmp/out.mp4");
    expect(state.screenRecordingFps).toBe("half");
  });

  it("updates recording quality and format", () => {
    let state = reduce(
      {
        machineCommandSequence: 0
      },
      "SET_SCREEN_RECORDING_QUALITY",
      { id: "lossless" }
    );

    state = reduce(state, "SET_SCREEN_RECORDING_FORMAT", { id: "webm" });

    expect(state.screenRecordingQuality).toBe("lossless");
    expect(state.screenRecordingFormat).toBe("webm");
  });
});
