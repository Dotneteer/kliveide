import { MachineControllerState } from "@common/abstractions/MachineControllerState";
import {
  useDispatch,
  useRendererContext,
  useSelector
} from "@/core/RendererProvider";
import {
  muteSoundAction,
  setFastLoadAction,
  showKeyboardAction
} from "@state/actions";
import { IconButton } from "./IconButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import styles from "./Toolbar.module.scss";
import { createMachineCommand } from "@messaging/main-to-emu";

export const Toolbar = () => {
  const dispatch = useDispatch();
  const state = useSelector(s => s.emulatorState?.machineState);
  const showKeyboard = useSelector(
    s => s.emuViewOptions?.showKeyboard ?? false
  );
  const muted = useSelector(s => s.emulatorState?.soundMuted ?? false);
  const fastLoad = useSelector(s => s.emulatorState?.fastLoad ?? false);

  const { messenger } = useRendererContext();

  return (
    <div className={styles.toolbar}>
      <IconButton
        iconName='play'
        fill='--color-toolbarbutton-green'
        title='Start'
        enable={
          state === MachineControllerState.None ||
          state === MachineControllerState.Pausing ||
          state === MachineControllerState.Paused ||
          state === MachineControllerState.Stopped
        }
        clicked={async () =>
          await messenger.sendMessage(createMachineCommand("start"))
        }
      />
      <IconButton
        iconName='pause'
        fill='--color-toolbarbutton-blue'
        title='Pause'
        enable={state === MachineControllerState.Running}
        clicked={async () =>
          await messenger.sendMessage(createMachineCommand("pause"))
        }
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
        clicked={async () =>
          await messenger.sendMessage(createMachineCommand("stop"))
        }
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
        clicked={async () =>
          await messenger.sendMessage(createMachineCommand("restart"))
        }
      />
      <ToolbarSeparator />
      <IconButton
        iconName='debug'
        fill='--color-toolbarbutton-green'
        title='Debug'
        enable={
          state === MachineControllerState.None ||
          state === MachineControllerState.Pausing ||
          state === MachineControllerState.Paused ||
          state === MachineControllerState.Stopped
        }
        clicked={async () =>
          await messenger.sendMessage(createMachineCommand("debug"))
        }
      />
      <IconButton
        iconName='step-into'
        fill='--color-toolbarbutton-blue'
        title='Step Into'
        enable={
          state === MachineControllerState.Pausing ||
          state === MachineControllerState.Paused
        }
        clicked={async () =>
          await messenger.sendMessage(createMachineCommand("stepInto"))
        }
      />
      <IconButton
        iconName='step-over'
        fill='--color-toolbarbutton-blue'
        title='Step Over'
        enable={
          state === MachineControllerState.Pausing ||
          state === MachineControllerState.Paused
        }
        clicked={async () =>
          await messenger.sendMessage(createMachineCommand("stepOver"))
        }
      />
      <IconButton
        iconName='step-out'
        fill='--color-toolbarbutton-blue'
        title='Step Out'
        enable={
          state === MachineControllerState.Pausing ||
          state === MachineControllerState.Paused
        }
        clicked={async () =>
          await messenger.sendMessage(createMachineCommand("stepOut"))
        }
      />
      <ToolbarSeparator />
      <IconButton
        iconName='keyboard'
        fill='--color-toolbarbutton'
        selected={showKeyboard}
        title='Show/Hide keyboard'
        clicked={() => dispatch(showKeyboardAction(!showKeyboard))}
      />
      <ToolbarSeparator />
      {!muted && (
        <IconButton
          iconName='mute'
          fill='--color-toolbarbutton'
          title='Mute sound'
          clicked={() => dispatch(muteSoundAction(true))}
        />
      )}
      {muted && (
        <IconButton
          iconName='unmute'
          fill='--color-toolbarbutton'
          title='Unmute sound'
          clicked={() => dispatch(muteSoundAction(false))}
        />
      )}
      <ToolbarSeparator />
      <IconButton
        iconName='rocket'
        fill='--color-toolbarbutton'
        title='Fast LOAD mode'
        selected={fastLoad}
        clicked={() => dispatch(setFastLoadAction(!fastLoad))}
      />
      <IconButton
        iconName='reverse-tape'
        fill='--color-toolbarbutton'
        title='Rewind the tape'
        clicked={async () =>
          await messenger.sendMessage(createMachineCommand("rewind"))
        }
      />
    </div>
  );
};
