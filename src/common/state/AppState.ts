import type { KeyMapping } from "@abstractions/KeyMapping";
import type { ScriptRunInfo } from "@abstractions/ScriptRunInfo";
import type { LogpointGroupState, SourceCommentSwitches } from "@abstractions/BreakpointInfo";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import { ExportDialogSettings, IdeSettings } from "@main/settings";
import {
  KliveCompilerOutput,
  LanguageIntelData
} from "@abstractions/CompilerInfo";
import type { BasicIntelData } from "@abstractions/BasicIntel";
import { CompilationCompleted } from "@main/compiler-integration/runWorker";

/**
 * Represents a watch expression definition
 */
export type WatchInfo = {
  symbol: string;
  type: "a" | "b" | "w" | "l" | "-w" | "-l" | "f" | "s";
  length?: number;
  address?: number;
  partition?: number;
  direct?: boolean;
};

/**
 * Represents the state of the entire application
 */
export type AppState = {
  appPath?: string;
  emuLoaded?: boolean;
  ideLoaded?: boolean;
  startScreenDisplayed?: boolean;
  isWindows?: boolean;
  emuFocused?: boolean;
  ideFocused?: boolean;
  dimMenu?: boolean;
  theme?: string;

  /** Selected accent id (see theming/tokens/palette.ts). */
  accent?: string;
  globalSettings?: Record<string, any>;
  ideView?: IdeView;
  ideSettings?: IdeSettings;
  emulatorState?: EmulatorState;
  media?: MediaState;
  project?: IdeProject;
  compilation?: CompilationState;
  projectSettings?: Record<string, any>;
  keyMappingFile?: string;
  keyMappings?: { mapping: KeyMapping; merge: boolean };
  userSettings?: Record<string, any>;
  menuVersion?: number;
  scripts?: ScriptRunInfo[];
  workspaceSettings?: Record<string, any>;
  watchExpressions?: WatchInfo[];
  /** BASIC watch expressions of the Variables panel (plan §10.8), as the user typed them. */
  basicWatches?: string[];
  /**
   * Which logpoint groups log (`.plans/LOGPOINTS_PLAN.md` §4.2). In the shared store so the IDE
   * (commands, the Breakpoints panel), the emulator (`DebugSupport`) and the project save all read
   * one value; persisted with the project when it is not "everything on" (§4.6).
   */
  logpointGroups?: LogpointGroupState;
  /**
   * Which DeZog comment kinds a build turns into breakpoints
   * (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` S6): only a switch that is off is present.
   * Persisted with the project next to `logpointGroups`.
   */
  sourceComments?: SourceCommentSwitches;
};

export type IdeView = {
  activity?: string;
  sideBarPanels?: Record<string, SideBarPanelState>;
  documentHubState?: Record<number, number>;
  editorVersion?: number;
  explorerViewVersion?: number;
  volatileDocs: Record<string, boolean>;
  tools?: ToolInfo[];
  statusMessage?: string;
  statusSuccess?: boolean;
  toolCommandSeqNo: number;
  cursorLine?: number;
  cursorColumn?: number;
  navHistory?: NavigationHistoryState;
  /** The source-level call-stack frame selected in the Call Stack panel (0: innermost); the Variables panel shows its locals. */
  sourceFrame?: number;
  /**
   * The memory view's heat map (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D14): "off", "exec",
   * "read", "write" or "all". Shared by the toolbar's Heat selector and `memory-heat`.
   */
  memoryHeatMode?: string;
};

/**
 * What the UI needs to know about the navigation history (Go Back / Go Forward). The entries
 * themselves stay in the renderer's `NavigationHistoryService`; this is the part the toolbar and the
 * main-process menu read to enable their commands.
 */
export type NavigationHistoryState = {
  canGoBack: boolean;
  canGoForward: boolean;
  /** Number of entries. */
  count: number;
  /** Index of the current entry; -1 when empty. */
  index: number;
};

/**
 * The FPS mode for screen recording
 */
export type RecordingFps = "native" | "half";

/**
 * The quality preset for screen recording.
 * lossless = CRF 0, preset ultrafast (true lossless H.264)
 * medium   = CRF 10, preset fast     (visually transparent, smaller files)
 * high     = CRF 18, preset fast     (near-lossless, default)
 */
export type RecordingQuality = "lossless" | "high" | "good";

/**
 * The format for screen recording output.
 * mp4 = H.264 + AAC (universal, fast)
 * webm = VP9 + Opus (best compression, slow)
 * mkv = H.265 + AAC (high compression, slower)
 */
export type RecordingFormat = "mp4" | "webm" | "mkv";

/**
 * The lifecycle state of a screen recording session
 */
export type ScreenRecordingState = "idle" | "armed" | "recording" | "paused";

/**
 * An RZX session on the emulator (`.plans/RZX_PLAN.md` §4.6): playing a recording, recording one,
 * or rendering one to video
 */
/**
 * What the IDE shows of a reverse-debugging timeline (`.plans/REVERSE_DEBUGGING_PLAN.md` §4.4): the
 * status bar's "in the past" and "replaying" states, the reverse range, the deep-landing marker, a
 * Reverse Continue search's progress and why a timeline ended. Undefined while no timeline runs and
 * none ended with something to say.
 */
export type ReverseDebugState = {
  /** Whether a timeline is active; false after one ended (`desync` says why) */
  active: boolean;
  /** `live`: at the present; `navigating`: paused in the past; `replaying`: running toward the present */
  mode: "live" | "navigating" | "replaying";
  /** How far behind the present the machine stands, in seconds of machine time */
  behindSeconds?: number;
  /** How far back the timeline reaches from the present, in seconds (the reverse range) */
  rangeSeconds?: number;
  /** The machine stands older than the history views reach: there is no history cursor (D17) */
  deepLanding?: boolean;
  /** Live input dropped since the machine left the present (D12) */
  inputsIgnored?: number;
  /** A Reverse Continue search: keyframe intervals searched so far (D15) */
  searchedIntervals?: number;
  /** Why the last timeline ended early (a desync, D9) */
  desync?: string;
  /** The debug recording the timeline was opened from (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` D10) */
  recording?: string;
};

export type RzxState = {
  mode: "idle" | "playing" | "recording" | "rendering";
  /** Frames played or recorded */
  frame: number;
  /** All frames of the recording that plays */
  frames?: number;
  /** The file that plays */
  file?: string;
  /** Why the last session stopped (a desync, the end, an IDE operation) */
  stopMessage?: string;
  /** A recording stopped by an IDE operation or an overflow holds frames not yet saved */
  unsaved?: boolean;
};

/**
 * Where the IDE window goes relative to the emulator window in an IDE + Emulator recording
 */
export type RecordingIdePosition = "left" | "right" | "top" | "bottom";

/**
 * The lifecycle state of an IDE + Emulator recording
 */
export type WindowRecordingState = "idle" | "recording";

export type EmulatorState = {
  machineId?: string;
  modelId?: string;
  config?: Record<string, any>;
  machineSpecific?: Record<string, any>;
  machineState?: MachineControllerState;
  pcValue?: number;
  isDebugging?: boolean;
  isProjectDebugging?: boolean;
  soundLevel?: number;
  soundMuted?: boolean;
  savedSoundLevel?: number;
  clockMultiplier?: number;
  audioSampleRate?: number;
  breakpointsVersion: number;
  /** Bumped when breakpoint hit counters moved; see `incBreakpointHitsVersionAction`. */
  breakpointHitsVersion?: number;
  /**
   * The access profile's switch (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D6): coverage and the
   * heat map are recorded while `enabled`; `counters` keeps the counts as well as the flags
   */
  profiling?: { enabled: boolean; counters: boolean; calls?: boolean };
  /** Bumped when the access profile moved; see `incProfileVersionAction` */
  profileVersion?: number;
  emuViewVersion: number;
  /**
   * True while the host mouse is captured by the emulator screen (Pointer Lock).
   *
   * `useEmulatorMouse` owns the truth - it is the one watching `pointerlockchange` - and
   * mirrors it here so the toolbar button, the overlay and the main-process menu can all see
   * it. The browser can drop the lock on its own (Esc, focus loss), so nothing may treat this
   * as a flag it set and therefore controls.
   */
  mouseCaptured?: boolean;
  /**
   * The ZX Spectrum Next layer debug view (`.plans/LAYER_COMPOSITION_PLAN.md`): hidden and solo
   * layers, "show transparency", the clip outlines, the probe. Debugging state of this session only
   * (D2): never a setting, never saved, never in a machine state file.
   */
  nextLayers?: import("@common/zxnext/layers/layerMix").NextLayerViewState;
  screenRecordingAvailable?: boolean;
  /**
   * The advanced-debugging feature switch (G4 + G5; `@common/features/advancedDebugging`): read once
   * by the main process at startup from `features.advancedDebugging`. Off unless set.
   */
  advancedDebugging?: boolean;
  /** A quick-saved machine state is held for the current machine (D19 of the state-files plan) */
  quickStateAvailable?: boolean;
  /**
   * The history cursor (`.plans/LITE_STEP_BACK_PLAN.md` D3): steps back from the present (1 = the
   * newest record); undefined at the present. The IDE's effects keyed on the execution point re-run
   * when it moves.
   */
  historyPosition?: number;
  /** The record the history cursor is on */
  historySequence?: number;
  /**
   * Whether memory and devices show the history cursor's moment too (D14): false in lite mode,
   * where the "present" banners say so; G4.4's full reverse debugging makes it true
   */
  historyMemoryIsHistorical?: boolean;
  screenRecordingState?: ScreenRecordingState;
  /** The RZX session, if any (`.plans/RZX_PLAN.md` §4.6) */
  rzx?: RzxState;
  /** The reverse-debugging timeline, while the debug session has one (`.plans/REVERSE_DEBUGGING_PLAN.md` §4.4) */
  reverseDebug?: ReverseDebugState;
  screenRecordingFile?: string;
  screenRecordingFps?: RecordingFps;
  screenRecordingQuality?: RecordingQuality;
  screenRecordingFormat?: RecordingFormat;
  /** IDE + Emulator recording (see .plans/IDE_EMU_RECORDING_PLAN.md) */
  windowRecordingState?: WindowRecordingState;
  windowRecordingFile?: string;
  windowRecordingIdePosition?: RecordingIdePosition;
  windowRecordingPointer?: boolean;
  windowRecordingClicks?: boolean;
  windowRecordingHiDpi?: boolean;
};

export type FloppyDiskState = {
  diskFile?: string;
  writeProtected?: boolean;
};

export type IdeProject = {
  folderPath?: string | null;
  isKliveProject?: boolean;
  workspaceLoaded?: boolean;
  buildRoots?: string[];
  projectFileVersion?: number;
  projectViewStateVersion?: number;
  excludedItems?: string[];
  hasBuildFile?: boolean;
  buildFileVersion?: number;
  exportSettings?: ExportDialogSettings;
};

/**
 * The state of a particular site bar panel
 */
export type SideBarPanelState = {
  expanded: boolean;
  size: number;
};

/**
 * The current state of compilation
 */
export type CompilationState = {
  inProgress?: boolean;
  filename?: string;
  result?: KliveCompilerOutput;
  failed?: string;
  injectionVersion?: number;
  backgroundInProgress?: boolean;
  backgroundResult?: CompilationCompleted;
  /** Language intelligence data populated after each successful background compile. */
  languageIntel?: LanguageIntelData;
  /**
   * Klive BASIC intel, by the root file each snapshot was checked from: the build root's, and the
   * open file's when the build root does not include it (`.plans/BASIC_EDITOR_INTELLIGENCE_PLAN.md`
   * E3, E14). Each entry is the last good snapshot of its root.
   */
  basicIntel?: Record<string, BasicIntelData>;
};

/**
 * The current state of removable media
 */
export type MediaState = Record<string, any>;

/**
 * The initial application state
 */
export const initialAppState: AppState = {
  emuLoaded: false,
  ideLoaded: false,
  isWindows: false,
  theme: "dark",
  accent: "sinclairBlue",
  emuFocused: false,
  ideFocused: false,
  menuVersion: 0,
  globalSettings: {},
  ideView: {
    sideBarPanels: {},
    documentHubState: {},
    editorVersion: 1,
    explorerViewVersion: 1,
    volatileDocs: {},
    tools: [],
    toolCommandSeqNo: 0
  },
  ideSettings: {},
  emulatorState: {
    config: {},
    machineSpecific: {},
    soundLevel: 0.8,
    soundMuted: false,
    savedSoundLevel: 0.8,
    clockMultiplier: 1,
    breakpointsVersion: 0,
    emuViewVersion: 0
  },
  media: {},
  project: {
    projectFileVersion: 1,
    projectViewStateVersion: 1,
    buildFileVersion: 1
  },
  compilation: {
    inProgress: false,
    injectionVersion: 0
  },
  scripts: [],
  workspaceSettings: {},
  watchExpressions: [],
  basicWatches: [],
  logpointGroups: { enabled: true },
  sourceComments: {}
};
