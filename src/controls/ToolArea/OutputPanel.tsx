import { useDispatch, useSelector } from "@/emu/StoreProvider";
import { ToolState } from "@/ide/abstractions";
import { useIdeServices } from "@/ide/IdeServicesProvider";
import { activateOutputPaneAction, changeToolStateAction } from "@state/actions";
import { useEffect, useRef } from "react";
import { Dropdown } from "../common/Dropdown";
import { VirtualizedList, VirtualizedListApi } from "../common/VirtualizedList";
import { OutputSpan } from "./abstractions";
import styles from "./OutputPanel.module.scss";

type Props = {
    tool: ToolState;
}

const OutputPanel = ({
    tool,
}: Props) => {
    const { outputPaneService } = useIdeServices();
    const dispatch = useDispatch();
    const activePane = useSelector(s => s.ideView?.activeOutputPane);
    const paneRef = useRef(activePane);
    const buffer = outputPaneService.getOutputPaneBuffer(activePane);
    if (buffer && buffer.getContents().length === 0) {
        for (let i = 0; i < 100; i++) {
            buffer.writeLine(`${activePane} Item #${i}`);
        }
    }
    const api = useRef<VirtualizedListApi>();

    const contents = buffer.getContents();

    useEffect(() => {
        if (api.current) {
            api.current.scrollToOffset(tool.stateValue?.[activePane] ?? 0);
        }
    }, [api.current, activePane])

    useEffect(() => {
        paneRef.current = activePane
    }, [activePane])

    return (
        <div className={styles.component}>
            <VirtualizedList 
                items={contents} 
                approxSize={20}
                apiLoaded={vlApi => api.current = vlApi}
                scrolled={offs => {
                    dispatch(changeToolStateAction({
                        ...tool, 
                        stateValue: {...tool.stateValue, [paneRef.current]: offs }
                    }));
                }}
                itemRenderer={(idx) => {
                    return <OutputLine spans={contents[idx].spans}/>
            }}/>
        </div>   
    )
}

type LineProps = {
    spans: OutputSpan[];
}

const OutputLine = ({
    spans
}: LineProps) => {
    return <>{[...spans.map(s => s.text)]}</> 
}

export const outputPanelRenderer = (node: ToolState) => <OutputPanel tool={node} />

export const outputPanelHeaderRenderer = () => {
    const dispatch = useDispatch();
    const { outputPaneService } = useIdeServices();
    const panes = outputPaneService.getRegisteredOutputPanes().map(p => (
        {
            value: p.id,
            label: p.displayName
        }
    ));
    const activePane = useSelector(s => s.ideView?.activeOutputPane);
        return (
            <Dropdown 
                placeholder="Select..." 
                options={panes} 
                value={activePane}
                onSelectionChanged={ (option) => dispatch(activateOutputPaneAction(option))}/> 
        )
    }