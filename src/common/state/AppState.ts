import type { MachineCommand } from "../abstractions/MachineCommand";
import type { KeyMappingSet } from "../abstractions/KeyMapping";
import { MachineControllerState } from "../abstractions/MachineControllerState";
import { MI_SPECTRUM_48 } from "../machines/constants";
import type { MachineConfigSet } from "../machines/info-types";

/**
 * Represents the state of the entire application
 */
export type AppState = {
  appPath?: string;
  emuLoaded?: boolean;
  emuStateSynched?: boolean;
  ideLoaded?: boolean;
  ideStateSynched?: boolean;
  startScreenDisplayed?: boolean;
  isWindows?: boolean;
  emuFocused?: boolean;
  ideFocused?: boolean;
  dimMenu?: boolean;
  theme?: string;
  activeActivity?: string;
  globalSettings?: Record<string, any>;
  emulatorState?: EmulatorState;
  media?: MediaState;
  keyMappingFile?: string;
  keyMappings?: KeyMappingSet;
};

export type TapeMediaState = {
  fileName?: string;
  displayName?: string;
  size?: number;
  blockCount?: number;
  currentBlockIndex?: number;
  status?: "ready" | "rewound" | "loading" | "saving" | "paused" | "eof";
  mode?: "passive" | "load" | "save";
  phase?: "none" | "pilot" | "sync" | "data" | "termSync" | "pause" | "completed";
  savePhase?: "none" | "pilot" | "sync1" | "sync2" | "data" | "error";
  savePilotPulseCount?: number;
  savedBlockCount?: number;
  savedDataLength?: number;
  sourceFormat?: "tap" | "tzx";
  warnings?: string[];
  error?: string;
};

export type MediaState = {
  tape?: TapeMediaState;
};

export type RecordingFps = "native" | "half";
export type RecordingQuality = "lossless" | "high" | "good";
export type RecordingFormat = "mp4" | "webm" | "mkv";
export type ScreenRecordingState = "idle" | "armed" | "recording" | "paused";

export type EmulatorState = {
  machineId?: string;
  modelId?: string;
  config?: MachineConfigSet;
  machineState?: MachineControllerState;
  pcValue?: number;
  isDebugging?: boolean;
  soundLevel?: number;
  soundMuted?: boolean;
  savedSoundLevel?: number;
  clockMultiplier?: number;
  screenRecordingAvailable?: boolean;
  screenRecordingState?: ScreenRecordingState;
  screenRecordingFile?: string;
  screenRecordingFps?: RecordingFps;
  screenRecordingQuality?: RecordingQuality;
  screenRecordingFormat?: RecordingFormat;
  lastMachineCommand?: MachineCommand;
  machineCommandSequence: number;
  sp48FrameInfo?: {
    frames: number;
    tacts: number;
    audioSampleCount: number;
    lastFrameTimeInMs: number;
    avgFrameTimeInMs: number;
    pc: number;
    baseClockFrequency: number;
    clockMultiplier: number;
  };
};

/**
 * The initial application state
 */
export const initialAppState: AppState = {
  emuLoaded: false,
  emuStateSynched: false,
  ideLoaded: false,
  ideStateSynched: false,
  isWindows: false,
  theme: "dark",
  activeActivity: "explorer",
  emuFocused: false,
  ideFocused: false,
  dimMenu: false,
  globalSettings: {},
  media: {},
  emulatorState: {
    machineId: MI_SPECTRUM_48,
    modelId: "pal",
    config: {},
    machineState: MachineControllerState.None,
    soundLevel: 0.8,
    soundMuted: false,
    savedSoundLevel: 0.8,
    clockMultiplier: 1,
    screenRecordingAvailable: true,
    screenRecordingState: "idle",
    screenRecordingFps: "native",
    screenRecordingQuality: "good",
    screenRecordingFormat: "mp4",
    machineCommandSequence: 0
  }
};
