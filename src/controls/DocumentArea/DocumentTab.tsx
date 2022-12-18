import styles from "./DocumentTab.module.scss";
import { DocumentState } from "@/ide/abstractions";
import { Icon } from "../common/Icon";
import classnames from "@/utils/classnames";

export type Props = DocumentState & {
    iconName?: string;
    isActive?: boolean;
}
export const DocumentTab = ({
    id,
    name,
    type,
    isTemporary,
    path,
    language,
    iconName = "file-code",
    isActive = false
}: Props) => {
    return (
        <div className={classnames(styles.component, isActive ? styles.active : "")}>
            <Icon
                iconName={iconName}
                width={16}
                height={16}
                fill="--color-doc-icon" />
            <span>{name}</span>
        </div>
    )
}