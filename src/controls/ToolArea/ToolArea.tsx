import styles from "./ToolArea.module.scss";
import classnames from "@/utils/classnames";
import { useDispatch, useSelector, useStore } from "@/emu/StoreProvider";
import { ToolsHeader } from "./ToolsHeader";
import { ToolsContainer } from "./ToolsContainer";
import { ToolState } from "@/ide/abstractions";
import { useEffect, useRef } from "react";
import { changeToolStateAction } from "@state/actions";

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
        <ToolsHeader 
            topPosition={siblingPosition !== "top" } 
            tool={activeInstance} />
        <div className={styles.wrapper}>
            <ToolsContainer tool={activeInstance}/>
        </div>
    </div>
}