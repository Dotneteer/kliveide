import { ToolInfo } from "@/ide/abstractions";
import styles from "./ToolsContainer.module.scss";

type Props = {
    tool?: ToolInfo
}

export const ToolsContainer = ({
    tool
}: Props) => {
    return tool
        ? <div className={styles.component}>
            {tool.name}
        </div>
        : null;
}