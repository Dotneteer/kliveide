import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  // --- Component state
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [persistentCursor, setPersistentCursor] = useState<string | null>(null);
  const persistentCursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [globalCursor, setGlobalCursor] = useState<string | null>(null);

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

  // --- Primary panel size state (initialized to 0, will be set in useEffect)
  const [primarySize, setPrimarySize] = useState(0);

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

  // --- Calculate constraint states for cursor styling
  const constraintState = useMemo(() => {
    if (!primaryVisible || !secondaryVisible) return null;
    
    const tolerance = 1; // Allow 1px tolerance for floating point calculations
    const isAtMinPrimary = primarySize <= minPrimarySizePx + tolerance;
    const isAtMaxPrimary = primarySize >= maxPrimarySizePx - tolerance;
    const secondarySize = relevantContainerSize - primarySize;
    const isAtMinSecondary = secondarySize <= minSecondarySizePx + tolerance;
    
    // --- Determine constraint direction based on panel location and constraints
    if (isHorizontal) {
      if (primaryLocation === "left") {
        // Primary is on left, splitter moves left/right
        if (isAtMinPrimary || isAtMinSecondary) return "constrainedLeft"; // Can only grow right
        if (isAtMaxPrimary) return "constrainedRight"; // Can only shrink left
      } else {
        // Primary is on right, splitter moves left/right
        if (isAtMinPrimary || isAtMinSecondary) return "constrainedRight"; // Can only grow left
        if (isAtMaxPrimary) return "constrainedLeft"; // Can only shrink right
      }
    } else {
      if (primaryLocation === "top") {
        // Primary is on top, splitter moves up/down
        if (isAtMinPrimary || isAtMinSecondary) return "constrainedUp"; // Can only grow down
        if (isAtMaxPrimary) return "constrainedDown"; // Can only shrink up
      } else {
        // Primary is on bottom, splitter moves up/down
        if (isAtMinPrimary || isAtMinSecondary) return "constrainedDown"; // Can only grow up
        if (isAtMaxPrimary) return "constrainedUp"; // Can only shrink down
      }
    }
    
    return null; // No constraints, normal resize
  }, [
    primaryVisible,
    secondaryVisible,
    primarySize,
    minPrimarySizePx,
    maxPrimarySizePx,
    minSecondarySizePx,
    relevantContainerSize,
    isHorizontal,
    primaryLocation,
  ]);

  // --- Determine appropriate cursor type for any position (used during dragging)
  const getCursorType = useCallback((mousePosition?: { x: number, y: number }) => {
    if (!primaryVisible || !secondaryVisible) {
      return isHorizontal ? "col-resize" : "row-resize";
    }

    // Ensure we have a valid container size before calculating constraints
    if (relevantContainerSize <= 0) {
      return isHorizontal ? "col-resize" : "row-resize";
    }

    const tolerance = 1;
    const isAtMinPrimary = primarySize <= minPrimarySizePx + tolerance;
    const isAtMaxPrimary = primarySize >= maxPrimarySizePx - tolerance;
    const secondarySize = relevantContainerSize - primarySize;
    const isAtMinSecondary = secondarySize <= minSecondarySizePx + tolerance;

    // --- Check if we have any constraints at all
    const hasConstraints = (isAtMinPrimary || isAtMaxPrimary || isAtMinSecondary) && 
                           // Only apply constraint if we have a valid primary size
                           primarySize > 0;

    // --- Debug logging (remove in production)
    if (process.env.NODE_ENV === 'test') {
      console.log('DEBUG getCursorType:', {
        primarySize,
        minPrimarySizePx,
        maxPrimarySizePx,
        secondarySize,
        minSecondarySizePx,
        relevantContainerSize,
        isAtMinPrimary,
        isAtMaxPrimary,
        isAtMinSecondary,
        hasConstraints,
        mousePosition
      });
    }

    // --- If we have a mouse position, consider spatial constraints
    if (mousePosition && containerRef.current && hasConstraints) {
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = mousePosition.x - rect.left;
      const relativeY = mousePosition.y - rect.top;
      
      // Calculate the splitter position
      const splitterX = isPrimaryFirst ? primarySize : relevantContainerSize - primarySize;
      const splitterY = isPrimaryFirst ? primarySize : relevantContainerSize - primarySize;
      
      // Debug info for testing
      if (process.env.NODE_ENV === 'test') {
        console.log('DEBUG spatial position:', {
          relativeX, 
          relativeY,
          splitterX,
          splitterY,
          isPrimaryFirst,
          primaryLocation,
          isHorizontal,
          isAtMaxPrimary,
          isAtMinSecondary
        });
      }
      
      if (isHorizontal) {
        if (primaryLocation === "left") {
          // LEFT PRIMARY LOCATION
          
          // Special case: When at min secondary or max primary for left primary
          if (isAtMaxPrimary || isAtMinSecondary) {
            // If mouse is to right of splitter, can only resize left
            if (relativeX > splitterX) {
              if (process.env.NODE_ENV === 'test') {
                console.log('LEFT PRIMARY - RIGHT of splitter, at max primary. Using W-RESIZE');
              }
              return "w-resize";
            }
          }
          
          // If at min primary and mouse left of splitter, can only resize right
          if (isAtMinPrimary && relativeX < splitterX) {
            return "e-resize";
          }
          
        } else { // primaryLocation === "right"
          // RIGHT PRIMARY LOCATION
          
          // Special case: When at min secondary or max primary for right primary
          if (isAtMaxPrimary || isAtMinSecondary) {
            // If mouse is to left of splitter, can only resize right
            if (relativeX < splitterX) {
              return "e-resize";
            }
          }
          
          // If at min primary and mouse right of splitter, can only resize left
          if (isAtMinPrimary && relativeX > splitterX) {
            return "w-resize";
          }
        }
      } else { // vertical
        const splitterY = isPrimaryFirst ? primarySize : relevantContainerSize - primarySize;
        
        if (primaryLocation === "top") {
          // Mouse is above the splitter and primary is at minimum
          if (relativeY < splitterY && (isAtMinPrimary || isAtMinSecondary)) {
            if (process.env.NODE_ENV === 'test') {
              console.log('DEBUG: Mouse above splitter, constrained to s-resize');
            }
            return "s-resize"; // Can only move down
          }
          // Mouse is below the splitter and primary is at maximum
          if (relativeY > splitterY && isAtMaxPrimary) {
            if (process.env.NODE_ENV === 'test') {
              console.log('DEBUG: Mouse below splitter, constrained to n-resize');
            }
            return "n-resize"; // Can only move up
          }
        } else { // primaryLocation === "bottom"
          // Mouse is below the splitter and primary is at minimum
          if (relativeY > splitterY && (isAtMinPrimary || isAtMinSecondary)) {
            return "n-resize"; // Can only move up
          }
          // Mouse is above the splitter and primary is at maximum
          if (relativeY < splitterY && isAtMaxPrimary) {
            return "s-resize"; // Can only move down
          }
        }
      }
    }

    // --- Fallback to constraint state if no spatial information or no constraints found
    if (constraintState) {
      switch (constraintState) {
        case "constrainedLeft": return "e-resize";
        case "constrainedRight": return "w-resize";
        case "constrainedUp": return "s-resize";
        case "constrainedDown": return "n-resize";
      }
    }

    // --- Default to normal resize cursors
    return isHorizontal ? "col-resize" : "row-resize";
  }, [
    primaryVisible,
    secondaryVisible,
    primarySize,
    minPrimarySizePx,
    maxPrimarySizePx,
    minSecondarySizePx,
    relevantContainerSize,
    isHorizontal,
    primaryLocation,
    isPrimaryFirst,
    constraintState,
  ]);

  // --- Calculate half splitter size for positioning
  const halfSplitterSize = splitterSize / 2;

  // --- Manage persistent cursor state
  const setPersistentCursorWithTimeout = useCallback((cursorType: string | null, duration: number = 1000) => {
    // Clear any existing timeout
    if (persistentCursorTimeoutRef.current) {
      clearTimeout(persistentCursorTimeoutRef.current);
      persistentCursorTimeoutRef.current = null;
    }

    // Set the new cursor state
    setPersistentCursor(cursorType);

    // Set timeout to clear the cursor if a duration is specified and cursor is not null
    if (cursorType && duration > 0) {
      persistentCursorTimeoutRef.current = setTimeout(() => {
        setPersistentCursor(null);
        persistentCursorTimeoutRef.current = null;
      }, duration);
    }
  }, []);

  // --- Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (persistentCursorTimeoutRef.current) {
        clearTimeout(persistentCursorTimeoutRef.current);
      }
    };
  }, []);

  // --- Manage global cursor during dragging
  useEffect(() => {
    if (globalCursor) {
      document.body.style.cursor = globalCursor;
      // Disable text selection globally during dragging
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      // Cleanup on unmount or when globalCursor changes
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [globalCursor]);

  // --- Handle mouse down on splitter
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const startPosition = isHorizontal ? e.clientX : e.clientY;
      const startSize = primarySize;

      // --- Determine cursor type using enhanced logic
      const cursorType = getCursorType({ x: e.clientX, y: e.clientY });
      
      // --- Set global cursor for mouse capture effect
      setGlobalCursor(cursorType);

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

        // --- Update global cursor based on current mouse position during drag
        const updatedCursorType = getCursorType({ x: e.clientX, y: e.clientY });
        if (updatedCursorType !== cursorType) {
          setGlobalCursor(updatedCursorType);
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        setGlobalCursor(null); // Clear global cursor
        onPrimarySizeUpdateCompleted?.(primarySize);
        
        // --- Set persistent cursor after drag ends
        setPersistentCursorWithTimeout(cursorType, 1000); // Show cursor for 1 second after release
        
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
      getCursorType,
      setPersistentCursorWithTimeout,
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
          [styles.globalDragging]: globalCursor !== null,
          [styles.persistentColResize]: persistentCursor === "col-resize",
          [styles.persistentRowResize]: persistentCursor === "row-resize",
          [styles.persistentEResize]: persistentCursor === "e-resize",
          [styles.persistentWResize]: persistentCursor === "w-resize",
          [styles.persistentSResize]: persistentCursor === "s-resize",
          [styles.persistentNResize]: persistentCursor === "n-resize",
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
          [styles.constrainedLeft]: constraintState === "constrainedLeft",
          [styles.constrainedRight]: constraintState === "constrainedRight",
          [styles.constrainedUp]: constraintState === "constrainedUp",
          [styles.constrainedDown]: constraintState === "constrainedDown",
        })}
        style={splitterStyle}
        onMouseDown={handleMouseDown}
        data-testid="_$_SplitPanel-splitter"
      />
    </div>
  );
};

export default SplitPanel;
