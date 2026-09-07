import styles from "./ToolTab.module.scss";
import classnames from "classnames";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import { useMainApi } from "@renderer/core/MainApi";
import { SETTING_IDE_ACTIVE_TOOL } from "@common/settings/setting-const";

export type Props = ToolInfo & {
  isActive?: boolean;
};

/**
 * One tab in the tool area — Commands, Output.
 *
 * A real `<button>` with `role="tab"`, matching `ActivityButton`. It was an unfocusable `<div>` with
 * an `onClick`: no `tabIndex`, no `role`, no `aria-selected` and no focus ring, which made the tool
 * area's primary navigation reachable by mouse and by nothing else. That is the same defect Phase 2
 * fixed on the toolbar, document tabs and activity bar, and it survived here because this tab is a
 * plain text label rather than one of the shared button controls.
 *
 * The wrapper `<div>` the label used to sit in is gone: the button is the tab, and the active
 * marker sits on it directly.
 */
export const ToolTab = ({ id, name, isActive = false }: Props) => {
  const mainApi = useMainApi();
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={classnames(styles.toolTab, { [styles.active]: isActive })}
      onClick={async () => {
        await mainApi.setGlobalSettingsValue(SETTING_IDE_ACTIVE_TOOL, id);
      }}
    >
      <span className={classnames(styles.titleText, { [styles.activeTitle]: isActive })}>
        {name}
      </span>
    </button>
  );
};
