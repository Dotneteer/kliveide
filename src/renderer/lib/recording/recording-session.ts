import type { EmuRecordingCommand } from "../../../common/messaging/EmuApi";
import { MachineControllerState } from "../../../common/abstractions/MachineControllerState";
import type { RecordingFormat, RecordingQuality } from "../../../common/state/AppState";
import {
  setScreenRecordingFormatAction,
  setScreenRecordingQualityAction,
  setScreenRecordingStateAction
} from "../../../common/state/actions";
import { dispatchSharedAction, getSharedState } from "../../shared-store";
import type { RecordingManager } from "./RecordingManager";

let activeRecordingManager: RecordingManager | null = null;

export function setActiveRecordingManager(manager: RecordingManager | null): void {
  activeRecordingManager = manager;
}

export function getActiveRecordingManager(): RecordingManager | null {
  return activeRecordingManager;
}

export async function issueRecordingCommandToActiveManager(
  command: EmuRecordingCommand
): Promise<void> {
  const manager = activeRecordingManager;
  if (manager) {
    await issueRecordingCommandToManager(manager, command);
    return;
  }

  issueRecordingCommandFallback(command);
}

async function issueRecordingCommandToManager(
  manager: RecordingManager,
  command: EmuRecordingCommand
): Promise<void> {
  switch (command) {
    case "set-fps-native":
      manager.setFpsPreference("native");
      return;
    case "set-fps-half":
      manager.setFpsPreference("half");
      return;
    case "set-quality-lossless":
      manager.setQualityPreference("lossless");
      return;
    case "set-quality-high":
      manager.setQualityPreference("high");
      return;
    case "set-quality-good":
      manager.setQualityPreference("good");
      return;
    case "set-format-mp4":
      manager.setFormatPreference("mp4");
      return;
    case "set-format-webm":
      manager.setFormatPreference("webm");
      return;
    case "set-format-mkv":
      manager.setFormatPreference("mkv");
      return;
    case "start-recording": {
      const machineState = getSharedState().emulatorState?.machineState;
      manager.arm(undefined, machineState === MachineControllerState.Running);
      return;
    }
    case "disarm":
      await manager.disarm();
      return;
    case "pause-recording":
      manager.pauseRecording();
      return;
    case "resume-recording":
      manager.resumeRecording();
      return;
  }
}

function issueRecordingCommandFallback(command: EmuRecordingCommand): void {
  switch (command) {
    case "set-fps-native":
      dispatchSharedAction(setScreenRecordingStateAction(currentState(), undefined, "native"));
      return;
    case "set-fps-half":
      dispatchSharedAction(setScreenRecordingStateAction(currentState(), undefined, "half"));
      return;
    case "set-quality-lossless":
    case "set-quality-high":
    case "set-quality-good":
      dispatchSharedAction(setScreenRecordingQualityAction(commandToQuality(command)));
      return;
    case "set-format-mp4":
    case "set-format-webm":
    case "set-format-mkv":
      dispatchSharedAction(setScreenRecordingFormatAction(commandToFormat(command)));
      return;
    case "start-recording":
      dispatchSharedAction(setScreenRecordingStateAction("armed"));
      return;
    case "disarm":
      dispatchSharedAction(setScreenRecordingStateAction("idle"));
      return;
    case "pause-recording":
      dispatchSharedAction(setScreenRecordingStateAction("paused"));
      return;
    case "resume-recording":
      dispatchSharedAction(setScreenRecordingStateAction("recording"));
      return;
  }
}

function currentState() {
  return getSharedState().emulatorState?.screenRecordingState ?? "idle";
}

function commandToQuality(command: EmuRecordingCommand): RecordingQuality {
  return command === "set-quality-lossless" ? "lossless" : command === "set-quality-high" ? "high" : "good";
}

function commandToFormat(command: EmuRecordingCommand): RecordingFormat {
  return command === "set-format-webm" ? "webm" : command === "set-format-mkv" ? "mkv" : "mp4";
}
