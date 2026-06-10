import type { MachineCommand } from "../abstractions/MachineCommand";
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
  globalSettings?: Record<string, any>;
  emulatorState?: EmulatorState;
  media?: MediaState;
};

export type TapeMediaState = {
  fileName?: string;
  displayName?: string;
  size?: number;
  blockCount?: number;
  error?: string;
};

export type MediaState = {
  tape?: TapeMediaState;
};

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
    machineCommandSequence: 0
  }
};
