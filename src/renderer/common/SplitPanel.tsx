import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import classNames from "classnames";
import styles from "./SplitPanel.module.scss";

// --- SplitPanel component types
interface SplitPanelProps {
  /** React children - only first two children are used */
  children?: React.ReactNode;
  /** CSS class name */
  className?: string;
  /** Test ID for testing purposes */
  "data-testid"?: string;
  /** Location of the primary panel */
  primaryLocation: "left" | "right" | "top" | "bottom";
  /** Whether the primary panel is visible */
  primaryVisible?: boolean;
  /** Whether the secondary panel is visible */
  secondaryVisible?: boolean;
  /** Initial size of the primary panel in pixels or percentage */
  initialPrimarySize?: string | number;
  /** Minimum size of the primary panel in pixels or percentage */
  minPrimarySize?: string | number;
  /** Maximum size of the primary panel in pixels or percentage */
  maxPrimarySize?: string | number;
  /** Minimum size of the secondary panel in pixels or percentage */
  minSecondarySize?: string | number;
  /** Size of the splitter handle in pixels (default: 4) */
  splitterSize?: number;
  /** Callback when the primary panel size changes during dragging */
  onUpdatePrimarySize?: (size: number) => void;
  /** Callback when the user completes resizing */
  onPrimarySizeUpdateCompleted?: (size: number) => void;
  /** Additional styles */
  style?: React.CSSProperties;
}

// --- Helper functions for size calculations
const parseSize = (
  size: string | number | undefined,
  containerSize: number
): number => {
  if (size === undefined) return 0;
  if (typeof size === "number") return size;
  if (typeof size === "string") {
    if (size.endsWith("%")) {
      const percentage = parseFloat(size.slice(0, -1));
      return (percentage / 100) * containerSize;
    }
    if (size.endsWith("px")) {
      return parseFloat(size.slice(0, -2));
    }
    return parseFloat(size);
  }
  return 0;
};

const formatSize = (size: number): string => `${size}px`;

const SplitPanel: React.FC<SplitPanelProps> = ({
  children,
  className,
  "data-testid": dataTestId,
  primaryLocation,
  primaryVisible = true,
  secondaryVisible = true,
  initialPrimarySize = "50%",
  minPrimarySize = "10%",
  maxPrimarySize = "90%",
  minSecondarySize = "10%",
  splitterSize = 4,
  onUpdatePrimarySize,
  onPrimarySizeUpdateCompleted,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [primarySize, setPrimarySize] = useState<number>(0);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  // --- Determine orientation and calculations
  const isHorizontal =
    primaryLocation === "left" || primaryLocation === "right";
  const isPrimaryFirst =
    primaryLocation === "left" || primaryLocation === "top";

  // --- Calculate effective sizes
  const relevantContainerSize = isHorizontal
    ? containerSize.width
    : containerSize.height;
  const minPrimarySizePx = parseSize(minPrimarySize, relevantContainerSize);
  const maxPrimarySizePx = parseSize(maxPrimarySize, relevantContainerSize);
  const minSecondarySizePx = parseSize(minSecondarySize, relevantContainerSize);

  // --- Initialize primary size
  useEffect(() => {
    if (relevantContainerSize > 0 && primarySize === 0) {
      const initialSize = parseSize(initialPrimarySize, relevantContainerSize);
      const clampedSize = Math.max(
        minPrimarySizePx,
        Math.min(
          initialSize,
          Math.min(maxPrimarySizePx, relevantContainerSize - minSecondarySizePx)
        )
      );
      setPrimarySize(clampedSize);
    }
  }, [
    relevantContainerSize,
    initialPrimarySize,
    minPrimarySizePx,
    maxPrimarySizePx,
    minSecondarySizePx,
    primarySize,
  ]);

  // --- Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // --- Calculate splitter position
  const splitterPosition = useMemo(() => {
    if (!primaryVisible || !secondaryVisible) return 0;
    return isPrimaryFirst ? primarySize : relevantContainerSize - primarySize;
  }, [
    primaryVisible,
    secondaryVisible,
    isPrimaryFirst,
    primarySize,
    relevantContainerSize,
  ]);

  // --- Calculate half splitter size for positioning
  const halfSplitterSize = splitterSize / 2;

  // --- Handle mouse down on splitter
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const startPosition = isHorizontal ? e.clientX : e.clientY;
      const startSize = primarySize;

      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();

        const currentPosition = isHorizontal ? e.clientX : e.clientY;
        const delta = currentPosition - startPosition;

        let newSize: number;
        if (isPrimaryFirst) {
          newSize = startSize + delta;
        } else {
          newSize = startSize - delta;
        }

        // --- Clamp size to constraints
        const clampedSize = Math.max(
          minPrimarySizePx,
          Math.min(
            newSize,
            Math.min(
              maxPrimarySizePx,
              relevantContainerSize - minSecondarySizePx
            )
          )
        );

        setPrimarySize(clampedSize);
        onUpdatePrimarySize?.(clampedSize);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        onPrimarySizeUpdateCompleted?.(primarySize);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [
      isHorizontal,
      isPrimaryFirst,
      primarySize,
      minPrimarySizePx,
      maxPrimarySizePx,
      minSecondarySizePx,
      relevantContainerSize,
      onUpdatePrimarySize,
      onPrimarySizeUpdateCompleted,
    ]
  );

  // --- Get children
  const childrenArray = React.Children.toArray(children);
  const primaryChild = childrenArray[0];
  const secondaryChild = childrenArray[1];

  // --- Calculate panel styles
  const primaryPanelStyle: React.CSSProperties = {
    display: primaryVisible ? "block" : "none",
    [isHorizontal ? "width" : "height"]: formatSize(primarySize),
    [isHorizontal ? "height" : "width"]: "100%",
  };

  const secondaryPanelStyle: React.CSSProperties = {
    display: secondaryVisible ? "block" : "none",
    [isHorizontal ? "width" : "height"]: formatSize(
      relevantContainerSize - primarySize
    ),
    [isHorizontal ? "height" : "width"]: "100%",
  };

  // --- Calculate splitter style
  const shouldShowSplitter = primaryVisible && secondaryVisible;
  const splitterStyle: React.CSSProperties = {
    [isHorizontal ? "left" : "top"]: formatSize(
      splitterPosition - halfSplitterSize
    ),
    [isHorizontal ? "width" : "height"]: formatSize(splitterSize),
    [isHorizontal ? "height" : "width"]: "100%",
    display: shouldShowSplitter ? "block" : "none",
  };

  // --- Render panels in correct order
  const panels = isPrimaryFirst
    ? [
        primaryChild && (
          <div
            key="primary"
            className={styles.primaryPanel}
            style={primaryPanelStyle}
            data-testid="_$_SplitPanel-primary-panel"
          >
            {primaryChild}
          </div>
        ),
        secondaryChild && (
          <div
            key="secondary"
            className={styles.secondaryPanel}
            style={secondaryPanelStyle}
            data-testid="_$_SplitPanel-secondary-panel"
          >
            {secondaryChild}
          </div>
        ),
      ]
    : [
        secondaryChild && (
          <div
            key="secondary"
            className={styles.secondaryPanel}
            style={secondaryPanelStyle}
            data-testid="_$_SplitPanel-secondary-panel"
          >
            {secondaryChild}
          </div>
        ),
        primaryChild && (
          <div
            key="primary"
            className={styles.primaryPanel}
            style={primaryPanelStyle}
            data-testid="_$_SplitPanel-primary-panel"
          >
            {primaryChild}
          </div>
        ),
      ];

  return (
    <div
      ref={containerRef}
      className={classNames(
        styles.splitPanel,
        {
          [styles.horizontal]: isHorizontal,
          [styles.vertical]: !isHorizontal,
          [styles.userSelecting]: isDragging,
        },
        className
      )}
      style={style}
      data-testid={dataTestId}
    >
      {panels}
      <div
        className={classNames(styles.splitter, {
          [styles.horizontal]: isHorizontal,
          [styles.vertical]: !isHorizontal,
          [styles.dragging]: isDragging,
        })}
        style={splitterStyle}
        onMouseDown={handleMouseDown}
        data-testid="_$_SplitPanel-splitter"
      />
    </div>
  );
};

export default SplitPanel;
