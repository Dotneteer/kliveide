import { MachineControllerState } from "@state/MachineControllerState";
import { useDispatch, useSelector } from "@/core/RendererProvider";
import { muteSoundAction, setFastLoadAction, showKeyboardAction } from "@state/actions";
import { IconButton } from "../common/IconButton";
import { ToolbarSeparator } from "../common/ToolbarSeparator";
import styles from "./Toolbar.module.scss";
import { useController } from "@/core/useController";

export const Toolbar = () => {
    const dispatch = useDispatch();
    const controller = useController();
    const state = useSelector(s => s.ideView?.machineState);
    const showKeyboard = useSelector(s => s.emuViewOptions?.showKeyboard ?? false);
    const muted = useSelector(s => s.ideView?.soundMuted ?? false);
    const fastLoad = useSelector(s => s.ideView?.fastLoad ?? false);

    return <div className={styles.component}>
        <IconButton 
            iconName="play" 
            fill="--color-toolbarbutton-green" 
            title="Start" 
            enable={
                state  === MachineControllerState.None || 
                state  === MachineControllerState.Pausing || 
                state === MachineControllerState.Paused || 
                state === MachineControllerState.Stopped
            }
            clicked={() => controller.start() }/>
        <IconButton 
            iconName="pause" 
            fill="--color-toolbarbutton-blue" 
            title="Pause" 
            enable={
                state === MachineControllerState.Running
            }
            clicked={() => controller.pause() }/>
        <IconButton 
            iconName="stop" 
            fill="--color-toolbarbutton-red" 
            title="Stop" 
            enable={
                state === MachineControllerState.Running ||
                state === MachineControllerState.Pausing ||
                state === MachineControllerState.Paused
            }
            clicked={() => controller.stop() }/>
        <IconButton 
            iconName="restart" 
            fill="--color-toolbarbutton-green" 
            title="Restart" 
            enable={
                state === MachineControllerState.Running ||
                state === MachineControllerState.Pausing ||
                state === MachineControllerState.Paused
            }
            clicked={() => controller.restart() }/>
        <ToolbarSeparator />
        <IconButton 
            iconName="debug" 
            fill="--color-toolbarbutton-green" 
            title="Debug" 
            enable={
                state  === MachineControllerState.None || 
                state === MachineControllerState.Pausing ||
                state === MachineControllerState.Paused || 
                state === MachineControllerState.Stopped
            }
            clicked={() => controller.startDebug() }/>
        <IconButton 
            iconName="step-into" 
            fill="--color-toolbarbutton-blue" 
            title="Step Into" 
            enable={
                state === MachineControllerState.Pausing ||
                state === MachineControllerState.Paused
            }
            clicked={() => controller.stepInto() }/>
        <IconButton 
            iconName="step-over" 
            fill="--color-toolbarbutton-blue" 
            title="Step Over" 
            enable={
                state === MachineControllerState.Pausing ||
                state === MachineControllerState.Paused
            }
            clicked={() => controller.stepOver() }/>
        <IconButton 
            iconName="step-out" 
            fill="--color-toolbarbutton-blue" 
            title="Step Out" 
            enable={
                state === MachineControllerState.Pausing ||
                state === MachineControllerState.Paused
            }
            clicked={() => controller.stepOut() }/>
        <ToolbarSeparator />
        <IconButton 
            iconName="keyboard"
            fill="--color-toolbarbutton" 
            selected={showKeyboard} 
            title="Show/Hide keyboard" 
            clicked={() => dispatch(showKeyboardAction(!showKeyboard))} />
        <ToolbarSeparator />
        { !muted && <IconButton 
            iconName="mute"
            fill="--color-toolbarbutton" 
            title="Mute sound" 
            clicked={() => dispatch(muteSoundAction(true))} />
        }
        { muted && <IconButton 
            iconName="unmute"
            fill="--color-toolbarbutton" 
            title="Unmute sound" 
            clicked={() => dispatch(muteSoundAction(false))} />
        }
        <ToolbarSeparator />
        <IconButton 
            iconName="rocket"
            fill="--color-toolbarbutton" 
            title="Fast LOAD mode" 
            selected={fastLoad}
            clicked={() => dispatch(setFastLoadAction(!fastLoad))} />
        <IconButton 
            iconName="reverse-tape"
            fill="--color-toolbarbutton" 
            title="Rewind the tape" 
            clicked={() => console.log("Rewind the tape")} />
   </div>
}