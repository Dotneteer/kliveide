import { Activity } from "@/core/abstractions";
import { useDispatch, useSelector } from "@/emu/StoreProvider";
import { selectActivityAction } from "@state/actions";
import styles from "./ActivityBar.module.scss";
import { ActivityButton } from "./ActivityButton";

type Props = {
    activities: Activity[];
    order?: number;
}

export const ActivityBar = ({
    order,
    activities,
}: Props) => {
    const dispatch = useDispatch();
    const activeActitity = useSelector(s => s.ideView?.activity)
    return <div className={styles.component} style={{order}}>
        {
            [...activities.map(act => 
                <ActivityButton 
                    key={act.id} 
                    activity={act} 
                    active={activeActitity === act.id}
                    clicked={() => dispatch(selectActivityAction(act.id))} />)]
        }
    </div>
}