import styles from "./ToolArea.module.scss";
import classnames from "@/utils/classnames";
import { useSelector } from "@/emu/StoreProvider";
import { ToolsHeader } from "./ToolsHeader";

type Props = {
    siblingPosition: string;
}

export const ToolArea = ({
    siblingPosition
}: Props) => {
    const tools = useSelector(s => s.ideView?.tools ?? []);
    return <div className={classnames(styles.component, styles[siblingPosition])}>
        <ToolsHeader />
    </div>
}