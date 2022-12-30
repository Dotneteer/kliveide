import { useDispatch, useSelector, useStore } from "@/emu/StoreProvider";
import { ToolState } from "@/ide/abstractions";
import { useIdeServices } from "@/ide/IdeServicesProvider";
import { activateOutputPaneAction, changeToolStateAction } from "@state/actions";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { Dropdown } from "../common/Dropdown";
import { VirtualizedList, VirtualizedListApi } from "../common/VirtualizedList";
import { IOutputBuffer, OutputContentLine, OutputSpan } from "./abstractions";
import styles from "./OutputPanel.module.scss";

const OutputPanel = () => {
    const { outputPaneService } = useIdeServices();
    const store = useStore();
    const tool = useRef<ToolState>();
    const dispatch = useDispatch();
    const activePane = useSelector(s => s.ideView?.activeOutputPane);
    const paneRef = useRef(activePane);
    const buffer = useRef<IOutputBuffer>();
    const [contents, setContents] = useState<OutputContentLine[]>();
    const [version, setVersion] = useState(0);
    const api = useRef<VirtualizedListApi>();

    // --- Respond to api and scroll position changes
    useEffect(() => {
        paneRef.current = activePane
        tool.current = store.getState().ideView?.tools.find(t => t.id === "output") as ToolState;
        if (api.current) {
            api.current.refresh();
            api.current.scrollToOffset(tool.current?.stateValue?.[paneRef.current] ?? 0);
        }
        buffer.current = outputPaneService.getOutputPaneBuffer(paneRef.current);
        setContents((buffer?.current?.getContents() ?? []).slice(0));
        setVersion(version + 1);
    }, [activePane])

    useEffect(() => {
        const handleChanged = () => {
            setContents((buffer?.current?.getContents() ?? []).slice(0));
            setVersion(version + 1);
        }

        if (buffer.current) {
            buffer.current.contentsChanged.on(handleChanged)
        }

        return () => buffer.current?.contentsChanged?.off(handleChanged);

    }, [buffer.current])

    useEffect(() => {
        if (api.current) {
            api.current.scrollToEnd();
        }
    }, [version])
    return (
        <div className={styles.component}>
            {activePane && <VirtualizedList
                items={contents ?? []} 
                approxSize={20}
                apiLoaded={vlApi => api.current = vlApi}
                scrolled={offs => {
                    if (!tool.current) return;
                    const newState = {
                        ...tool.current, 
                        stateValue: {...tool.current?.stateValue, [paneRef.current]: offs }
                    };
                    dispatch(changeToolStateAction(newState));
                }}
                itemRenderer={(idx) => {
                    return <OutputLine spans={contents?.[idx]?.spans}/>
            }}/>
            }
        </div>   
    )
}

type LineProps = {
    spans: OutputSpan[];
}

const OutputLine = ({
    spans
}: LineProps) => {
    const segments = (spans ?? []).map((s, idx) => {
        const style: CSSProperties ={
            fontWeight: s.isBold ? 600 : 400,
            fontStyle: s.isItalic ? "italic" : "normal",
            backgroundColor: `var(${s.background !== undefined ? `--console-ansi-${s.background}` : "transparent"})`,
            color: `var(${s.foreGround !== undefined ? `--console-ansi-${s.foreGround}` : "--console-default"})`,
            textDecoration: `${s.isUnderline ? "underline" : ""} ${s.isStrikeThru ? "line-through" : ""}`,
            cursor: s.actionable ? "pointer" : undefined
        };
        return (
            <span key={idx} style={style}>{s.text}</span>
        )
    });
    return <>{[...segments]}</> 
}

export const outputPanelRenderer = () => <OutputPanel />

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