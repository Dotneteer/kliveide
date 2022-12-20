import { useDispatch, useSelector } from "@/emu/StoreProvider";
import { showToolPanelsAction, toolPanelsOnTopAction } from "@state/actions";
import { SpaceFiller } from "../common/SpaceFiller";
import { TabButton } from "../common/TabButton";
import styles from "./ToolsHeader.module.scss";
import { ToolTab } from "./ToolTab";

type Props = {
    topPosition: boolean;
}

export const ToolsHeader = ({
    topPosition
} : Props) => {
    const tools = useSelector(s => s.ideView?.tools);
    const activeTool = useSelector(s => s.ideView?.activeTool)
    const dispatch = useDispatch();

    return <div className={styles.component}>
        {(tools ?? []).filter(t => t.visible ?? true).map(d => 
            <ToolTab 
              id={d.id}
              key={d.id}
              name={d.name}
              isActive={d.id === activeTool}
            />
        )}
        <SpaceFiller />
        <div className={styles.commandBar}>
        <TabButton 
            iconName="layout-panel" 
            active={true} 
            useSpace={true}
            rotate={topPosition ? 0 : 180}
            clicked={() => dispatch(toolPanelsOnTopAction(!topPosition))}/>
        <TabButton 
            iconName="close" 
            active={true} 
            clicked={() => dispatch(showToolPanelsAction(false))}/>
        </div>
    </div>
}