import { Activity } from "@/core/abstractions";
import { useDispatch, useSelector } from "@/core/RendererProvider";
import { selectActivityAction, showSideBarAction } from "@state/actions";
import styles from "./ActivityBar.module.scss";
import { ActivityButton } from "./ActivityButton";

type Props = {
  activities: Activity[];
  order?: number;
};

export const ActivityBar = ({ order, activities }: Props) => {
  const dispatch = useDispatch();
  const activeActitity = useSelector(s => s.ideView?.activity);
  const sideBarVisible = useSelector(s => s.ideViewOptions?.showSidebar);

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
              } else {
                dispatch(selectActivityAction(act.id));
                if (!sideBarVisible) {
                  dispatch(showSideBarAction(true));
                }
              }
            }}
          />
        ))
      ]}
    </div>
  );
};
