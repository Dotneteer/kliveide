import { ReactNode, useEffect, useRef, useState } from "react";
import styles from "./VirtualizedList.module.scss";
import { useVirtualizer } from '@tanstack/react-virtual'

type ScrollAlignment = "start" | "center" | "end" | "auto";
type ScrollBehavior = "auto" | "smooth";
type ScrollToOptions = {
    align?: ScrollAlignment;
    behavior?: ScrollBehavior;
}

export type VirtualizedListApi = {
    scrollToIndex: (index: number, options?: ScrollToOptions) => void;
    scrollToOffset: (offset: number, options?: ScrollToOptions) => void;
    scrollToTop: () => void;
    scrollToEnd: () => void;
    refresh: () => void;
}

type Props = {
    items: any[];
    approxSize?: number;
    itemRenderer: (index: number) => ReactNode;
    apiLoaded?: (api: VirtualizedListApi) => void;
    scrolled?: (offset: number) => void;
}

export const VirtualizedList = ({
    items,
    approxSize,
    itemRenderer,
    apiLoaded,
    scrolled
}: Props) => {
    const parentRef = useRef<HTMLDivElement>(null);
    
    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => approxSize ?? 20,
        overscan: 20,
    });
    
    const [count, setCount] = useState(0);

    useEffect(() => {
        // --- Provide an API for the virtualizer
        const scrollHandler = () => scrolled?.(virtualizer?.scrollOffset);

        if (virtualizer) {
            const api: VirtualizedListApi = {
                scrollToIndex: (index: number, options: ScrollToOptions) => 
                    virtualizer.scrollToIndex(index, options),
                scrollToOffset: (offset: number, options: ScrollOptions) =>
                    virtualizer.scrollToOffset(offset, options),
                scrollToTop: () => virtualizer.scrollToIndex(0),
                scrollToEnd: () => {
                    if (virtualizer.getVirtualItems().length > 0) {
                        virtualizer.scrollToIndex(virtualizer.getVirtualItems()?.length ?? 0)
                    }
                },
                refresh: () => setCount(count + 1)
            };
            apiLoaded?.(api);
            virtualizer.scrollElement.addEventListener("scroll", scrollHandler)
        }

        return () => virtualizer?.scrollElement?.removeEventListener("scroll", scrollHandler)
    }, [virtualizer])

    return (
        <div 
            ref={parentRef}
            className={styles.component}
            style={{ overflowY: "auto" }} >
            <div
                style={{
                height: virtualizer.getTotalSize(),
                width: "100%",
                position: "relative",
            }} >
                {virtualizer.getVirtualItems().map((virtualRow) => (
                    <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        className={virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${virtualRow.start}px)`,
                        }} >
                        {itemRenderer(virtualRow.index)}
                    </div>
                ))}
            </div>
        </div>   
    )
}
