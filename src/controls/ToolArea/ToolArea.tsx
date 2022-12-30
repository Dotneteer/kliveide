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
    const dispatch = useDispatch();
    const tools = useSelector(s => s.ideView?.tools ?? []);
    const activeTool = useSelector(s => s.ideView.activeTool);
    const lastInstance = useRef<ToolState>()
    const activeInstance = tools.find(t => t.id === activeTool);

    // --- Manage changes between panels
    useEffect(() => {
        if (lastInstance.current) {
            // --- Save the state of the last instance
            dispatch(changeToolStateAction({
                ...lastInstance.current
            } as ToolState));
        }
        lastInstance.current = activeInstance;
    },[activeTool])

    return <div className={classnames(styles.component, styles[siblingPosition])}>
        <ToolsHeader 
            topPosition={siblingPosition !== "top" } 
            tool={activeInstance} />
        <ToolsContainer tool={activeInstance}/>
    </div>
}