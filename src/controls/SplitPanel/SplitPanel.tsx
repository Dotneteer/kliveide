import { useResizeObserver } from "../../core/useResizeObserver";
import React, { useEffect, useRef, useState } from "react";
import styles from "./SplitPanel.module.scss";

type Location = "left" | "right" | "top" | "bottom";

/**
 * The properties of the SplitPanel
 */
type SplitPanelProps = {
    id?: string;
    primaryPanel?: JSX.Element;
    primaryLocation?: Location;
    primaryVisible?: boolean
    initialPrimarySize?: number | string;
    minSize?: number;
    secondaryPanel?: JSX.Element;
    secondaryVisible?: boolean;
    splitterThickness?: number;
}

/**
 * Renderer function of SplitPanel
 * @returns 
 */
export const SplitPanel = ({
    id,
    primaryPanel,
    primaryLocation = "left",
    primaryVisible = true,
    initialPrimarySize = "40%",
    minSize = 20,
    secondaryPanel,
    secondaryVisible = true,
    splitterThickness = 4
}: SplitPanelProps) => {
    // --- Referencies we need to handling the splitter within the panel
    const mainContainer = useRef<HTMLDivElement>(null);
    const primaryContainer = useRef<HTMLDivElement>(null);

    const [primarySize, setPrimarySize] = useState<string | number>(
        secondaryVisible ? resolveSize(initialPrimarySize) : "100%");
    const [lastPrimarySize, setLastPrimarySize] = useState<string | number>(primarySize);
    const [lastPrimaryVisible, setLastPrimaryVisible] = useState(primaryVisible);
    const [lastSecondaryVisible, setLastSecondaryVisible] = useState(secondaryVisible);
    const [splitterPosition, setSplitterPosition] = useState(0);
    const [anchorPosition, setAnchorPosition] = useState(0);
    const [splitterSize, setSplitterSize] = useState(0);
    const [splitterRange, setSplitterRange] = useState(0);

    // --- Calculate properties used for rendering the component
    const horizontal = isHorizontal(primaryLocation);
    const containerClass = styles[primaryLocation];
    const primaryClass = horizontal ? styles.vertical : styles.horizontal;
    const primaryDim = horizontal ? "width" : "height";
    const splitterVisible = !!primaryPanel 
        && !!primaryVisible 
        && !!secondaryPanel 
        && !!secondaryVisible;

    // --- Respond to panel visibility changes
    useEffect(() => {
        if ((!primaryVisible && lastPrimaryVisible) || (!secondaryVisible && lastSecondaryVisible)) {
            // --- We're hiding the primary panel, store its previous size
            setLastPrimarySize(primarySize);
        }

        if ((primaryVisible && !lastPrimaryVisible) || (secondaryVisible && !lastSecondaryVisible)) {
            // --- We're
            setPrimarySize(lastPrimarySize);
        }

        if (!primaryVisible) {
            setPrimarySize(0);
        } else if (!secondaryVisible) {
            setPrimarySize("100%");
        }

        setLastPrimaryVisible(primaryVisible);
        setLastSecondaryVisible(secondaryVisible);
    }, [primaryVisible, secondaryVisible])

    // --- Respond to container size changes
    useResizeObserver(mainContainer, () => {
        // --- Set the new primary size
        const newSplitterRange = horizontal
            ? mainContainer.current?.clientWidth ?? 0
            : mainContainer.current?.clientHeight ?? 0;
        
        // --- Set the new container size, we will use it as the splitter's size
        setSplitterSize(horizontal
            ? mainContainer.current?.clientHeight ?? 0
            : mainContainer.current?.clientWidth ?? 0);

        setSplitterRange(newSplitterRange);

        let newPrimarySize = 0;
        if (primaryVisible && secondaryVisible) {
            const currentSize = horizontal
                ? primaryContainer.current?.clientWidth ?? 0
                : primaryContainer.current?.clientHeight ?? 0;
            newPrimarySize = resize(currentSize, minSize, newSplitterRange - minSize);
            setPrimarySize(newPrimarySize);
        } else if (!primaryVisible) {
            setPrimarySize(0);
        } else if (!secondaryVisible) {
            setPrimarySize("100%");
        }

        // --- Set the new anchor position of the splitter
        const anchorValue = {
            left: mainContainer.current?.offsetLeft ?? 0,
            right: (mainContainer.current?.clientWidth ?? 0) + (mainContainer.current?.offsetLeft ?? 0),
            top: mainContainer.current?.offsetTop ?? 0,
            bottom: (mainContainer.current?.clientHeight ?? 0) + (mainContainer.current?.offsetTop ?? 0)
        }[primaryLocation];

        setAnchorPosition(anchorValue);

        // --- Set the new splitter position
        const splitterPosValue = {
            left: (mainContainer.current?.offsetLeft ?? 0) 
                + (primaryContainer.current?.clientWidth ?? 0),
            right: (primaryContainer.current?.clientWidth ?? 0) 
                + window.innerWidth 
                - (mainContainer.current?.offsetLeft ?? 0)
                - (mainContainer.current?.clientWidth ?? 0),
            top: (mainContainer.current?.offsetTop ?? 0) 
                + (primaryContainer.current?.clientHeight ?? 0),
            bottom: (primaryContainer.current?.clientHeight ?? 0) 
                + window.innerHeight
                - (mainContainer.current?.offsetTop ?? 0)
                - (mainContainer.current?.clientHeight ?? 0)
        }[primaryLocation] - splitterThickness/2;
        setSplitterPosition(splitterPosValue);
   });

    return (
        <div 
            className={[styles.component, containerClass].join(" ")}
            ref={mainContainer} >
            {primaryVisible && 
                <div 
                    className={primaryClass} style={{[primaryDim]: primarySize}}
                    ref={primaryContainer} >
                    {primaryPanel}
                </div>
            }
            {secondaryVisible && 
                <div className={styles.secondary}>{secondaryPanel}</div>
            }
            {splitterVisible && 
                <Splitter 
                    thickness={splitterThickness}
                    location={primaryLocation}
                    anchorPos={anchorPosition}
                    position={splitterPosition}
                    splitterSize={splitterSize}
                    minRange={minSize}
                    maxRange={splitterRange - minSize} 
                    onSplitterMoved={(newPos) => setPrimarySize(newPos) } />}
        </div>
    );

}

type SplitterProps = {
    thickness?: number,
    location: Location,
    anchorPos: number,
    position: number,
    splitterSize: number,
    minRange: number;
    maxRange: number;
    onSplitterMoved?: (newPos: number) =>void;
}

const Splitter = ({
    thickness = 8,
    location,
    position,
    anchorPos,
    splitterSize,
    minRange,
    maxRange,
    onSplitterMoved
}: SplitterProps) => {
    const horizontal = isHorizontal(location);
    
    // --- Functions used while moving
    const gripPosition = useRef(0);
    const _move = (e: MouseEvent) => move(e);
    const _endMove = () => endMove();
    
    // --- Handle resizing the component
    return (
        <div 
            className={styles.splitter}
            style={{
                [horizontal ? "width" : "height"]: `${thickness}px`, 
                [horizontal ? "height" : "width"]: `${splitterSize}px`,
                [location]: `${position}px`,
                cursor: horizontal ? "ew-resize": "ns-resize"
            }} 
            onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (e.button === 0) {
                  startMove(e);
                }
            }}
            onMouseUp={() => endMove()} />
    );

    // --- Sign the start of resizing
    function startMove(e: React.MouseEvent): void {
        // --- Store the current grip position
        gripPosition.current = horizontal ? e.clientX : e.clientY;

        // --- Capture mouse move via window events
        window.addEventListener("mouseup", _endMove);
        window.addEventListener("mousemove", _move);
        document.body.style.cursor = horizontal ? "ew-resize" : "ns-resize";
    }

    // --- Move the splitter and notify the splitter panel about size changes
    function move(e: MouseEvent): void {
        const delta = (horizontal ? e.clientX : e.clientY) - gripPosition.current;
        const moveDir = location === "left" || location === "top" ? 1 : -1;
        let newPrimarySize = moveDir * (gripPosition.current + delta - anchorPos);
        newPrimarySize = resize(newPrimarySize, minRange, maxRange);
        if (onSplitterMoved) {
            onSplitterMoved(newPrimarySize);
        }
    }

    // --- End moving the splitter
    function endMove(): void {
        // --- Release the captured mouse
        window.removeEventListener("mouseup", _endMove);
        window.removeEventListener("mousemove", _move);
        document.body.style.cursor = "default";
    }
}

/**
 * Determines if a particular position is horizontal
 */
function isHorizontal(pos: Location): boolean {
    return pos === "left" || pos === "right"
}

function resolveSize(size: string | number) {
    return typeof size === "string" ? size : `${size}px`;
}

function resize(newPrimarySize: number, minRange: number, maxRange: number): number {
    if (newPrimarySize < minRange) {
        newPrimarySize = minRange;
    }
    if (newPrimarySize > maxRange) {
        newPrimarySize = maxRange;
    }
    return newPrimarySize;
}
