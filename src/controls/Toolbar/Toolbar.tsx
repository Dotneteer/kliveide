import { IconButton } from "../common/IconButton";
import { ToolbarSeparator } from "../common/ToolbarSeparator";
import styles from "./Toolbar.module.scss";

export const Toolbar = () => {
    return <div className={styles.component}>
        <IconButton 
            iconName="play" 
            fill="--color-toolbarbutton-green" 
            title="Start" 
            clicked={() => console.log("Start") }/>
        <IconButton 
            iconName="pause" 
            fill="--color-toolbarbutton-blue" 
            title="Pause" 
            clicked={() => console.log("Pause")} />
        <IconButton 
            iconName="stop" 
            fill="--color-toolbarbutton-red" 
            enable={true} 
            title="Stop" 
            clicked={() => console.log("Stop")}/>
        <IconButton 
            iconName="restart" 
            fill="--color-toolbarbutton-green" 
            title="Restart" 
            clicked={() => console.log("Restart") }/>
        <ToolbarSeparator />
        <IconButton 
            iconName="debug" 
            fill="--color-toolbarbutton-green" 
            title="Debug" 
            clicked={() => console.log("Debug") }/>
        <IconButton 
            iconName="step-into" 
            fill="--color-toolbarbutton-blue" 
            title="Step Into" 
            clicked={() => console.log("Step Into")} />
        <IconButton 
            iconName="step-over" 
            fill="--color-toolbarbutton-blue" 
            title="Step Over" 
            clicked={() => console.log("Step Over")} />
        <IconButton 
            iconName="step-out" 
            fill="--color-toolbarbutton-blue" 
            title="Step Out" 
            clicked={() => console.log("Step Out")} />
        <ToolbarSeparator />
        <IconButton 
            iconName="keyboard"
            fill="--color-toolbarbutton" 
            selected={true} 
            title="Show/Hide keyboard" 
            clicked={() => console.log("Step Out")} />
   </div>
}