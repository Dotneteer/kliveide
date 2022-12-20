import styles from "./SideBarPanel.module.scss";
import { useEffect, useRef, useState } from "react";
import { SideBarPanelInfo } from "@/core/abstractions";
import { useDispatch } from "@/emu/StoreProvider";
import { setSideBarPanelExpandedAction } from "@state/actions";
import { Icon } from "../common/Icon";
import classnames from "@/utils/classnames";

// --- Size of a single expanded module
const FULL_EXPANDED_SIZE = 100000;

type Props = {
    sideBar: SideBarPanelInfo;
    index: number;
    expanded?: boolean;
    sizeable?: boolean;
    suggestedSize?: number;
    headingSized?: (size: number) => void;
    startSizing?: (pos: number, size: number) => void;
    sizing?: (pos: number) => void;
    endSizing?: () => void;
}

export const SideBarPanel = ({
    sideBar,
    index,
    expanded = false,
    sizeable = false,
    suggestedSize = FULL_EXPANDED_SIZE,
    headingSized,
    startSizing,
    sizing,
    endSizing,
}: Props) => {
    const dispatch = useDispatch();
    const [focused, setFocused] = useState(false);

    // --- We need to measure the size of the entire panel
    const panelRef = useRef<HTMLDivElement>(null);

    // --- We need to measure the size of the header
    const headerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        headingSized?.(headerRef.current.clientHeight);
    }, [headerRef.current])

    // --- Functions used while moving
    const _move = (e: MouseEvent) => move(e);
    const _endMove = () => endMove();
    
    const newHeight = {height: `${suggestedSize}px`}
    return (
    <div
        ref={panelRef}
        className={classnames(
        styles.component,
        expanded ? styles.expanded : styles.collapsed)}
        style={expanded ? newHeight : {}}>
        <div
            ref={headerRef}
            tabIndex={index}
            className={classnames(
                styles.header, 
                index ? styles.notFirst : "",
                focused ? styles.focused : "")} 
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
                if (e.code === "Space" || e.code === "Enter") {
                    dispatch(setSideBarPanelExpandedAction(sideBar.id, !expanded))
                }
            }}
            onClick={() => {
                dispatch(setSideBarPanelExpandedAction(sideBar.id, !expanded));
                }}>
            <Icon
                iconName="chevron-right"
                width={16}
                height={16}
                fill="--color-chevron"
                rotate={expanded ? 90 : 0}/>
            <span className={styles.headerText}>{sideBar.title}</span>
        </div>
        {expanded && 
            <div className={styles.contentWrapper}>
                <div className={styles.contentHolder}>
                    {sideBar.renderer(undefined)}
                </div>
                <div
                    className={classnames(
                        styles.sizingGrip, 
                        sizeable ? styles.sizeable : "")} 
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (e.button === 0) {
                            startMove(e);
                        }
                    }}
                    onMouseUp={() => endMove()} />
           </div>
        }
    </div>);

    // --- Sign the start of resizing
    function startMove(e: React.MouseEvent): void {
        // --- Capture mouse move via window events
        window.addEventListener("mouseup", _endMove);
        window.addEventListener("mousemove", _move);
        document.body.style.cursor = "ns-resize";
        startSizing?.(e.clientY, panelRef.current.offsetHeight);
    }

    // --- Move the splitter and notify the panel about size changes
    function move(e: MouseEvent): void {
        sizing?.(e.clientY);
    }

    // --- End moving the splitter
    function endMove(): void {
        // --- Release the captured mouse
        window.removeEventListener("mouseup", _endMove);
        window.removeEventListener("mousemove", _move);
        document.body.style.cursor = "default";
        endSizing?.();
    }
}