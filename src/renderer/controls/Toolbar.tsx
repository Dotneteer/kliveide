import styles from "./Toolbar.module.scss";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useDispatch, useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";
import { muteSoundAction } from "@state/actions";
import { IconButton } from "./IconButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import { MutableRefObject, useEffect, useState } from "react";
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
import type { RecordingManager } from "@renderer/appEmu/recording/RecordingManager";
import {
  SETTING_EMU_FAST_LOAD,
  SETTING_EMU_SHOW_INSTANT_SCREEN,
  SETTING_EMU_SHOW_KEYBOARD,
  SETTING_EMU_STAY_ON_TOP,
  SETTING_IDE_SYNC_BREAKPOINTS
} from "@common/settings/setting-const";
import { MEDIA_TAPE } from "@common/structs/project-const";

type Props = {
  ide: boolean;
  kliveProjectLoaded: boolean;
  recordingManagerRef?: MutableRefObject<RecordingManager | null>;
};

const emuStartOptions = [
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

const ideStartOptions = [
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

export const Toolbar = ({ ide, kliveProjectLoaded, recordingManagerRef }: Props) => {
  const dispatch = useDispatch();
  const emuApi = useEmuApi();
  const ideApi = useIdeApi();
  const mainApi = useMainApi();
  const machineId = useSelector((s) => s.emulatorState.machineId);
  const isWindows = useSelector((s) => s.isWindows);
  const machineInfo = machineRegistry.find((mi) => mi.machineId === machineId);
  const state = useSelector((s) => s.emulatorState?.machineState);
  const volatileDocs = useSelector((s) => s.ideView.volatileDocs);
  const showKeyboard = useGlobalSetting(SETTING_EMU_SHOW_KEYBOARD);
  const showInstantScreen = useGlobalSetting(SETTING_EMU_SHOW_INSTANT_SCREEN);
  const stayOnTop = useGlobalSetting(SETTING_EMU_STAY_ON_TOP);
  const recState = useSelector((s) => s.emulatorState?.screenRecordingState);
  const syncSourceBps = useGlobalSetting(SETTING_IDE_SYNC_BREAKPOINTS);
  const muted = useSelector((s) => s.emulatorState?.soundMuted ?? false);
  const fastLoad = useGlobalSetting(SETTING_EMU_FAST_LOAD);
  const tapeFile = useSelector((s) => s.media?.[MEDIA_TAPE]);
  const isDebugging = useSelector((s) => s.emulatorState?.isDebugging ?? false);
  const isCompiling = useSelector((s) => s.compilation?.inProgress ?? false);
  const isStopped =
    state === MachineControllerState.None || state === MachineControllerState.Stopped;
  const isRunning =
    state !== MachineControllerState.None &&
    state !== MachineControllerState.Stopped &&
    state !== MachineControllerState.Paused;
  const canStart = (!ide || kliveProjectLoaded) && !isCompiling && isStopped;
  const canPickStartOption = (!ide || kliveProjectLoaded) && !isRunning;
  const mayInjectCode = ide && kliveProjectLoaded;

  const mode = "start";
  const startOptions = ide ? ideStartOptions : emuStartOptions;
  const [startMode, setStartMode] = useState(mode);
  const [currentStartOption, setCurrentStartOption] = useState(
    startOptions.find((v) => v.value === mode)
  );

  // --- Use shortcut according to the current platform
  const [stepIntoKey, setStepIntoKey] = useState<string>(null);
  const [stepOverKey, setStepOverKey] = useState<string>(null);
  const [stepOutKey, setStepOutKey] = useState<string>(null);

  const { outputPaneService, ideCommandsService } = useAppServices();
  const saveProject = async () => {
    await mainApi.saveProject();
  };

  const tapeSupport = machineInfo?.features?.[MF_TAPE_SUPPORT] ?? false;

  useEffect(() => {
    const mode = isDebugging ? "debug" : "start";
    setStartMode(mode);
    setCurrentStartOption(startOptions.find((v) => v.value === mode));
  }, [isDebugging]);

  useEffect(() => {
    if (!mainApi) return;

    (async () => {
      const settings = await mainApi.getUserSettings();
      setStepIntoKey(settings?.shortcuts?.stepInto ?? (isWindows ? "F11" : "F12"));
      setStepOverKey(settings?.shortcuts?.stepOver ?? "F10");
      setStepOutKey(settings?.shortcuts?.stepOut ?? (isWindows ? "Shift+F11" : "Shift+F12"));
    })();
  }, [mainApi, isWindows]);

  return (
    <HStack
      height="38px"
      backgroundColor="--bgcolor-toolbar"
      paddingHorizontal="--space-1_5"
      paddingVertical="--space-1"
      verticalContentAlignment="center"
    >
      <IconButton
        iconName={currentStartOption.iconName}
        fill="--color-toolbarbutton-green"
        title={currentStartOption.label}
        enable={canStart}
        clicked={async () => {
          if (mayInjectCode && !!currentStartOption.cmd) {
            const buildPane = outputPaneService.getOutputPaneBuffer(PANE_ID_BUILD);
            buildPane.clear();
            await ideCommandsService.executeCommand(currentStartOption.cmd, buildPane);
            await ideCommandsService.executeCommand("outp build");
          } else {
            await emuApi.issueMachineCommand(currentStartOption.value as any);
          }
        }}
      />
      <div
        className={styles.toolbarDropdownContainer}
        style={!canPickStartOption ? { pointerEvents: "none", opacity: ".4" } : {}}
      >
        <Dropdown
          placeholder={undefined}
          options={[...startOptions]}
          initialValue={startMode}
          width={184}
          onChanged={(option) => {
            setStartMode(option);
            setCurrentStartOption(startOptions.find((v) => v.value === option));
          }}
        />
      </div>
      <IconButton
        iconName={state === MachineControllerState.Paused ? "debug-continue" : "pause"}
        fill="--color-toolbarbutton-blue"
        title={
          state === MachineControllerState.Running
            ? "Pause (Shift+F5)"
            : currentStartOption.labelCont
        }
        enable={
          !isCompiling &&
          (state === MachineControllerState.Running ||
            state === MachineControllerState.Pausing ||
            state === MachineControllerState.Paused)
        }
        clicked={async () => {
          const cmd = state !== MachineControllerState.Running ? currentStartOption.value : "pause";
          await emuApi.issueMachineCommand(cmd as any);
        }}
      />
      <IconButton
        iconName="stop"
        fill="--color-toolbarbutton-red"
        title="Stop (F4)"
        enable={
          !isCompiling &&
          (state === MachineControllerState.Running ||
            state === MachineControllerState.Pausing ||
            state === MachineControllerState.Paused)
        }
        clicked={async () => {
          await emuApi.issueMachineCommand("stop");
        }}
      />
      <IconButton
        iconName="restart"
        fill="--color-toolbarbutton-green"
        title="Restart (Shift+F4)"
        enable={
          !isCompiling &&
          (state === MachineControllerState.Running ||
            state === MachineControllerState.Pausing ||
            state === MachineControllerState.Paused)
        }
        clicked={async () => {
          if (ide && kliveProjectLoaded) {
            ideApi.executeCommand("outp build");
            ideApi.executeCommand(isDebugging ? "debug" : "run");
          } else {
            await emuApi.issueMachineCommand("restart");
          }
        }}
      />
      <ToolbarSeparator />
      <IconButton
        iconName="step-into"
        fill="--color-toolbarbutton-blue"
        title={`Step Into (${stepIntoKey})`}
        enable={
          !isCompiling &&
          (state === MachineControllerState.Pausing || state === MachineControllerState.Paused)
        }
        clicked={async () => await emuApi.issueMachineCommand("stepInto")}
      />
      <IconButton
        iconName="step-over"
        fill="--color-toolbarbutton-blue"
        title={`Step Over (${stepOverKey})`}
        enable={
          !isCompiling &&
          (state === MachineControllerState.Pausing || state === MachineControllerState.Paused)
        }
        clicked={async () => await emuApi.issueMachineCommand("stepOver")}
      />
      <IconButton
        iconName="step-out"
        fill="--color-toolbarbutton-blue"
        title={`Step Out (${stepOutKey})`}
        enable={
          !isCompiling &&
          (state === MachineControllerState.Pausing || state === MachineControllerState.Paused)
        }
        clicked={async () => await emuApi.issueMachineCommand("stepOut")}
      />
      {!ide && (
        <>
          <ToolbarSeparator />
          <IconButton
            iconName={stayOnTop ? "pinned" : "pin"}
            fill="--color-toolbarbutton"
            selected={stayOnTop}
            title={"Stay on top"}
            clicked={async () => {
              await mainApi.setGlobalSettingsValue(SETTING_EMU_STAY_ON_TOP, !stayOnTop);
            }}
          />
          <ToolbarSeparator />
          <IconButton
            iconName="vm"
            fill="--color-toolbarbutton"
            selected={showInstantScreen}
            title="Turn on/off instant screen"
            clicked={async () => {
              await mainApi.setGlobalSettingsValue(
                SETTING_EMU_SHOW_INSTANT_SCREEN,
                !showInstantScreen
              );
            }}
          />
          <ToolbarSeparator />
          <IconButton
            iconName="keyboard"
            fill="--color-toolbarbutton"
            selected={showKeyboard}
            title="Show/Hide keyboard"
            clicked={async () => {
              await mainApi.setGlobalSettingsValue(SETTING_EMU_SHOW_KEYBOARD, !showKeyboard);
            }}
          />
          <ToolbarSeparator />
          {!muted && (
            <IconButton
              iconName="mute"
              fill="--color-toolbarbutton"
              title="Mute sound"
              clicked={async () => {
                dispatch(muteSoundAction(true));
                await saveProject();
              }}
            />
          )}
          {muted && (
            <IconButton
              iconName="unmute"
              fill="--color-toolbarbutton"
              title="Unmute sound"
              clicked={async () => {
                dispatch(muteSoundAction(false));
                await saveProject();
              }}
            />
          )}
          {tapeSupport && <ToolbarSeparator />}
          {tapeSupport && (
            <IconButton
              iconName="rocket"
              fill="--color-toolbarbutton"
              title="Fast LOAD mode"
              selected={fastLoad}
              clicked={async () => {
                await mainApi.setGlobalSettingsValue(SETTING_EMU_FAST_LOAD, !fastLoad);
              }}
            />
          )}
          {tapeSupport && (
            <IconButton
              iconName="reverse-tape"
              fill="--color-toolbarbutton"
              title="Rewind the tape"
              enable={!!tapeFile}
              clicked={async () => {
                await mainApi.reloadTapeFile();
                await emuApi.issueMachineCommand("rewind");
              }}
            />
          )}
          <ToolbarSeparator />
          {/* Single recording status button — icon + title reflect current state */}
          <IconButton
            iconName="record"
            fill={
              !recState || recState === "idle"
                ? undefined
                : recState === "armed"
                  ? "#ffd700"
                  : recState === "recording"
                    ? "#ff4444"
                    : "#ff8800"
            }
            selected={recState === "recording" || recState === "armed"}
            title={
              !recState || recState === "idle"
                ? "Arm recording — use Machine › Recording to choose fps"
                : recState === "armed"
                  ? "Armed – waiting for machine to run (click to cancel)"
                  : recState === "recording"
                    ? "Recording... (click to stop)"
                    : "Recording paused (click to stop)"
            }
            clicked={
              !recState || recState === "idle"
                ? () => recordingManagerRef?.current?.arm(undefined, isRunning)
                : () => recordingManagerRef?.current?.disarm()
            }
          />
        </>
      )}
      {ide && (
        <>
          <ToolbarSeparator />
          <IconButton
            iconName="sync-ignored"
            selected={syncSourceBps}
            fill="--color-toolbarbutton-orange"
            title="Sync the source with the current breakpoint"
            clicked={async () => {
              await mainApi.setGlobalSettingsValue(SETTING_IDE_SYNC_BREAKPOINTS, !syncSourceBps);
            }}
          />
          <ToolbarSeparator />
          <IconButton
            iconName="memory-icon"
            fill="--color-toolbarbutton-orange"
            title="Show Memory Panel"
            selected={volatileDocs?.[MEMORY_PANEL_ID]}
            clicked={async () => {
              if (volatileDocs?.[MEMORY_PANEL_ID]) {
                await ideCommandsService.executeCommand("hide-memory");
              } else {
                await ideCommandsService.executeCommand("show-memory");
              }
            }}
          />
          <IconButton
            iconName="disassembly-icon"
            fill="--color-toolbarbutton-orange"
            title="Show Disassembly Panel"
            selected={volatileDocs?.[DISASSEMBLY_PANEL_ID]}
            clicked={async () => {
              if (volatileDocs?.[DISASSEMBLY_PANEL_ID]) {
                await ideCommandsService.executeCommand("hide-disass");
              } else {
                await ideCommandsService.executeCommand("show-disass");
              }
            }}
          />
        </>
      )}
    </HStack>
  );
};
