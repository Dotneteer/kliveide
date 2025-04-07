import styles from "./ToolArea.module.scss";
import classnames from "classnames";
import { useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";
import { ToolsHeader } from "./ToolsHeader";
import { ToolsContainer } from "./ToolsContainer";
import { SETTING_IDE_ACTIVE_TOOL } from "@common/settings/setting-const";
import { useEffect, useState } from "react";

type Props = {
  siblingPosition: string;
};

export const ToolArea = ({ siblingPosition }: Props) => {
  const tools = useSelector((s) => s.ideView?.tools ?? []);
  const activeTool = useGlobalSetting(SETTING_IDE_ACTIVE_TOOL);
  const [activeInstance, setActiveInstance] = useState(tools.find((t) => t.id === activeTool));

  useEffect(() => {
    const instance = tools.find((t) => t.id === activeTool);
    if (instance) {
      setActiveInstance(instance);
    }
  }, [activeTool, tools]);

  return (
    <div className={classnames(styles.toolArea, styles[siblingPosition])}>
      <ToolsHeader topPosition={siblingPosition !== "bottom"} tool={activeInstance} />
      <div className={styles.wrapper}>
        <ToolsContainer tool={activeInstance} />
      </div>
    </div>
  );
};
