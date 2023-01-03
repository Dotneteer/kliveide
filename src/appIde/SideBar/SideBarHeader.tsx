import { Activity } from "@/core/abstractions";
import { ForwardedRef, forwardRef } from "react";
import styles from "./SideBarHeader.module.scss";

type Props = {
    activity?: Activity;
};
  
export const SideBarHeader = forwardRef(({ activity }: Props, ref: ForwardedRef<HTMLDivElement>) => {
    return (
        <div ref={ref} className={styles.component}>
          <span className={styles.text}>{activity?.title}</span>
        </div>
    );
  });