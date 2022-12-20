import styles from "./ToolArea.module.scss";
import classnames from "@/utils/classnames";

type Props = {
    siblingPosition: string;
}

export const ToolArea = ({
    siblingPosition
}: Props) => {
    return <div className={classnames(styles.component, styles[siblingPosition])}>
        ToolArea
    </div>
}