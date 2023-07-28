import styles from "./ToolTab.module.scss";
import classnames from "@/utils/classnames";
import { useDispatch } from "@/core/RendererProvider";
import { useState } from "react";
import { activateToolAction } from "@/common/state/actions";
import { ToolInfo } from "@/common/abstractions/ToolInfo";

export type Props = ToolInfo & {
  isActive?: boolean;
};
export const ToolTab = ({ id, name, isActive = false }: Props) => {
  const dispatch = useDispatch();
  const [pointed, setPointed] = useState(false);
  return (
    <div
      className={styles.toolTab}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
      onClick={() => dispatch(activateToolAction(id))}
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
