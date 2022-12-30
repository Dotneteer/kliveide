import { ToolInfo } from "@/ide/abstractions";
import { toolPanelRegistry } from "@/registry";
import styles from "./ToolsContainer.module.scss";

type Props = {
    tool?: ToolInfo
}

export const ToolsContainer = ({
    tool
}: Props) => {
    const panelRenderer = toolPanelRegistry.find(p => p.id === tool?.id);
    return tool
        ? <div className={styles.component}>
            {panelRenderer?.renderer(tool.id, tool, {})}
        </div>
        : null;
}