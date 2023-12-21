import { MachineControllerState } from "@abstractions/MachineControllerState";
import {
  useDispatch,
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import {
  muteSoundAction,
  setFastLoadAction,
  setRestartTarget,
  showKeyboardAction,
  syncSourceBreakpointsAction
} from "@state/actions";
import { IconButton } from "./IconButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import styles from "./Toolbar.module.scss";
import { createMachineCommand } from "@messaging/main-to-emu";
import { reportMessagingError } from "@renderer/reportError";
import { Dropdown } from "./Dropdown";
import { useEffect, useState } from "react";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { __DARWIN__ } from "../../electron/electron-utils";
import { machineRegistry } from "@renderer/registry";

type Props = {
  ide: boolean;
  kliveProjectLoaded: boolean;
};

const emuStartOptions = [
  {
    value: "debug",
    label: "Start with Debugging (Ctrl+F5)",
    labelCont: "Continue Debugging (Ctrl+F5)",
    iconName: "debug",
    cmd: null
  },
  {
    value: "start",
    label: "Start Machine (F5)",
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
  const machineId = useSelector(s => s.emulatorState.machineId);
  const machineInfo = machineRegistry.find(mi => mi.machineId === machineId);
  const state = useSelector(s => s.emulatorState?.machineState);
  const showKeyboard = useSelector(
    s => s.emuViewOptions?.showKeyboard ?? false
  );
  const syncSourceBps = useSelector(
    s => s.ideViewOptions?.syncSourceBreakpoints ?? true
  );
  const muted = useSelector(s => s.emulatorState?.soundMuted ?? false);
  const fastLoad = useSelector(s => s.emulatorState?.fastLoad ?? false);
  const isDebugging = useSelector(s => s.emulatorState?.isDebugging ?? false);
  const isCompiling = useSelector(s => s.compilation?.inProgress ?? false);
  const isRunning =
    state !== MachineControllerState.None &&
    state !== MachineControllerState.Stopped;
  const canStart = (!ide || kliveProjectLoaded) && !isCompiling && !isRunning;
  const canPickStartOption = (!ide || kliveProjectLoaded) && !isRunning;
  const mayInjectCode = ide && kliveProjectLoaded;
  const [startMode, setStartMode] = useState(
    ide && kliveProjectLoaded ? "debug" : "start"
  );

  const storeDispatch = useDispatch();
  const restartTarget = useSelector(s => s.ideView?.restartTarget ?? "machine");

  const startOptions =
    ide && kliveProjectLoaded ? ideStartOptions : emuStartOptions;
  const startOpt = !isRunning
    ? startOptions.find(v => v.value === startMode)
    : startOptions[isDebugging ? 0 : 1];

  const { outputPaneService, ideCommandsService } = useAppServices();
  const { messenger } = useRendererContext();
  const saveProject = async () => {
    await new Promise(r => setTimeout(r, 100));
    const response = await messenger.sendMessage({ type: "MainSaveProject" });
    if (response.type === "ErrorResponse") {
      reportMessagingError(`MainSaveProject call failed: ${response.message}`);
    }
  };

  useEffect(() => {
    setStartMode(ide && kliveProjectLoaded ? "debug" : "start");
  }, [ide, kliveProjectLoaded]);

  return (
    <div className={styles.toolbar}>
      <IconButton
        iconName={startOpt.iconName}
        fill='--color-toolbarbutton-green'
        title={startOpt.label}
        enable={canStart}
        clicked={async () => {
          if (mayInjectCode && !!startOpt.cmd) {
            storeDispatch(setRestartTarget("project"));
            const buildPane = outputPaneService.getOutputPaneBuffer("build");
            await ideCommandsService.executeCommand(startOpt.cmd, buildPane);
            await ideCommandsService.executeCommand("outp build");
          } else {
            storeDispatch(setRestartTarget("machine"));
            const response = await messenger.sendMessage(
              createMachineCommand(startOpt.value as any)
            );
            if (response.type === "ErrorResponse") {
              reportMessagingError(
                `Starting machine failed: ${response.message}`
              );
            }
          }
        }}
      />
      <div
        className={styles.toolbarDropdownContainer}
        style={
          !canPickStartOption ? { pointerEvents: "none", opacity: ".4" } : {}
        }
      >
        <Dropdown
          placeholder={undefined}
          options={[...startOptions]}
          value={startMode}
          onSelectionChanged={option => setStartMode(option)}
        />
      </div>
      <IconButton
        iconName={
          state === MachineControllerState.Paused ? "debug-continue" : "pause"
        }
        fill='--color-toolbarbutton-blue'
        title={
          state === MachineControllerState.Running
            ? "Pause (Shift+F5)"
            : startOpt.labelCont
        }
        enable={
          !isCompiling &&
          (state === MachineControllerState.Running ||
            state === MachineControllerState.Pausing ||
            state === MachineControllerState.Paused)
        }
        clicked={async () => {
          const cmd =
            state !== MachineControllerState.Running ? startOpt.value : "pause";
          const response = await messenger.sendMessage(
            createMachineCommand(cmd as any)
          );
          if (response.type === "ErrorResponse") {
            reportMessagingError(`Pausing machine failed: ${response.message}`);
          }
        }}
      />
      <IconButton
        iconName='stop'
        fill='--color-toolbarbutton-red'
        title='Stop (F4)'
        enable={
          !isCompiling &&
          (state === MachineControllerState.Running ||
            state === MachineControllerState.Pausing ||
            state === MachineControllerState.Paused)
        }
        clicked={async () => {
          const response = await messenger.sendMessage(
            createMachineCommand("stop")
          );
          if (response.type === "ErrorResponse") {
            reportMessagingError(
              `Stopping machine failed: ${response.message}`
            );
          }
        }}
      />
      <IconButton
        iconName='restart'
        fill='--color-toolbarbutton-green'
        title='Restart (Shift+F4)'
        enable={
          !isCompiling &&
          (state === MachineControllerState.Running ||
            state === MachineControllerState.Pausing ||
            state === MachineControllerState.Paused)
        }
        clicked={async () => {
          var response: any;
          switch (restartTarget) {
            case "project": {
              if (kliveProjectLoaded) {
                messenger.postMessage({
                  type: "IdeExecuteCommand",
                  commandText: "outp build"
                });
                response = await messenger.sendMessage({
                  type: "IdeExecuteCommand",
                  commandText: isDebugging ? "debug" : "run"
                });
                break;
              }
            }

            // case 'machine':
            default: {
              response = await messenger.sendMessage(
                createMachineCommand("restart")
              );
              break;
            }
          }

          if (response.type === "ErrorResponse") {
            reportMessagingError(
              `Restarting machine failed: ${response.message}`
            );
          }
        }}
      />
      <ToolbarSeparator />
      <IconButton
        iconName='step-into'
        fill='--color-toolbarbutton-blue'
        title='Step Into (F10)'
        enable={
          !isCompiling &&
          (state === MachineControllerState.Pausing ||
            state === MachineControllerState.Paused)
        }
        clicked={async () => {
          const response = await messenger.sendMessage(
            createMachineCommand("stepInto")
          );
          if (response.type === "ErrorResponse") {
            reportMessagingError(
              `Starting machine failed: ${response.message}`
            );
          }
        }}
      />
      <IconButton
        iconName='step-over'
        fill='--color-toolbarbutton-blue'
        title='Step Over (F11)'
        enable={
          !isCompiling &&
          (state === MachineControllerState.Pausing ||
            state === MachineControllerState.Paused)
        }
        clicked={async () => {
          const response = await messenger.sendMessage(
            createMachineCommand("stepOver")
          );
          if (response.type === "ErrorResponse") {
            reportMessagingError(
              `Starting machine failed: ${response.message}`
            );
          }
        }}
      />
      <IconButton
        iconName='step-out'
        fill='--color-toolbarbutton-blue'
        title='Step Out (Ctrl+F11)'
        enable={
          !isCompiling &&
          (state === MachineControllerState.Pausing ||
            state === MachineControllerState.Paused)
        }
        clicked={async () => {
          const response = await messenger.sendMessage(
            createMachineCommand("stepOut")
          );
          if (response.type === "ErrorResponse") {
            reportMessagingError(
              `Starting machine failed: ${response.message}`
            );
          }
        }}
      />
      {!ide && (
        <>
          <ToolbarSeparator />
          <IconButton
            iconName='keyboard'
            fill='--color-toolbarbutton'
            selected={showKeyboard}
            title='Show/Hide keyboard'
            clicked={async () => {
              dispatch(showKeyboardAction(!showKeyboard));
              await saveProject();
            }}
          />
          <ToolbarSeparator />
          {!muted && (
            <IconButton
              iconName='mute'
              fill='--color-toolbarbutton'
              title='Mute sound'
              clicked={async () => {
                dispatch(muteSoundAction(true));
                await saveProject();
              }}
            />
          )}
          {muted && (
            <IconButton
              iconName='unmute'
              fill='--color-toolbarbutton'
              title='Unmute sound'
              clicked={async () => {
                dispatch(muteSoundAction(false));
                await saveProject();
              }}
            />
          )}
          {machineInfo?.tapeSupport && <ToolbarSeparator />}
          {machineInfo?.tapeSupport && (
            <IconButton
              iconName='rocket'
              fill='--color-toolbarbutton'
              title='Fast LOAD mode'
              selected={fastLoad}
              clicked={async () => {
                dispatch(setFastLoadAction(!fastLoad));
                await saveProject();
              }}
            />
          )}
          {machineInfo?.tapeSupport && (
            <IconButton
              iconName='reverse-tape'
              fill='--color-toolbarbutton'
              title='Rewind the tape'
              clicked={async () => {
                const response = await messenger.sendMessage(
                  createMachineCommand("rewind")
                );
                if (response.type === "ErrorResponse") {
                  reportMessagingError(
                    `Rewinding tape failed: ${response.message}`
                  );
                }
              }}
            />
          )}
        </>
      )}
      {ide && (
        <>
          <ToolbarSeparator />
          <IconButton
            iconName='sync-ignored'
            selected={syncSourceBps}
            fill='orange'
            title='Stop sync with current source code breakpoint'
            enable={kliveProjectLoaded}
            clicked={() => {
              dispatch(syncSourceBreakpointsAction(!syncSourceBps));
            }}
          />
        </>
      )}
    </div>
  );
};
