import { describe, it, expect } from "vitest";
import { emulatorStateReducer } from "@common/state/emulator-state-reducer";
import { setScreenRecordingStateAction } from "@common/state/actions";
import type { EmulatorState } from "@common/state/AppState";

const baseState: EmulatorState = {
  breakpointsVersion: 0,
  emuViewVersion: 0
};

describe("screenRecording reducer", () => {
  it("idle → armed: sets state and fps, leaves file undefined", () => {
    const action = setScreenRecordingStateAction("armed", undefined, "native");
    const next = emulatorStateReducer(baseState, action);
    expect(next.screenRecordingState).toBe("armed");
    expect(next.screenRecordingFps).toBe("native");
    expect(next.screenRecordingFile).toBeUndefined();
  });

  it("armed → idle: clears back to idle", () => {
    const armed: EmulatorState = { ...baseState, screenRecordingState: "armed", screenRecordingFps: "native" };
    const action = setScreenRecordingStateAction("idle");
    const next = emulatorStateReducer(armed, action);
    expect(next.screenRecordingState).toBe("idle");
  });

  it("armed → recording: sets state and file path", () => {
    const armed: EmulatorState = { ...baseState, screenRecordingState: "armed", screenRecordingFps: "native" };
    const action = setScreenRecordingStateAction("recording", "/home/user/Klive/KliveExports/recording_20260228_140500.txt");
    const next = emulatorStateReducer(armed, action);
    expect(next.screenRecordingState).toBe("recording");
    expect(next.screenRecordingFile).toBe("/home/user/Klive/KliveExports/recording_20260228_140500.txt");
    // fps preserved from previous state when not supplied
    expect(next.screenRecordingFps).toBe("native");
  });

  it("recording → paused: state changes, file and fps preserved", () => {
    const recording: EmulatorState = {
      ...baseState,
      screenRecordingState: "recording",
      screenRecordingFile: "/tmp/rec.txt",
      screenRecordingFps: "half"
    };
    const action = setScreenRecordingStateAction("paused");
    const next = emulatorStateReducer(recording, action);
    expect(next.screenRecordingState).toBe("paused");
    expect(next.screenRecordingFile).toBe("/tmp/rec.txt");
    expect(next.screenRecordingFps).toBe("half");
  });

  it("paused → recording: resumes", () => {
    const paused: EmulatorState = {
      ...baseState,
      screenRecordingState: "paused",
      screenRecordingFile: "/tmp/rec.txt",
      screenRecordingFps: "half"
    };
    const action = setScreenRecordingStateAction("recording");
    const next = emulatorStateReducer(paused, action);
    expect(next.screenRecordingState).toBe("recording");
  });

  it("recording → idle: clears file", () => {
    const recording: EmulatorState = {
      ...baseState,
      screenRecordingState: "recording",
      screenRecordingFile: "/tmp/rec.txt",
      screenRecordingFps: "native"
    };
    const action = setScreenRecordingStateAction("idle");
    const next = emulatorStateReducer(recording, action);
    expect(next.screenRecordingState).toBe("idle");
    // file stays in state (cleared by the backend logic, not the reducer)
  });

  it("half fps is preserved when not re-supplied", () => {
    const recording: EmulatorState = {
      ...baseState,
      screenRecordingState: "recording",
      screenRecordingFps: "half"
    };
    const action = setScreenRecordingStateAction("paused");
    const next = emulatorStateReducer(recording, action);
    expect(next.screenRecordingFps).toBe("half");
  });
});
