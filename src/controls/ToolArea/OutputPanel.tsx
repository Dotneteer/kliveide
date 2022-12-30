import { AppContext } from "@/core/abstractions"
import { ToolState } from "@/ide/abstractions";
import { useEffect, useRef, useState } from "react";
import { Dropdown } from "../common/Dropdown";
import { VirtualizedList, VirtualizedListApi } from "../common/VirtualizedList";
import { OutputSpan } from "./abstractions";
import { OutputPaneBuffer } from "./OutputPaneBuffer";
import styles from "./OutputPanel.module.scss";

type Props = {
    tool: ToolState;
}

const OutputPanel = ({
    tool,
}: Props) => {
    const api = useRef<VirtualizedListApi>();
    const buffer = new OutputPaneBuffer();
    for (let i = 0; i < 100; i++) {
        buffer.writeLine(`Item #${i}`);
    }
    const contents = buffer.getContents();

    useEffect(() => {
        if (api.current) {
            api.current.scrollToOffset(tool.stateValue);
        }
    }, [api.current])
    return (
        <div className={styles.component}>
            <VirtualizedList 
                items={contents} 
                approxSize={20}
                apiLoaded={vlApi => api.current = vlApi}
                scrolled={offs => tool.stateValue = offs}
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

const OutputPanelHeader = () => {
    return <span>Header</span>
}

export const outputPanelRenderer = (
    id: string, 
    node: ToolState, 
    context: AppContext) => <OutputPanel tool={node} />

export const outputPanelHeaderRenderer = (
    id: string, 
    node: ToolState, 
    context: AppContext) => {
        const options = [
            {
                label: "Option #1",
                value: "1"
            },
            {
                label: "Option #2",
                value: "2"
            },
            {
                label: "Option #3",
                value: "3"
            },
            {
                label: "Option #4",
                value: "4"
            },
        ]
        return <Dropdown placeholder="Select..." options={options} selected={ (option) => console.log(option)}/> 
    }