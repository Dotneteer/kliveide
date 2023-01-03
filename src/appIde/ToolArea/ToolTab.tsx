import styles from "./ToolTab.module.scss";
import { ToolInfo } from "@/appIde/abstractions";
import classnames from "@/utils/classnames";
import { useDispatch } from "@/core/RendererProvider";
import { useState } from "react";
import { activateToolAction } from "@state/actions";

export type Props = ToolInfo & {
    isActive?: boolean;
}
export const ToolTab = ({
    id,
    name,
    isActive = false
}: Props) => {
    const dispatch = useDispatch();
    const [pointed, setPointed] = useState(false);
    return (
        <div 
            className={styles.component}
            onMouseEnter={() => setPointed(true)}
            onMouseLeave={() => setPointed(false)}
            onClick={() => dispatch(activateToolAction(id))} >
            <div className={classnames(
                styles.textWrapper,
                isActive ? styles.active : "")}>
                <span className={classnames(
                    styles.titleText, 
                    isActive || pointed ? styles.activeTitle : "")}>
                    {name}
                </span>
            </div>
        </div>
    )
}