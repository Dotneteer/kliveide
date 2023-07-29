import { toolPanelRegistry } from "@renderer/registry";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import { createElement } from "react";
import styles from "./ToolsContainer.module.scss";

type Props = {
  tool?: ToolInfo;
};

export const ToolsContainer = ({ tool }: Props) => {
  const panelRenderer = toolPanelRegistry.find(p => p.id === tool?.id);
  const panelElement = panelRenderer?.renderer
    ? createElement(panelRenderer.renderer, tool)
    : null;
  return tool ? (
    <div className={styles.toolsContainer}>{panelElement}</div>
  ) : null;
};
