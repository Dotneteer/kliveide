import { ToolInfo } from "@/ide/abstractions";
import { toolPanelRegistry } from "@/registry";
import { createElement } from "react";
import styles from "./ToolsContainer.module.scss";

type Props = {
    tool?: ToolInfo
}

export const ToolsContainer = ({
    tool
}: Props) => {
    const panelRenderer = toolPanelRegistry.find(p => p.id === tool?.id);
    const panelElement = panelRenderer?.renderer
        ? createElement(panelRenderer.renderer, tool)
        : null
    return tool
        ? <div className={styles.component}>
            {panelElement}
        </div>
        : null;
}