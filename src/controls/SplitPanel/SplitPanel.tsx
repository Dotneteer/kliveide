import { useResizeObserver } from "../../hooks/useResizeObserver";
import { useRef, useState } from "react";
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
    splitterSize?: number;
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
    splitterSize = 6
}: SplitPanelProps) => {
    // --- Referencies we need to handling the splitter within the panel
    const mainContainer = useRef<HTMLDivElement>(null);
    const primaryContainer = useRef<HTMLDivElement>(null);

    const [position, setPosition] = useState(0);
    const [containerSize, setContainerSize] = useState(0);

    // --- Calculate properties used for rendering the component
    const containerClass = styles[primaryLocation];
    const primaryClass = isHorizontal(primaryLocation) ? styles.vertical : styles.horizontal;
    const primaryDim = isHorizontal(primaryLocation) ? "width" : "height";
    const primarySize = secondaryVisible ? resolveSize(initialPrimarySize) : "100%";
    const splitterVisible = !!primaryPanel 
        && !!primaryVisible 
        && !!secondaryPanel 
        && !!secondaryVisible;

    // --- Respond to container size changes
    useResizeObserver(mainContainer, () => {
        // --- Set the new container size, we will use it as the splitter's size
        setContainerSize(isHorizontal(primaryLocation)
            ? mainContainer.current?.clientHeight ?? 0
            : mainContainer.current?.clientWidth ?? 0);

        // --- Set the new splitter position
        setPosition(isHorizontal(primaryLocation)
            ? (mainContainer.current.offsetLeft ?? 0) 
                + (primaryContainer.current?.clientWidth ?? 0) - splitterSize/2
            : (mainContainer.current.offsetTop ?? 0) 
                + (primaryContainer.current?.clientHeight ?? 0) - splitterSize/2);
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
                    size={splitterSize}
                    location={primaryLocation}
                    position={position}
                    containerSize={containerSize}
                    minSize={minPrimarySize}
                    minRemaining={minSecondarySize} />}
        </div>
    );

}

type SplitterProps = {
    size?: number,
    location: Location,
    position: number,
    containerSize: number,
    minSize: number;
    minRemaining: number; 
}

const Splitter = ({
    size = 8,
    location,
    position,
    containerSize,
    minSize,
    minRemaining
}: SplitterProps) => {

    const sizeDim = isHorizontal(location) ? "width" : "height";
    const containerDim = isHorizontal(location) ? "height" : "width";

    return (
        <div 
            className={[styles.splitter].join(" ")}
            style={{
                [sizeDim]: `${size}px`, 
                [containerDim]: `${containerSize}px`,
                [location]: `${position}px`
            }} />
    );
}

function isHorizontal(pos: Location): boolean {
    return pos === "left" || pos === "right"
}

function resolveSize(size: string | number) {
    return typeof size === "string" ? size : `${size}px`;
}
