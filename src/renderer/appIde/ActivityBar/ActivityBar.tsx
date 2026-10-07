import { useDispatch, useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";
import { selectActivityAction } from "@state/actions";
import { Activity } from "../../abstractions/Activity";
import styles from "./ActivityBar.module.scss";
import { ActivityButton } from "./ActivityButton";
import { useMainApi } from "@renderer/core/MainApi";
import { SETTING_IDE_SHOW_SIDEBAR, SETTING_IDE_SIDEBAR_TO_RIGHT } from "@common/settings/setting-const";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@renderer/controls/ContextMenu";

type Props = {
  activities: Activity[];
  order?: number;
};

export const ActivityBar = ({ order, activities }: Props) => {
  const mainApi = useMainApi();
  const dispatch = useDispatch();
  const activeActitity = useSelector((s) => s.ideView?.activity);
  const sideBarVisible = useGlobalSetting(SETTING_IDE_SHOW_SIDEBAR);
  const sideBarToRight = useGlobalSetting(SETTING_IDE_SIDEBAR_TO_RIGHT);
  // --- The layout is changed where the layout is (`.plans/MENU_REDESIGN_PLAN.md` §5)
  const [menuState, menuApi] = useContextMenuState();

  return (
    <div
      className={styles.activityBar}
      style={{ order }}
      // The buttons are role="tab"; the strip that owns them is the tab list.
      role="tablist"
      aria-orientation="vertical"
      aria-label="Activities"
      onContextMenu={(e) => {
        e.preventDefault();
        menuApi.show(e);
      }}
    >
      {[
        ...activities.map((act) => (
          <ActivityButton
            key={act.id}
            activity={act}
            active={activeActitity === act.id}
            clicked={async () => {
              if (activeActitity === act.id) {
                await mainApi.setGlobalSettingsValue(SETTING_IDE_SHOW_SIDEBAR, !sideBarVisible);
              } else {
                dispatch(selectActivityAction(act.id));
                if (!sideBarVisible) {
                  await mainApi.setGlobalSettingsValue(SETTING_IDE_SHOW_SIDEBAR, true);
                }
              }
            }}
          />
        ))
      ]}
      {menuState.contextVisible && (
        <ContextMenu state={menuState} onClickOutside={menuApi.conceal}>
          <ContextMenuItem
            text={sideBarToRight ? "Move Sidebar to the Left" : "Move Sidebar to the Right"}
            clicked={async () => {
              menuApi.conceal();
              await mainApi.setGlobalSettingsValue(SETTING_IDE_SIDEBAR_TO_RIGHT, !sideBarToRight);
            }}
          />
          <ContextMenuItem
            text={sideBarVisible ? "Hide Sidebar" : "Show Sidebar"}
            clicked={async () => {
              menuApi.conceal();
              await mainApi.setGlobalSettingsValue(SETTING_IDE_SHOW_SIDEBAR, !sideBarVisible);
            }}
          />
          <ContextMenuSeparator />
          <ContextMenuItem
            text="Appearance Settings..."
            clicked={async () => {
              menuApi.conceal();
              await mainApi.runUiAction("open-settings", "appearance");
            }}
          />
        </ContextMenu>
      )}
    </div>
  );
};
