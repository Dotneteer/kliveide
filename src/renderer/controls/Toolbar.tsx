import styles from "./Toolbar.module.scss";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useDispatch, useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";
import { IconButton } from "./IconButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { machineRegistry } from "@common/machines/machine-registry";
import { MF_TAPE_SUPPORT } from "@common/machines/constants";
import { PANE_ID_BUILD } from "@common/integration/constants";
import { DISASSEMBLY_PANEL_ID, MEMORY_PANEL_ID } from "@common/state/common-ids";
import { useMainApi } from "@renderer/core/MainApi";
import { useIdeApi } from "@renderer/core/IdeApi";
import { useEmuApi } from "@renderer/core/EmuApi";
import { HStack } from "./new/Panels";
import Dropdown from "./Dropdown";
import { useAdvancedDebounce } from "./hooks";

import {
  SETTING_EMU_FAST_LOAD,
  SETTING_EMU_SHOW_INSTANT_SCREEN,
  SETTING_EMU_SHOW_KEYBOARD,
  SETTING_EMU_STAY_ON_TOP,
  SETTING_IDE_SYNC_BREAKPOINTS
} from "@common/settings/setting-const";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { muteSoundAction } from "@state/actions";

/**
 * Create a memoized version of IconButton for better performance
 * This prevents unnecessary re-renders when other parts of the Toolbar state change
 */
const MemoizedIconButton = memo(IconButton);

/**
 * Defines the type for start options used in the toolbar dropdown
 */
type StartOption = {
  value: string;
  label: string;
  labelCont: string;
  iconName: string;
  cmd: string | null;
};

/**
 * Props for the main Toolbar component
 */
interface Props {
  /** Whether the toolbar is in IDE mode */
  ide: boolean;
  /** Whether a Klive project is currently loaded */
  kliveProjectLoaded: boolean;
};

/**
 * Available start options for emulator mode
 */
const emuStartOptions: StartOption[] = [
  {
    value: "debug",
    label: "Debug Machine (Ctrl+F5)",
    labelCont: "Continue Debugging (Ctrl+F5)",
    iconName: "debug",
    cmd: null
  },
  {
    value: "start",
    label: "Run Machine (F5)",
    labelCont: "Continue (F5)",
    iconName: "play",
    cmd: null
  }
];

/**
 * Available start options for IDE mode
 */
const ideStartOptions: StartOption[] = [
  {
    value: "debug",
    label: "Debug Project (Ctrl+F5)",
    labelCont: "Continue Debugging (Ctrl+F5)",
    iconName: "debug",
    cmd: "debug"
  },
  {
    value: "start",
    label: "Run Project (F5)",
    labelCont: "Continue (F5)",
    iconName: "play",
    cmd: "run"
  }
];

// Create separate components for IDE and non-IDE sections
/**
 * Props for the IDE-specific toolbar section
 */
interface IdeToolbarSectionProps {
  /** Whether source breakpoints are synchronized */
  syncSourceBps: boolean;
  /** Record of which volatile documents (panels) are currently visible */
  volatileDocs: Record<string, boolean>;
  /** Service for executing IDE commands */
  ideCommandsService: {
    executeCommand: (command: string, ...args: any[]) => Promise<any>;
  };
  /** API for interacting with the main process */
  mainApi: {
    setGlobalSettingsValue: (key: string, value: any) => Promise<void>;
  };
};

const IdeToolbarSection = memo(({
  syncSourceBps,
  volatileDocs,
  ideCommandsService,
  mainApi
}: IdeToolbarSectionProps) => {
  const toggleSyncBreakpoints = useCallback(async () => {
    await mainApi.setGlobalSettingsValue(SETTING_IDE_SYNC_BREAKPOINTS, !syncSourceBps);
  }, [mainApi, syncSourceBps]);

  const toggleMemoryPanel = useCallback(async () => {
    if (volatileDocs?.[MEMORY_PANEL_ID]) {
      await ideCommandsService.executeCommand("hide-memory");
    } else {
      await ideCommandsService.executeCommand("show-memory");
    }
  }, [volatileDocs, ideCommandsService]);

  const toggleDisassemblyPanel = useCallback(async () => {
    if (volatileDocs?.[DISASSEMBLY_PANEL_ID]) {
      await ideCommandsService.executeCommand("hide-disass");
    } else {
      await ideCommandsService.executeCommand("show-disass");
    }
  }, [volatileDocs, ideCommandsService]);

  return (
    <>
      <ToolbarSeparator />
      <MemoizedIconButton
        iconName="sync-ignored"
        selected={syncSourceBps}
        fill="--color-toolbarbutton-orange"
        title="Sync the source with the current breakpoint"
        clicked={toggleSyncBreakpoints}
      />
      <ToolbarSeparator />
      <MemoizedIconButton
        iconName="memory-icon"
        fill="--color-toolbarbutton-orange"
        title="Show Memory Panel"
        selected={volatileDocs?.[MEMORY_PANEL_ID]}
        clicked={toggleMemoryPanel}
      />
      <MemoizedIconButton
        iconName="disassembly-icon"
        fill="--color-toolbarbutton-orange"
        title="Show Z80 Disassembly Panel"
        selected={volatileDocs?.[DISASSEMBLY_PANEL_ID]}
        clicked={toggleDisassemblyPanel}
      />
    </>
  );
});

/**
 * Props for the non-IDE toolbar section (emulator-specific controls)
 */
interface NonIdeToolbarSectionProps {
  /** Whether sound is currently muted */
  muted: boolean;
  /** Current tape file information */
  tapeFile: {
    readonly id?: string;
    readonly name?: string;
    readonly contents?: Uint8Array;
  } | null;
  /** Whether the current machine supports tape operations */
  tapeSupport: boolean;
  /** Handler for muting sound */
  handleMuteSound: () => Promise<void> | void;
  /** Handler for unmuting sound */
  handleUnmuteSound: () => Promise<void> | void;
};

const NonIdeToolbarSection = memo(({ 
  muted,
  tapeFile,
  tapeSupport,
  handleMuteSound,
  handleUnmuteSound
}: NonIdeToolbarSectionProps) => {
  // Use the emulator settings hooks
  const {
    showKeyboard,
    showInstantScreen,
    stayOnTop,
    fastLoad,
    toggleStayOnTop,
    toggleInstantScreen,
    toggleKeyboard,
    toggleFastLoad,
    rewindTape: handleRewindTape
  } = useEmulatorSettings();

  return (
    <>
      <ToolbarSeparator />
      <MemoizedIconButton
        iconName={stayOnTop ? "pinned" : "pin"}
        fill="--color-toolbarbutton"
        selected={stayOnTop}
        title={"Stay on top"}
        clicked={toggleStayOnTop}
      />
      <ToolbarSeparator />
      <MemoizedIconButton
        iconName="vm"
        fill="--color-toolbarbutton"
        selected={showInstantScreen}
        title="Turn on/off instant screen"
        clicked={toggleInstantScreen}
      />
      <ToolbarSeparator />
      <MemoizedIconButton
        iconName="keyboard"
        fill="--color-toolbarbutton"
        selected={showKeyboard}
        title="Show/Hide keyboard"
        clicked={toggleKeyboard}
      />
      <ToolbarSeparator />
      {!muted && (
        <MemoizedIconButton
          iconName="mute"
          fill="--color-toolbarbutton"
          title="Mute sound"
          clicked={handleMuteSound}
        />
      )}
      {muted && (
        <MemoizedIconButton
          iconName="unmute"
          fill="--color-toolbarbutton"
          title="Unmute sound"
          clicked={handleUnmuteSound}
        />
      )}
      {tapeSupport && <ToolbarSeparator />}
      {tapeSupport && (
        <MemoizedIconButton
          iconName="rocket"
          fill="--color-toolbarbutton"
          title="Fast LOAD mode"
          selected={fastLoad}
          clicked={toggleFastLoad}
        />
      )}
      {tapeSupport && (
        <MemoizedIconButton
          iconName="reverse-tape"
          fill="--color-toolbarbutton"
          title="Rewind the tape"
          enable={!!tapeFile}
          clicked={handleRewindTape}
        />
      )}
    </>
  );
});

/**
 * This file has been optimized with the following improvements:
 * 1. Created custom hooks for button availability logic (useButtonAvailability)
 * 2. Created custom hooks for emulator settings (useEmulatorSettings)
 * 3. Replaced inline styles with CSS classes
 * 4. Optimized conditional rendering with better component structure
 * 5. Added debouncing for frequently called handlers
 * 6. Enhanced error handling for async operations
 * 7. Used functional state updates for batching
 */

/**
 * Type definition for button availability status
 * Used to determine whether buttons should be enabled and what tooltips to show
 */
export interface ButtonAvailability {
  /** Whether the button should be enabled/clickable */
  enabled: boolean;
  /** Tooltip text to display when hovering over the button */
  title: string;
}

/**
 * Return type for the useButtonAvailability hook
 */
interface ButtonAvailabilityState {
  /** Whether the emulator is in stopped state */
  isStopped: boolean;
  /** Whether the emulator is currently running */
  isRunning: boolean;
  /** Whether the emulator is in paused state */
  isPaused: boolean;
  /** Availability state for the pause/continue button */
  pauseButton: ButtonAvailability;
  /** Availability state for the stop button */
  stopButton: ButtonAvailability;
  /** Availability state for the restart button */
  restartButton: ButtonAvailability;
  /** Availability state for step buttons (step into, over, out) */
  stepButtons: ButtonAvailability;
}





/**
 * Hook for common button enabling logic
 */
/**
 * Custom hook for determining button availability based on machine state
 * 
 * @param state Current machine controller state
 * @param isCompiling Whether compilation is in progress
 * @param currentStartOption Currently selected start option
 * @returns Object containing availability state for different buttons
 */
const useButtonAvailability = (
  state: MachineControllerState | undefined,
  isCompiling: boolean,
  currentStartOption: StartOption | undefined
): ButtonAvailabilityState => {
  // Logic for determining button availability states
  return useMemo(() => {
    const isStopped =
      state === MachineControllerState.None || state === MachineControllerState.Stopped;
    
    const isRunning =
      state !== MachineControllerState.None &&
      state !== MachineControllerState.Stopped &&
      state !== MachineControllerState.Paused;
    
    const isPaused = state === MachineControllerState.Paused || state === MachineControllerState.Pausing;
    
    // Availability states for different buttons
    const pauseButton = {
      enabled: !isCompiling && (isRunning || isPaused),
      title: state === MachineControllerState.Running 
        ? "Pause (Shift+F5)" 
        : currentStartOption?.labelCont || "Continue"
    };
    
    const stopButton = {
      enabled: !isCompiling && (isRunning || isPaused),
      title: "Stop (F4)"
    };
    
    const restartButton = {
      enabled: !isCompiling && (isRunning || isPaused),
      title: "Restart (Shift+F4)"
    };
    
    const stepButtons = {
      enabled: !isCompiling && isPaused,
      title: ""
    };
    
    return {
      isStopped,
      isRunning,
      isPaused,
      pauseButton,
      stopButton,
      restartButton,
      stepButtons
    };
  }, [state, isCompiling, currentStartOption]);
};

/**
 * Interface for the return value of useEmulatorSettings hook
 */
interface EmulatorSettings {
  /** Whether the keyboard is currently visible */
  showKeyboard: boolean;
  /** Whether instant screen rendering is enabled */
  showInstantScreen: boolean;
  /** Whether the emulator window stays on top */
  stayOnTop: boolean;
  /** Whether fast load mode is enabled for tapes */
  fastLoad: boolean;
  
  /** Toggle the stay-on-top setting */
  toggleStayOnTop: () => Promise<void> | void;
  /** Toggle the instant screen setting */
  toggleInstantScreen: () => Promise<void> | void;
  /** Toggle the keyboard visibility setting */
  toggleKeyboard: () => Promise<void> | void;
  /** Toggle the fast load setting */
  toggleFastLoad: () => Promise<void> | void;
  /** Toggle the sound mute state */
  toggleSound: (muted: boolean, saveProject: () => Promise<void>) => Promise<void>;
  /** Rewind the current tape */
  rewindTape: () => Promise<void> | void;
}

/**
 * Hook for emulator settings with optimized event handlers
 * Provides access to common emulator settings and debounced toggle functions
 * 
 * @returns Object containing current settings and toggle handlers
 */
const useEmulatorSettings = (): EmulatorSettings => {
  const dispatch = useDispatch();
  const mainApi = useMainApi();
  const emuApi = useEmuApi();
  
  // Get global settings
  const showKeyboard = useGlobalSetting(SETTING_EMU_SHOW_KEYBOARD);
  const showInstantScreen = useGlobalSetting(SETTING_EMU_SHOW_INSTANT_SCREEN);
  const stayOnTop = useGlobalSetting(SETTING_EMU_STAY_ON_TOP);
  const fastLoad = useGlobalSetting(SETTING_EMU_FAST_LOAD);
  
  // Define the base handlers with error handling
  const setSettingWithErrorHandling = useCallback(
    async (setting: string, value: boolean) => {
      try {
        await mainApi.setGlobalSettingsValue(setting, value);
      } catch (error) {
        console.error(`Failed to update setting ${setting}:`, error);
        // Could also show a toast/notification to the user here
      }
    }, 
    [mainApi]
  );
  
  // Create debounced toggle handlers (300ms)
  const toggleStayOnTop = useAdvancedDebounce(
    useCallback(async () => {
      await setSettingWithErrorHandling(SETTING_EMU_STAY_ON_TOP, !stayOnTop);
    }, [setSettingWithErrorHandling, stayOnTop]),
    300
  );

  const toggleInstantScreen = useAdvancedDebounce(
    useCallback(async () => {
      await setSettingWithErrorHandling(SETTING_EMU_SHOW_INSTANT_SCREEN, !showInstantScreen);
    }, [setSettingWithErrorHandling, showInstantScreen]), 
    300
  );

  const toggleKeyboard = useAdvancedDebounce(
    useCallback(async () => {
      await setSettingWithErrorHandling(SETTING_EMU_SHOW_KEYBOARD, !showKeyboard);
    }, [setSettingWithErrorHandling, showKeyboard]),
    300
  );

  const toggleFastLoad = useAdvancedDebounce(
    useCallback(async () => {
      await setSettingWithErrorHandling(SETTING_EMU_FAST_LOAD, !fastLoad);
    }, [setSettingWithErrorHandling, fastLoad]),
    300
  );

  // Sound controls with error handling
  const toggleSound = useCallback(async (muted: boolean, saveProject: () => Promise<void>) => {
    try {
      dispatch(muteSoundAction(muted));
      await saveProject();
    } catch (error) {
      console.error(`Failed to ${muted ? 'mute' : 'unmute'} sound:`, error);
    }
  }, [dispatch]);

  // Tape controls with error handling
  const rewindTape = useAdvancedDebounce(
    useCallback(async () => {
      try {
        await mainApi.reloadTapeFile();
        await emuApi.issueMachineCommand("rewind");
      } catch (error) {
        console.error("Failed to rewind tape:", error);
      }
    }, [mainApi, emuApi]),
    500
  );

  return {
    // Settings
    showKeyboard,
    showInstantScreen,
    stayOnTop,
    fastLoad,
    
    // Toggle handlers
    toggleStayOnTop,
    toggleInstantScreen,
    toggleKeyboard,
    toggleFastLoad,
    toggleSound,
    rewindTape
  };
};

/**
 * Main Toolbar Component
 * 
 * This component provides the primary toolbar interface for the Klive IDE and emulator.
 * It displays different controls based on the current mode (IDE vs emulator) and machine state.
 *
 * Key features:
 * - Run/debug controls for machines and projects
 * - Stepping controls for debugging (step into, over, out)
 * - Emulator-specific controls (sound, keyboard, stay-on-top, etc.)
 * - IDE-specific controls (memory/disassembly panels, breakpoint sync)
 *
 * The component is optimized for performance with:
 * - Memoized child components to prevent unnecessary re-renders
 * - Custom hooks for centralized logic
 * - Debounced event handlers for rapid interactions
 * - Proper error handling for async operations
 * 
 * @param props Component props
 * @returns Toolbar React component
 */
export const Toolbar = ({ ide, kliveProjectLoaded }: Props) => {
  const emuApi = useEmuApi();
  const ideApi = useIdeApi();
  const mainApi = useMainApi();
  const machineId = useSelector((s) => s.emulatorState.machineId);
  const isWindows = useSelector((s) => s.isWindows);
  const machineInfo = machineRegistry.find((mi) => mi.machineId === machineId);
  const state = useSelector((s) => s.emulatorState?.machineState);
  const volatileDocs = useSelector((s) => s.ideView.volatileDocs);
  const syncSourceBps = useGlobalSetting(SETTING_IDE_SYNC_BREAKPOINTS);
  const muted = useSelector((s) => s.emulatorState?.soundMuted ?? false);
  const tapeFile = useSelector((s) => s.media?.[MEDIA_TAPE]);
  const isDebugging = useSelector((s) => s.emulatorState?.isDebugging ?? false);
  const isCompiling = useSelector((s) => s.compilation?.inProgress ?? false);

  // Memoize derived state values to avoid recalculation on every render
  const {
    canStart,
    canPickStartOption,
    mayInjectCode,
    tapeSupport
  } = useMemo(() => {
    const isStopped =
      state === MachineControllerState.None || state === MachineControllerState.Stopped;
    const isRunning =
      state !== MachineControllerState.None &&
      state !== MachineControllerState.Stopped &&
      state !== MachineControllerState.Paused;
    const canStart = (!ide || kliveProjectLoaded) && !isCompiling && isStopped;
    const canPickStartOption = (!ide || kliveProjectLoaded) && !isRunning;
    const mayInjectCode = ide && kliveProjectLoaded;
    const tapeSupport = machineInfo?.features?.[MF_TAPE_SUPPORT] ?? false;

    return { isStopped, isRunning, canStart, canPickStartOption, mayInjectCode, tapeSupport };
  }, [state, ide, kliveProjectLoaded, isCompiling, machineInfo]);

  const mode = "start";
  const startOptions = ide ? ideStartOptions : emuStartOptions;
  // Consolidate state - only store the mode and derive the currentStartOption
  const [startMode, setStartMode] = useState(mode);
  
  // Derive the current option from the mode
  const currentStartOption = useMemo(() => 
    startOptions.find((v) => v.value === startMode),
  [startMode, startOptions]);

  // --- Use shortcut according to the current platform
  const [shortcuts, setShortcuts] = useState({
    stepInto: null,
    stepOver: null,
    stepOut: null
  });

  const { outputPaneService, ideCommandsService } = useAppServices();

  useEffect(() => {
    const mode = isDebugging ? "debug" : "start";
    setStartMode(mode);
  }, [isDebugging]);

  useEffect(() => {
    if (!mainApi) return () => {}; // Return empty cleanup function
    
    let isMounted = true;
    
    (async () => {
      try {
        const settings = await mainApi.getUserSettings();
        if (isMounted) {
          setShortcuts({
            stepInto: settings?.shortcuts?.stepInto ?? (isWindows ? "F11" : "F12"),
            stepOver: settings?.shortcuts?.stepOver ?? "F10",
            stepOut: settings?.shortcuts?.stepOut ?? (isWindows ? "Shift+F11" : "Shift+F12")
          });
        }
      } catch (error) {
        console.error("Failed to load user settings:", error);
      }
    })();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [mainApi, isWindows]);

  // Error handler for UI operations
  const handleOperationError = useCallback((error: Error, operation: string) => {
    console.error(`Error during ${operation}:`, error);
    // Could add UI feedback like a toast notification here
  }, []);

  // Memoize event handlers with error handling and debouncing
  const handleStartClick = useCallback(async () => {
    try {
      if (mayInjectCode && !!currentStartOption.cmd) {
        const buildPane = outputPaneService.getOutputPaneBuffer(PANE_ID_BUILD);
        buildPane.clear();
        await ideCommandsService.executeCommand(currentStartOption.cmd, buildPane);
        await ideCommandsService.executeCommand("outp build");
      } else {
        await emuApi.issueMachineCommand(currentStartOption.value as any);
      }
    } catch (error) {
      handleOperationError(error as Error, "start operation");
    }
  }, [mayInjectCode, currentStartOption, outputPaneService, ideCommandsService, emuApi, handleOperationError]);

  // Use functional updates for state changes
  const handleDropdownChange = useCallback((option) => {
    setStartMode(prevMode => option || prevMode);
  }, []);

  // Use the custom hooks for button availability logic
  const { 
    pauseButton, 
    stopButton, 
    restartButton, 
    stepButtons
  } = useButtonAvailability(state, isCompiling, currentStartOption);

  // Get emulator settings
  const { toggleSound } = useEmulatorSettings();
  
  // Save project callback with error handling
  const saveProject = useCallback(async () => {
    try {
      await mainApi.saveProject();
    } catch (error) {
      handleOperationError(error as Error, "saving project");
    }
  }, [mainApi, handleOperationError]);
  
  // Debounced sound handlers (300ms)
  const handleMuteSound = useAdvancedDebounce(
    useCallback(async () => {
      await toggleSound(true, saveProject);
    }, [toggleSound, saveProject]),
    300
  );

  const handleUnmuteSound = useAdvancedDebounce(
    useCallback(async () => {
      await toggleSound(false, saveProject);
    }, [toggleSound, saveProject]),
    300
  );
  
  // Memoize and add error handling to all machine command handlers
  const executeMachineCommand = useCallback(async (command: string) => {
    try {
      await emuApi.issueMachineCommand(command as any);
    } catch (error) {
      handleOperationError(error as Error, `executing command: ${command}`);
    }
  }, [emuApi, handleOperationError]);

  // Debounced and error-handled button handlers
  const handlePauseClick = useAdvancedDebounce(
    useCallback(async () => {
      const cmd = state !== MachineControllerState.Running ? currentStartOption.value : "pause";
      await executeMachineCommand(cmd);
    }, [state, currentStartOption, executeMachineCommand]),
    200
  );

  const handleStopClick = useAdvancedDebounce(
    useCallback(async () => {
      await executeMachineCommand("stop");
    }, [executeMachineCommand]),
    200
  );

  const handleRestartClick = useAdvancedDebounce(
    useCallback(async () => {
      try {
        if (ide && kliveProjectLoaded) {
          ideApi.executeCommand("outp build");
          ideApi.executeCommand(isDebugging ? "debug" : "run");
        } else {
          await executeMachineCommand("restart");
        }
      } catch (error) {
        handleOperationError(error as Error, "restart operation");
      }
    }, [ide, kliveProjectLoaded, ideApi, isDebugging, executeMachineCommand, handleOperationError]),
    300
  );

  // Step commands don't need debouncing as much since they're used more deliberately
  const handleStepIntoClick = useCallback(async () => {
    await executeMachineCommand("stepInto");
  }, [executeMachineCommand]);

  const handleStepOverClick = useCallback(async () => {
    await executeMachineCommand("stepOver");
  }, [executeMachineCommand]);

  const handleStepOutClick = useCallback(async () => {
    await executeMachineCommand("stepOut");
  }, [executeMachineCommand]);

  return (
    <HStack
      height="38px"
      backgroundColor="--bgcolor-toolbar"
      paddingHorizontal="--space-1_5"
      paddingVertical="--space-1"
      verticalContentAlignment="center"
    >
      <MemoizedIconButton
        iconName={currentStartOption.iconName}
        fill="--color-toolbarbutton-green"
        title={currentStartOption.label}
        enable={canStart}
        clicked={handleStartClick}
      />
      <div
        className={`${styles.toolbarDropdownContainer} ${!canPickStartOption ? styles.toolbarDropdownDisabled : ''}`}
      >
        <Dropdown
          placeholder={undefined}
          options={startOptions}
          initialValue={startMode}
          width={184}
          onChanged={handleDropdownChange}
        />
      </div>
      <MemoizedIconButton
        iconName={state === MachineControllerState.Paused ? "debug-continue" : "pause"}
        fill="--color-toolbarbutton-blue"
        title={pauseButton.title}
        enable={pauseButton.enabled}
        clicked={handlePauseClick}
      />
      <MemoizedIconButton
        iconName="stop"
        fill="--color-toolbarbutton-red"
        title={stopButton.title}
        enable={stopButton.enabled}
        clicked={handleStopClick}
      />
      <MemoizedIconButton
        iconName="restart"
        fill="--color-toolbarbutton-green"
        title={restartButton.title}
        enable={restartButton.enabled}
        clicked={handleRestartClick}
      />
      <ToolbarSeparator />
      <MemoizedIconButton
        iconName="step-into"
        fill="--color-toolbarbutton-blue"
        title={`Step Into (${shortcuts.stepInto})`}
        enable={stepButtons.enabled}
        clicked={handleStepIntoClick}
      />
      <MemoizedIconButton
        iconName="step-over"
        fill="--color-toolbarbutton-blue"
        title={`Step Over (${shortcuts.stepOver})`}
        enable={stepButtons.enabled}
        clicked={handleStepOverClick}
      />
      <MemoizedIconButton
        iconName="step-out"
        fill="--color-toolbarbutton-blue"
        title={`Step Out (${shortcuts.stepOut})`}
        enable={stepButtons.enabled}
        clicked={handleStepOutClick}
      />
      {!ide && (
        <NonIdeToolbarSection
          muted={muted}
          tapeFile={tapeFile}
          tapeSupport={tapeSupport}
          handleMuteSound={handleMuteSound}
          handleUnmuteSound={handleUnmuteSound}
        />
      )}
      {ide && (
        <IdeToolbarSection
          syncSourceBps={syncSourceBps}
          volatileDocs={volatileDocs}
          ideCommandsService={ideCommandsService}
          mainApi={mainApi}
        />
      )}
    </HStack>
  );
};
