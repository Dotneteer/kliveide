import { describe, expect, it } from "vitest";
import { emulatorStateReducer } from "../../src/common/state/emulator-state-reducer";
import type { EmulatorState } from "../../src/common/state/AppState";

function reduce(state: EmulatorState, type: "MUTE_SOUND" | "SET_SOUND_LEVEL", payload: any): EmulatorState {
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
