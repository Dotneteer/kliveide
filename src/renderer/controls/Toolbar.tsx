import styles from "./Toolbar.module.scss";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import {
  muteSoundAction,
  setFastLoadAction,
  setRestartTarget,
  showKeyboardAction,
  showInstantScreenAction,
  syncSourceBreakpointsAction
} from "@state/actions";
import { IconButton } from "./IconButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import { useEffect, useState } from "react";
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

type Props = {
  ide: boolean;
  kliveProjectLoaded: boolean;
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

export const Toolbar = ({ ide, kliveProjectLoaded }: Props) => {
  const dispatch = useDispatch();
  const emuApi = useEmuApi();
  const ideApi = useIdeApi();
  const mainApi = useMainApi();
  const machineId = useSelector((s) => s.emulatorState.machineId);
  const machineInfo = machineRegistry.find((mi) => mi.machineId === machineId);
  const state = useSelector((s) => s.emulatorState?.machineState);
  const volatileDocs = useSelector((s) => s.ideView.volatileDocs);
  const showKeyboard = useSelector((s) => s.emuViewOptions?.showKeyboard ?? false);
  const showInstantScreen = useSelector((s) => s.emuViewOptions?.showInstantScreen ?? false);
  const syncSourceBps = useSelector((s) => s.ideViewOptions?.syncSourceBreakpoints ?? true);
  const muted = useSelector((s) => s.emulatorState?.soundMuted ?? false);
  const fastLoad = useSelector((s) => s.emulatorState?.fastLoad ?? false);
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

  const storeDispatch = useDispatch();
  const restartTarget = useSelector((s) => s.ideView?.restartTarget ?? "machine");

  const { outputPaneService, ideCommandsService } = useAppServices();
  const saveProject = async () => {
    await new Promise((r) => setTimeout(r, 100));
    await mainApi.saveProject();
  };

  const tapeSupport = machineInfo?.features?.[MF_TAPE_SUPPORT] ?? false;

  useEffect(() => {
    const mode = isDebugging ? "debug" : "start";
    setStartMode(mode);
    console.log(
      "isDebugging",
      startOptions.find((v) => v.value === mode)
    );
    setCurrentStartOption(startOptions.find((v) => v.value === mode));
  }, [isDebugging]);

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
            storeDispatch(setRestartTarget("project"));
            const buildPane = outputPaneService.getOutputPaneBuffer(PANE_ID_BUILD);
            await ideCommandsService.executeCommand(currentStartOption.cmd, buildPane);
            await ideCommandsService.executeCommand("outp build");
          } else {
            storeDispatch(setRestartTarget("machine"));
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
          switch (restartTarget) {
            case "project": {
              if (kliveProjectLoaded) {
                ideApi.executeCommand("outp build");
                ideApi.executeCommand(isDebugging ? "debug" : "run");
                break;
              }
            }

            // case 'machine':
            default: {
              await emuApi.issueMachineCommand("restart");
              break;
            }
          }
        }}
      />
      <ToolbarSeparator />
      <IconButton
        iconName="step-into"
        fill="--color-toolbarbutton-blue"
        title="Step Into (F10)"
        enable={
          !isCompiling &&
          (state === MachineControllerState.Pausing || state === MachineControllerState.Paused)
        }
        clicked={async () => await emuApi.issueMachineCommand("stepInto")}
      />
      <IconButton
        iconName="step-over"
        fill="--color-toolbarbutton-blue"
        title="Step Over (F11)"
        enable={
          !isCompiling &&
          (state === MachineControllerState.Pausing || state === MachineControllerState.Paused)
        }
        clicked={async () => await emuApi.issueMachineCommand("stepOver")}
      />
      <IconButton
        iconName="step-out"
        fill="--color-toolbarbutton-blue"
        title="Step Out (Ctrl+F11)"
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
            iconName="vm"
            fill="--color-toolbarbutton"
            selected={showInstantScreen}
            title="Turn on/off instant screen"
            clicked={async () => {
              dispatch(showInstantScreenAction(!showInstantScreen));
              await saveProject();
            }}
          />
          <ToolbarSeparator />
          <IconButton
            iconName="keyboard"
            fill="--color-toolbarbutton"
            selected={showKeyboard}
            title="Show/Hide keyboard"
            clicked={async () => {
              dispatch(showKeyboardAction(!showKeyboard));
              await saveProject();
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
                dispatch(setFastLoadAction(!fastLoad));
                await saveProject();
              }}
            />
          )}
          {tapeSupport && (
            <IconButton
              iconName="reverse-tape"
              fill="--color-toolbarbutton"
              title="Rewind the tape"
              clicked={async () => await emuApi.issueMachineCommand("rewind")}
            />
          )}
        </>
      )}
      {ide && (
        <>
          <ToolbarSeparator />
          <IconButton
            iconName="sync-ignored"
            selected={syncSourceBps}
            fill="orange"
            title="Stop sync with current source code breakpoint"
            enable={kliveProjectLoaded}
            clicked={() => {
              dispatch(syncSourceBreakpointsAction(!syncSourceBps));
            }}
          />
          <ToolbarSeparator />
          <IconButton
            iconName="memory-icon"
            fill="orange"
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
            fill="orange"
            title="Show Z80 Disassembly Panel"
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
