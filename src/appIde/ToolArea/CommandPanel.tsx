import { useAppServices } from "@/appIde/services/AppServicesProvider";
import { useEffect, useRef, useState } from "react";
import { VirtualizedList, VirtualizedListApi } from "../../controls/common/VirtualizedList";
import { IOutputBuffer, OutputContentLine } from "./abstractions";
import styles from "./CommandPanel.module.scss";
import { OutputLine } from "./OutputPanel";

const CommandPanel = () => {
    const { interactiveCommandsService } = useAppServices();
    const buffer = useRef<IOutputBuffer>(interactiveCommandsService.getBuffer());
    const [contents, setContents] = useState<OutputContentLine[]>(buffer.current.getContents());
    const api = useRef<VirtualizedListApi>();

    useEffect(() => {
        const handleChanged = () => {
            setContents((buffer?.current?.getContents() ?? []).slice(0));
        }

        if (buffer.current) {
            buffer.current.contentsChanged.on(handleChanged)
        }

        return () => buffer.current?.contentsChanged?.off(handleChanged);

    }, [buffer.current])

    useEffect(() => {
        if (api.current) {
            setTimeout(() => {
                api.current.scrollToEnd();
            })
        }
    }, [contents])
    

    return (
        <div className={styles.component}>
            <div className={styles.outputWrapper}>
                <VirtualizedList
                    items={contents ?? []} 
                    approxSize={20}
                    fixItemHeight={false}
                    apiLoaded={vlApi => api.current = vlApi}
                    itemRenderer={(idx) => {
                        return <OutputLine spans={contents?.[idx]?.spans}/>
                }}/>
            </div> 
            <div className={styles.promptWrapper}>
                <span className={styles.promptPrefix}>$</span>
                <input 
                    className={styles.prompt}
                    placeholder="Type something"
                    spellCheck={false}
                    onKeyDown={e => {
                        const input = e.target as HTMLInputElement;
                        if (e.code === "Enter") {
                            buffer.current.writeLine(input.value);
                            input.value = "";
                            setContents(buffer.current.getContents().slice(0));
                        }
                    }}
                    />
            </div>
        </div>
    )
}

export const commandPanelRenderer = () => <CommandPanel />