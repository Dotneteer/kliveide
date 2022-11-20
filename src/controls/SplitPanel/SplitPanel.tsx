import { useResizeObserver } from "../../hooks/useResizeObserver";
import React, { useRef, useState } from "react";
import styles from "./SplitPanel.module.scss";

type Location = "left" | "right" | "top" | "bottom";

/**
 * The properties of the SplitPanel
 */
type SplitPanelProps = {
    primaryPanel?: JSX.Element;
    primaryLocation?: Location;
    primaryVisible?: boolean
    initialPrimarySize?: number | string;
    minPrimarySize?: number;
    secondaryPanel?: JSX.Element;
    secondaryVisible?: boolean;
    minSecondarySize?: number;
    splitterThickness?: number;
}

/**
 * Renderer function of SplitPanel
 * @returns 
 */
export const SplitPanel = ({
    primaryPanel,
    primaryLocation = "left",
    primaryVisible = true,
    initialPrimarySize = "40%",
    minPrimarySize = 20,
    secondaryPanel,
    secondaryVisible = true,
    minSecondarySize = 20,
    splitterThickness = 6
}: SplitPanelProps) => {
    // --- Referencies we need to handling the splitter within the panel
    const mainContainer = useRef<HTMLDivElement>(null);
    const primaryContainer = useRef<HTMLDivElement>(null);

    const [primarySize, setPrimarySize] = useState<string | number>(
        secondaryVisible ? resolveSize(initialPrimarySize) : "100%");
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

    // --- Respond to container size changes
    useResizeObserver(mainContainer, () => {
        // --- Set the new container size, we will use it as the splitter's size
        setSplitterSize(horizontal
            ? mainContainer.current?.clientHeight ?? 0
            : mainContainer.current?.clientWidth ?? 0);

        setSplitterRange(horizontal
            ? mainContainer.current?.clientWidth ?? 0
            : mainContainer.current?.clientHeight ?? 0);

        // --- Set the new anchor position of the splitter
        setAnchorPosition({
            left: mainContainer.current.offsetLeft ?? 0,
            right: (mainContainer.current.offsetLeft ?? 0) + (mainContainer.current.offsetWidth ?? 0),
            top: mainContainer.current.offsetTop ?? 0,
            bottom: (mainContainer.current.offsetTop ?? 0) + (mainContainer.current.offsetHeight ?? 0)
        }[primaryLocation])

        // --- Set the new splitter position
        setSplitterPosition(horizontal
            ? (mainContainer.current.offsetLeft ?? 0) 
                + (primaryContainer.current?.clientWidth ?? 0) - splitterThickness/2
            : (mainContainer.current.offsetTop ?? 0) 
                + (primaryContainer.current?.clientHeight ?? 0) - splitterThickness/2);
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
                    minRange={minPrimarySize}
                    maxRange={splitterRange - minSecondarySize} 
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
        if (newPrimarySize < minRange) {
            newPrimarySize = minRange;
        }
        if (newPrimarySize > maxRange) {
            newPrimarySize = maxRange;
        }
        if (onSplitterMoved) {
            onSplitterMoved(newPrimarySize);
        }
        console.log(newPrimarySize);
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
