import styles from "./SplitPanel.module.scss";

import { useResizeObserver } from "../core/useResizeObserver";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import classnames from "classnames";

type Location = "left" | "right" | "top" | "bottom";

/**
 * The properties of the SplitPanel
 */
type Props = {
  children: React.ReactNode;
  primaryLocation?: Location;
  primaryVisible?: boolean;
  initialPrimarySize?: number | string;
  initialSecondarySize?: number | string;
  minSize?: number;
  secondaryVisible?: boolean;
  splitterThickness?: number;
  onUpdatePrimarySize?: (newSize: string) => void;
  onPrimarySizeUpdateCompleted?: (newSize: string) => void;
};

/**
 * Renderer function of SplitPanel
 * @returns
 */
export const SplitPanel = ({
  children,
  primaryLocation = "left",
  primaryVisible = true,
  initialPrimarySize,
  initialSecondarySize,
  minSize = 20,
  secondaryVisible = true,
  splitterThickness = 4,
  onUpdatePrimarySize,
  onPrimarySizeUpdateCompleted
}: Props) => {
  // --- Referencies we need to handling the splitter within the panel
  const mainContainer = useRef<HTMLDivElement>(null);
  const primaryContainer = useRef<HTMLDivElement>(null);

  // --- Get the panels
  const primaryPanel = children?.[0];
  const secondaryPanel = children?.[1];

  const [primarySize, setPrimarySize] = useState<string | number>(
    secondaryVisible ? resolveSize(initialPrimarySize) : "100%"
  );
  const [lastPrimarySize, setLastPrimarySize] = useState<string | number>(primarySize);
  const [lastPrimaryVisible, setLastPrimaryVisible] = useState(primaryVisible);
  const [lastSecondaryVisible, setLastSecondaryVisible] = useState(secondaryVisible);
  const [splitterPosition, setSplitterPosition] = useState(0);
  const [anchorPosition, setAnchorPosition] = useState(0);
  const [splitterSize, setSplitterSize] = useState(0);
  const [splitterRange, setSplitterRange] = useState(0);
  const initialLayout = useRef(true);

  // --- Calculate properties used for rendering the component
  const horizontal = isHorizontal(primaryLocation);
  const containerClass = styles[primaryLocation];
  const primaryClass = horizontal ? styles.vertical : styles.horizontal;
  const primaryDim = horizontal ? "width" : "height";
  const splitterVisible =
    !!primaryPanel && !!primaryVisible && !!secondaryPanel && !!secondaryVisible;

  useEffect(() => {
    setPrimarySize(secondaryVisible ? resolveSize(initialPrimarySize) : "100%");
  }, [initialPrimarySize, secondaryVisible]);

  // --- Respond to panel visibility changes
  useLayoutEffect(() => {
    if (initialLayout.current) {
      // --- Calculate the last primary size
      const containerSize = horizontal
        ? mainContainer.current.clientWidth
        : mainContainer.current.clientHeight;

      let mainSize = containerSize;
      if (initialPrimarySize !== undefined) {
        mainSize = calculateDim(containerSize, initialPrimarySize);
      } else if (initialSecondarySize) {
        mainSize = containerSize - calculateDim(containerSize, initialSecondarySize);
      }
      setLastPrimarySize(mainSize);
      initialLayout.current = false;
    }
    if ((!primaryVisible && lastPrimaryVisible) || (!secondaryVisible && lastSecondaryVisible)) {
      // --- We're hiding the primary panel, store its previous size
      setLastPrimarySize(primarySize);
    }

    if ((primaryVisible && !lastPrimaryVisible) || (secondaryVisible && !lastSecondaryVisible)) {
      // --- We're displaying the primary panel, restore its size
      setPrimarySize(lastPrimarySize);
    }

    if (!primaryVisible) {
      setPrimarySize(0);
    } else if (!secondaryVisible) {
      setPrimarySize("100%");
    }

    setLastPrimaryVisible(primaryVisible);
    setLastSecondaryVisible(secondaryVisible);
  }, [primaryVisible, secondaryVisible]);

  // --- Respond to container size changes
  useResizeObserver(mainContainer, () => {
    // --- Set the new primary size
    const newSplitterRange = horizontal
      ? mainContainer.current?.clientWidth ?? 0
      : mainContainer.current?.clientHeight ?? 0;

    // --- Set the new container size, we will use it as the splitter's size
    setSplitterSize(
      horizontal
        ? mainContainer.current?.clientHeight ?? 0
        : mainContainer.current?.clientWidth ?? 0
    );

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
    const splitterPosValue =
      {
        left:
          (mainContainer.current?.offsetLeft ?? 0) + (primaryContainer.current?.clientWidth ?? 0),
        right:
          (primaryContainer.current?.clientWidth ?? 0) +
          window.innerWidth -
          (mainContainer.current?.offsetLeft ?? 0) -
          (mainContainer.current?.clientWidth ?? 0),
        top:
          (mainContainer.current?.offsetTop ?? 0) + (primaryContainer.current?.clientHeight ?? 0),
        bottom:
          (primaryContainer.current?.clientHeight ?? 0) +
          window.innerHeight -
          (mainContainer.current?.offsetTop ?? 0) -
          (mainContainer.current?.clientHeight ?? 0)
      }[primaryLocation] -
      splitterThickness / 2;
    setSplitterPosition(splitterPosValue);
  });

  // --- Save the primary size
  useEffect(() => {
    onUpdatePrimarySize?.(typeof primarySize === "number" ? `${primarySize}px` : primarySize);
  }, [primarySize]);

  return (
    <div className={[styles.splitPanel, containerClass].join(" ")} ref={mainContainer}>
      {primaryVisible && (
        <div className={primaryClass} style={{ [primaryDim]: primarySize }} ref={primaryContainer}>
          {primaryPanel}
        </div>
      )}
      {secondaryVisible && <div className={styles.secondary}>{secondaryPanel}</div>}
      {splitterVisible && (
        <Splitter
          thickness={splitterThickness}
          location={primaryLocation}
          anchorPos={anchorPosition}
          position={splitterPosition}
          splitterSize={splitterSize}
          minRange={minSize}
          maxRange={splitterRange - minSize}
          onSplitterMoved={(newPos) => {
            setPrimarySize(newPos);
          }}
          onMoveCompleted={(newPos) => {
            onPrimarySizeUpdateCompleted?.(`${newPos}px`);
          }}
        />
      )}
    </div>
  );
};

type SplitterProps = {
  thickness?: number;
  location: Location;
  anchorPos: number;
  position: number;
  splitterSize: number;
  minRange: number;
  maxRange: number;
  onSplitterMoved?: (newPos: number) => void;
  onMoveCompleted?: (newPos: number) => void;
};

const Splitter = ({
  thickness = 8,
  location,
  position,
  anchorPos,
  splitterSize,
  minRange,
  maxRange,
  onSplitterMoved,
  onMoveCompleted
}: SplitterProps) => {
  const { uiService } = useAppServices();
  const horizontal = isHorizontal(location);
  const [isMoving, setIsMoving] = useState(false);
  const [pointed, setPointed] = useState(false);
  const gripPosition = useRef(0);
  const lastPrimarySize = useRef(0);

  const startMove = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsMoving(true);
    gripPosition.current = horizontal ? e.clientX : e.clientY;
    document.body.style.cursor = horizontal ? "col-resize" : "row-resize";
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", endMove);
  };

  const move = (e: MouseEvent) => {
    const delta = (horizontal ? e.clientX : e.clientY) - gripPosition.current;
    const moveDir = location === "left" || location === "top" ? 1 : -1;
    let newPrimarySize = moveDir * (gripPosition.current + delta - anchorPos);
    newPrimarySize = resize(newPrimarySize, minRange, maxRange);
    onSplitterMoved?.(newPrimarySize);
    lastPrimarySize.current = newPrimarySize;
  };

  const endMove = () => {
    setIsMoving(false);
    document.body.style.cursor = "default";
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", endMove);
    onMoveCompleted?.(lastPrimarySize.current);
  };

  return (
    <div
      className={classnames(styles.splitter, {
        [styles.pointed]: (pointed || isMoving) && !uiService.dragging
      })}
      style={{
        [horizontal ? "width" : "height"]: `${thickness}px`,
        [horizontal ? "height" : "width"]: `${splitterSize}px`,
        [location]: `${position}px`,
        cursor: !uiService.dragging ? (horizontal ? "col-resize" : "row-resize") : "inherit"
      }}
      onMouseDown={startMove}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
    />
  );
};
/**
 * Determines if a particular position is horizontal
 */
function isHorizontal(pos: Location): boolean {
  return pos === "left" || pos === "right";
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

function calculateDim(containerDim: number, dim: string | number): number {
  if (typeof dim === "number") return dim;
  dim = dim.trim();
  if (dim.endsWith("%")) {
    // --- Calculate percentage
    const percentage = parseInt(dim.substring(0, dim.length - 1));
    return isNaN(percentage) ? containerDim : (containerDim * percentage) / 100;
  } else if (dim.endsWith("px")) {
    // --- Extract pixels
    const extracted = parseInt(dim.substring(0, dim.length - 2));
    return isNaN(extracted) ? containerDim : extracted;
  }

  // --- Otherwise, return the main container size
  return containerDim;
}
