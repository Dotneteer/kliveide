import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import { toolPanelRegistry } from "@renderer/registry";
import {
  incToolCommandSeqNoAction,
  maximizeToolsAction,
  showToolPanelsAction,
  toolPanelsOnTopAction
} from "@state/actions";
import { createElement } from "react";
import { SpaceFiller } from "@controls/SpaceFiller";
import { TabButton } from "@controls/TabButton";
import styles from "./ToolsHeader.module.scss";
import { ToolTab } from "./ToolTab";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import { useMainApi } from "@renderer/core/MainApi";

type Props = {
  tool: ToolInfo;
  topPosition: boolean;
};

export const ToolsHeader = ({ tool, topPosition }: Props) => {
  const mainApi = useMainApi();
  const tools = useSelector((s) => s.ideView?.tools);
  const activeTool = useSelector((s) => s.ideView?.activeTool);
  const maximized = useSelector((s) => s.ideViewOptions.maximizeTools);
  const panelRenderer = toolPanelRegistry.find((p) => p.id === tool?.id);
  const headerElement = panelRenderer?.headerRenderer
    ? createElement(panelRenderer.headerRenderer)
    : null;
  const dispatch = useDispatch();

  return (
    <div className={styles.toolsHeader}>
      {(tools ?? [])
        .filter((t) => t.visible ?? true)
        .map((d) => (
          <ToolTab id={d.id} key={d.id} name={d.name} isActive={d.id === activeTool} />
        ))}
      <SpaceFiller />
      {panelRenderer?.headerRenderer && <div className={styles.headerBar}>{headerElement}</div>}
      <div className={styles.commandBar}>
        <TabButton
          iconName="layout-panel"
          useSpace={true}
          rotate={topPosition ? 0 : 180}
          title={topPosition ? "Display at the bottom" : "Display at the top"}
          clicked={async () => {
            dispatch(toolPanelsOnTopAction(!topPosition));
            dispatch(incToolCommandSeqNoAction());
            await mainApi.saveProject();
          }}
        />
        <TabButton
          iconName={maximized ? "chevron-down" : "chevron-up"}
          title={(maximized ? "Restore" : "Maximize") + " Command and Output"}
          useSpace={true}
          clicked={async () => {
            dispatch(maximizeToolsAction(!maximized));
            await mainApi.saveProject();
          }}
        />
      </div>
    </div>
  );
};
