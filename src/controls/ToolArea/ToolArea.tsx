import styles from "./ToolArea.module.scss";
import classnames from "@/utils/classnames";
import { useSelector } from "@/emu/StoreProvider";
import { ToolsHeader } from "./ToolsHeader";
import { ToolsContainer } from "./ToolsContainer";

type Props = {
    siblingPosition: string;
}

export const ToolArea = ({
    siblingPosition
}: Props) => {
    const tools = useSelector(s => s.ideView?.tools ?? []);
    const activeTool = useSelector(s => s.ideView.activeTool);
    const activeInstance = tools.find(t => t.id === activeTool);
    return <div className={classnames(styles.component, styles[siblingPosition])}>
        <ToolsHeader topPosition={siblingPosition !== "top" } />
        <ToolsContainer tool={activeInstance}/>
    </div>
}