import { useDispatch, useSelector } from "@/core/RendererProvider";
import { ToolState } from "@/appIde/abstractions";
import { toolPanelRegistry } from "@/registry";
import {
  incToolCommandSeqNoAction,
  showToolPanelsAction,
  toolPanelsOnTopAction
} from "@state/actions";
import { createElement } from "react";
import { SpaceFiller } from "../../controls/SpaceFiller";
import { TabButton } from "../../controls/TabButton";
import styles from "./ToolsHeader.module.scss";
import { ToolTab } from "./ToolTab";

type Props = {
  tool: ToolState;
  topPosition: boolean;
};

export const ToolsHeader = ({ tool, topPosition }: Props) => {
  const tools = useSelector(s => s.ideView?.tools);
  const activeTool = useSelector(s => s.ideView?.activeTool);
  const panelRenderer = toolPanelRegistry.find(p => p.id === tool?.id);
  const headerElement = panelRenderer?.headerRenderer
    ? createElement(panelRenderer.headerRenderer)
    : null;
  const dispatch = useDispatch();

  return (
    <div className={styles.toolsHeader}>
      {(tools ?? [])
        .filter(t => t.visible ?? true)
        .map(d => (
          <ToolTab
            id={d.id}
            key={d.id}
            name={d.name}
            isActive={d.id === activeTool}
          />
        ))}
      <SpaceFiller />
      {panelRenderer?.headerRenderer && (
        <div className={styles.headerBar}>{headerElement}</div>
      )}
      <div className={styles.commandBar}>
        <TabButton
          iconName='layout-panel'
          useSpace={true}
          rotate={topPosition ? 0 : 180}
          title={topPosition ? "Display at the bottom" : "Display at the top"}
          clicked={() => {
            dispatch(toolPanelsOnTopAction(!topPosition));
            dispatch(incToolCommandSeqNoAction());
          }}
        />
        <TabButton
          iconName='close'
          useSpace={true}
          clicked={() => dispatch(showToolPanelsAction(false))}
        />
      </div>
    </div>
  );
};
