import { useDispatch, useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";
import { selectActivityAction } from "@state/actions";
import { Activity } from "../../abstractions/Activity";
import styles from "./ActivityBar.module.scss";
import { ActivityButton } from "./ActivityButton";
import { useMainApi } from "@renderer/core/MainApi";
import { SETTING_IDE_SHOW_SIDEBAR } from "@common/settings/setting-const";

type Props = {
  activities: Activity[];
  order?: number;
};

export const ActivityBar = ({ order, activities }: Props) => {
  const mainApi = useMainApi();
  const dispatch = useDispatch();
  const activeActitity = useSelector((s) => s.ideView?.activity);
  const sideBarVisible = useGlobalSetting(SETTING_IDE_SHOW_SIDEBAR);

  return (
    <div className={styles.activityBar} style={{ order }}>
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
    </div>
  );
};
