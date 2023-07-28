import { useDispatch, useRendererContext, useSelector } from "@/renderer/core/RendererProvider";
import { selectActivityAction, showSideBarAction } from "@/common/state/actions";
import { Activity } from "../abstractions/Activity";
import styles from "./ActivityBar.module.scss";
import { ActivityButton } from "./ActivityButton";

type Props = {
  activities: Activity[];
  order?: number;
};

export const ActivityBar = ({ order, activities }: Props) => {
  const { messenger } = useRendererContext();
  const dispatch = useDispatch();
  const activeActitity = useSelector(s => s.ideView?.activity);
  const sideBarVisible = useSelector(s => s.ideViewOptions?.showSidebar);

  const saveProject = async () => {
    await new Promise(r => setTimeout(r, 100));
    await messenger.sendMessage({ type: "MainSaveProject" });
  };

  return (
    <div className={styles.activityBar} style={{ order }}>
      {[
        ...activities.map(act => (
          <ActivityButton
            key={act.id}
            activity={act}
            active={activeActitity === act.id}
            clicked={() => {
              if (activeActitity === act.id) {
                dispatch(showSideBarAction(!sideBarVisible));
                saveProject();
              } else {
                dispatch(selectActivityAction(act.id));
                if (!sideBarVisible) {
                  dispatch(showSideBarAction(true));
                  saveProject();
                }
              }
            }}
          />
        ))
      ]}
    </div>
  );
};
