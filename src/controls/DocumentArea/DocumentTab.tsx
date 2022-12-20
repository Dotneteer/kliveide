import styles from "./DocumentTab.module.scss";
import { DocumentState } from "@/ide/abstractions";
import { Icon } from "../common/Icon";
import classnames from "@/utils/classnames";
import { useDispatch } from "@/emu/StoreProvider";
import { activateDocumentAction, closeDocumentAction, selectActivityAction } from "@state/actions";
import { TabButton } from "../common/TabButton";
import { useState } from "react";

export type Props = DocumentState & {
    iconName?: string;
    isActive?: boolean;
}
export const DocumentTab = ({
    id,
    name,
    type,
    isTemporary,
    isReadOnly = false,
    path,
    language,
    iconName = "file-code",
    isActive = false
}: Props) => {
    const dispatch = useDispatch();
    const [pointed, setPointed] = useState(false);
    return (
        <div 
            className={classnames(styles.component, isActive ? styles.active : "")}
            onMouseEnter={() => setPointed(true)}
            onMouseLeave={() => setPointed(false)}
            onClick={() => dispatch(activateDocumentAction(id))}>
            <Icon
                iconName={iconName}
                width={16}
                height={16}
                fill="--color-doc-icon" />
            <span className={classnames(
                styles.titleText, 
                isActive ? styles.activeTitle : "",
                isTemporary ? styles.temporaryTitle : "")}>
                {name}
            </span>
            {isReadOnly &&
                <div className={styles.readOnlyIcon}>
                <Icon
                    iconName="shield"
                    width={16}
                    height={16}
                    fill={isActive ? "--color-readonly-icon-active" : "--color-readonly-icon-inactive"} />
                </div>
            }
            <TabButton 
                iconName="close" 
                active={isActive} 
                hide={!pointed && !isActive} 
                clicked={() => dispatch(closeDocumentAction(id))}/>
        </div>
    )
}