import styles from "./ToolArea.module.scss";
import classnames from "@/renderer/utils/classnames";
import { useSelector } from "@/renderer/core/RendererProvider";
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

    return <div className={classnames(styles.toolArea, styles[siblingPosition])}>
        <ToolsHeader 
            topPosition={siblingPosition !== "bottom" } 
            tool={activeInstance} />
        <div className={styles.wrapper}>
            <ToolsContainer tool={activeInstance}/>
        </div>
    </div>
}