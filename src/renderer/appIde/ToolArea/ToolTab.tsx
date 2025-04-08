import styles from "./ToolTab.module.scss";
import classnames from "classnames";
import { useState } from "react";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import { useMainApi } from "@renderer/core/MainApi";
import { SETTING_IDE_ACTIVE_TOOL } from "@common/settings/setting-const";

export type Props = ToolInfo & {
  isActive?: boolean;
};
export const ToolTab = ({ id, name, isActive = false }: Props) => {
  const mainApi = useMainApi();
  const [pointed, setPointed] = useState(false);
  return (
    <div
      className={styles.toolTab}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
      onClick={async () => {
        await mainApi.setGlobalSettingsValue(SETTING_IDE_ACTIVE_TOOL, id);
      }}
    >
      <div
        className={classnames(styles.textWrapper, {
          [styles.active]: isActive
        })}
      >
        <span
          className={classnames(styles.titleText, {
            [styles.activeTitle]: isActive || pointed
          })}
        >
          {name}
        </span>
      </div>
    </div>
  );
};
