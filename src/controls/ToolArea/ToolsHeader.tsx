import { useDispatch, useSelector } from "@/emu/StoreProvider";
import { ToolState } from "@/ide/abstractions";
import { toolPanelRegistry } from "@/registry";
import { showToolPanelsAction, toolPanelsOnTopAction } from "@state/actions";
import { createElement } from "react";
import { SpaceFiller } from "../common/SpaceFiller";
import { TabButton } from "../common/TabButton";
import styles from "./ToolsHeader.module.scss";
import { ToolTab } from "./ToolTab";

type Props = {
    tool: ToolState,
    topPosition: boolean;
}

export const ToolsHeader = ({
    tool,
    topPosition
} : Props) => {
    const tools = useSelector(s => s.ideView?.tools);
    const activeTool = useSelector(s => s.ideView?.activeTool)
    const panelRenderer = toolPanelRegistry.find(p => p.id === tool?.id);
    const headerElement = panelRenderer?.headerRenderer
        ? createElement(panelRenderer.headerRenderer)
        : null;
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
        {panelRenderer?.headerRenderer && 
            <div className={styles.headerBar}>
                {headerElement}
            </div>
        }
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