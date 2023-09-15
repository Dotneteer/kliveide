import { MachineControllerState } from "@abstractions/MachineControllerState";
import {
  useDispatch,
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import {
  muteSoundAction,
  setFastLoadAction,
  showKeyboardAction,
  syncSourceBreakpointsAction
} from "@state/actions";
import { IconButton } from "./IconButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import styles from "./Toolbar.module.scss";
import { createMachineCommand } from "@messaging/main-to-emu";
import { reportMessagingError } from "@renderer/reportError";

type Props = {
  ide?: boolean;
};

export const Toolbar = ({ ide = false }: Props) => {
  const dispatch = useDispatch();
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
  const debugContinue =
    isDebugging &&
    state !== MachineControllerState.None &&
    state !== MachineControllerState.Stopped;
  const { messenger } = useRendererContext();
  const saveProject = async () => {
    await new Promise(r => setTimeout(r, 100));
    const response = await messenger.sendMessage({ type: "MainSaveProject" });
    if (response.type === "ErrorResponse") {
      reportMessagingError(`MainSaveProject call failed: ${response.message}`);
    }
  };

  return (
    <div className={styles.toolbar}>
      <IconButton
        iconName='play'
        fill='--color-toolbarbutton-green'
        title={
          state === MachineControllerState.Paused
            ? "Continue without debugging"
            : "Start without debugging"
        }
        enable={
          state === MachineControllerState.None ||
          state === MachineControllerState.Pausing ||
          state === MachineControllerState.Paused ||
          state === MachineControllerState.Stopped
        }
        clicked={async () => {
          const response = await messenger.sendMessage(
            createMachineCommand("start")
          );
          if (response.type === "ErrorResponse") {
            reportMessagingError(
              `Starting machine failed: ${response.message}`
            );
          }
        }}
      />
      <IconButton
        iconName='pause'
        fill='--color-toolbarbutton-blue'
        title='Pause'
        enable={state === MachineControllerState.Running}
        clicked={async () => {
          const response = await messenger.sendMessage(
            createMachineCommand("pause")
          );
          if (response.type === "ErrorResponse") {
            reportMessagingError(`Pausing machine failed: ${response.message}`);
          }
        }}
      />
      <IconButton
        iconName='stop'
        fill='--color-toolbarbutton-red'
        title='Stop'
        enable={
          state === MachineControllerState.Running ||
          state === MachineControllerState.Pausing ||
          state === MachineControllerState.Paused
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
        title='Restart'
        enable={
          state === MachineControllerState.Running ||
          state === MachineControllerState.Pausing ||
          state === MachineControllerState.Paused
        }
        clicked={async () => {
          const response = await messenger.sendMessage(
            createMachineCommand("restart")
          );
          if (response.type === "ErrorResponse") {
            reportMessagingError(
              `Restarting machine failed: ${response.message}`
            );
          }
        }}
      />
      <ToolbarSeparator />
      <IconButton
        iconName={debugContinue ? "debug-continue" : "debug"}
        fill={
          debugContinue
            ? "--color-toolbarbutton-blue"
            : "--color-toolbarbutton-green"
        }
        title={debugContinue ? "Continue debugging" : "Start with debugging"}
        enable={
          state === MachineControllerState.None ||
          state === MachineControllerState.Pausing ||
          state === MachineControllerState.Paused ||
          state === MachineControllerState.Stopped
        }
        clicked={async () => {
          const response = await messenger.sendMessage(
            createMachineCommand("debug")
          );
          if (response.type === "ErrorResponse") {
            reportMessagingError(
              `Starting machine failed: ${response.message}`
            );
          }
        }}
      />
      <IconButton
        iconName='step-into'
        fill='--color-toolbarbutton-blue'
        title='Step Into'
        enable={
          state === MachineControllerState.Pausing ||
          state === MachineControllerState.Paused
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
        title='Step Over'
        enable={
          state === MachineControllerState.Pausing ||
          state === MachineControllerState.Paused
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
        title='Step Out'
        enable={
          state === MachineControllerState.Pausing ||
          state === MachineControllerState.Paused
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
          <ToolbarSeparator />
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
            clicked={() => {
              dispatch(syncSourceBreakpointsAction(!syncSourceBps));
            }}
          />
        </>
      )}
    </div>
  );
};
