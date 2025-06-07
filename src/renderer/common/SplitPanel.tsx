import React, { memo, useEffect, useMemo, useReducer, useRef } from "react";
import classNames from "classnames";
import styles from "./SplitPanel.module.scss";
import { useDrag } from "./utils/useDrag";

/**
 * Primary panel location within the split panel
 */
export type PanelLocation = "left" | "right" | "top" | "bottom";

/**
 * Panel type within a SplitPanel
 */
type PanelType = "primary" | "secondary";

/**
 * Size specification that can be a number (in pixels) or a string (e.g., "50%", "100px")
 */
export type SizeSpec = string | number;

/**
 * Utility functions for SplitPanel component
 */

/**
 * Parse size value from string or number into pixels
 * 
 * Converts percentage values to pixels based on container size,
 * handles explicit pixel values, and plain numbers as direct pixel values.
 * 
 * @param size - Size value as string (e.g. "50%", "100px") or number in pixels
 * @param containerSize - Container size in pixels
 * @returns - Calculated size in pixels
 */
const parseSize = (
  size: SizeSpec | undefined,
  containerSize: number
): number => {
  if (size === undefined) return 0;
  
  if (typeof size === "number") {
    return size;
  }
  
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

/**
 * Format size value as pixel string
 * 
 * @param size - Size in pixels
 * @returns - Formatted CSS pixel string (e.g. "100px")
 */
const formatSize = (size: number): string => `${size}px`;

/**
 * Calculate clamped panel size based on constraints
 * 
 * Takes a proposed size and ensures it falls within the allowed range:
 * - Not smaller than minimum size
 * - Not larger than maximum size
 * - Leaves enough space for the other panel's minimum size
 * 
 * @param newSize - Proposed new panel size
 * @param minSize - Minimum allowed size for this panel
 * @param maxSize - Maximum allowed size for this panel
 * @param containerSize - Total container size
 * @param minOtherSize - Minimum required size for the other panel
 * @returns - Final size value after applying all constraints
 */
const clampSize = (
  newSize: number,
  minSize: number,
  maxSize: number,
  containerSize: number,
  minOtherSize: number
): number => {
  // First ensure we don't exceed maximum size or leave less than required for other panel
  const upperLimit = Math.min(maxSize, containerSize - minOtherSize);
  
  // Then ensure we're not below minimum size, and not above upper limit
  return Math.max(minSize, Math.min(newSize, upperLimit));
};

/**
 * Calculate splitter position based on panel configuration
 * 
 * @param isPrimaryFirst - Whether the primary panel is rendered first
 * @param primarySize - Size of primary panel in pixels
 * @param containerSize - Total container size in pixels
 * @returns - Position of the splitter in pixels from the start edge
 */
const calculateSplitterPosition = (
  isPrimaryFirst: boolean,
  primarySize: number,
  containerSize: number
): number => {
  return isPrimaryFirst ? primarySize : containerSize - primarySize;
};

/**
 * Calculate styles for panels
 * 
 * @param isHorizontal - Whether orientation is horizontal (true) or vertical (false)
 * @param size - Panel size in pixels
 * @param isVisible - Whether panel is visible
 * @returns - CSS styles object for the panel
 */
const getPanelStyle = (
  isHorizontal: boolean,
  size: number,
  isVisible: boolean
): React.CSSProperties => {
  return {
    display: isVisible ? "block" : "none",
    [isHorizontal ? "width" : "height"]: formatSize(size),
    [isHorizontal ? "height" : "width"]: "100%",
  };
};

/**
 * Calculate splitter style
 * 
 * @param isHorizontal - Whether orientation is horizontal (true) or vertical (false)
 * @param position - Position of splitter center in pixels
 * @param splitterSize - Size of splitter handle in pixels 
 * @param isVisible - Whether splitter is visible
 * @returns - CSS styles object for the splitter
 */
const getSplitterStyle = (
  isHorizontal: boolean,
  position: number,
  splitterSize: number,
  isVisible: boolean
): React.CSSProperties => {
  const halfSplitterSize = splitterSize / 2;
  return {
    // Center the splitter on the split position by offsetting by half its size
    [isHorizontal ? "left" : "top"]: formatSize(position - halfSplitterSize),
    [isHorizontal ? "width" : "height"]: formatSize(splitterSize),
    [isHorizontal ? "height" : "width"]: "100%",
    display: isVisible ? "block" : "none",
  };
};

/**
 * State for SplitPanel component
 */
export interface SplitPanelState {
  containerSize: { width: number; height: number };
  primarySize: number;
  isInitialized: boolean;
}

/**
 * Actions for SplitPanel state management
 */
export type SplitPanelAction =
  | { type: 'SET_CONTAINER_SIZE'; payload: { width: number; height: number } }
  | { type: 'SET_PRIMARY_SIZE'; payload: number }
  | { type: 'INITIALIZE'; payload: number };

/**
 * Reducer function for SplitPanel state
 */
const splitPanelReducer = (
  state: SplitPanelState,
  action: SplitPanelAction
): SplitPanelState => {
  switch (action.type) {
    case 'SET_CONTAINER_SIZE':
      return {
        ...state,
        containerSize: action.payload,
      };

    case 'SET_PRIMARY_SIZE':
      return {
        ...state,
        primarySize: action.payload,
      };

    case 'INITIALIZE':
      return {
        ...state,
        primarySize: action.payload,
        isInitialized: true,
      };

    default:
      return state;
  }
};

/**
 * Initial state for SplitPanel
 */
const initialSplitPanelState: SplitPanelState = {
  containerSize: { width: 0, height: 0 },
  primarySize: 0,
  isInitialized: false,
};

/**
 * Props for the Panel component
 */
interface PanelProps {
  /** Type of panel (primary or secondary) */
  type: PanelType;
  /** CSS styles for the panel */
  style: React.CSSProperties;
  /** Panel content */
  children: React.ReactNode;
  /** Test ID for the panel */
  "data-testid"?: string;
}

/**
 * Props for the Splitter component
 */
interface SplitterProps {
  /** Whether the splitter is horizontal */
  isHorizontal: boolean;
  /** Whether dragging is in progress */
  isDragging: boolean;
  /** CSS styles for the splitter */
  style: React.CSSProperties;
  /** Handler for mouse down event */
  onMouseDown: (e: React.MouseEvent) => void;
  /** Test ID for the splitter */
  "data-testid"?: string;
}

/**
 * Panel component for SplitPanel
 * 
 * Renders either the primary or secondary panel with the correct styling
 */
const Panel = memo(({ 
  type, 
  style, 
  children, 
  "data-testid": dataTestId 
}: PanelProps) => {
  return (
    <div
      key={type}
      className={styles[`${type}Panel`]}
      style={style}
      data-testid={dataTestId || `_$_SplitPanel-${type}-panel`}
    >
      {children}
    </div>
  );
});

Panel.displayName = "Panel";

/**
 * Splitter component for SplitPanel
 * 
 * Renders the draggable splitter that separates the panels
 */
const Splitter = memo(({
  isHorizontal,
  isDragging,
  style,
  onMouseDown,
  "data-testid": dataTestId,
}: SplitterProps) => {
  return (
    <div
      className={classNames(styles.splitter, {
        [styles.horizontal]: isHorizontal,
        [styles.vertical]: !isHorizontal,
        [styles.dragging]: isDragging,
      })}
      style={style}
      onMouseDown={onMouseDown}
      data-testid={dataTestId || "_$_SplitPanel-splitter"}
    />
  );
});

Splitter.displayName = "Splitter";

/**
 * SplitPanel component props
 */
interface SplitPanelProps {
  /** React children - only first two children are used */
  children?: React.ReactNode;
  /** CSS class name */
  className?: string;
  /** Test ID for testing purposes */
  "data-testid"?: string;
  /** Location of the primary panel */
  primaryLocation: PanelLocation;
  /** Whether the primary panel is visible */
  primaryVisible?: boolean;
  /** Whether the secondary panel is visible */
  secondaryVisible?: boolean;
  /** Initial size of the primary panel in pixels or percentage */
  initialPrimarySize?: SizeSpec;
  /** Minimum size of the primary panel in pixels or percentage */
  minPrimarySize?: SizeSpec;
  /** Maximum size of the primary panel in pixels or percentage */
  maxPrimarySize?: SizeSpec;
  /** Minimum size of the secondary panel in pixels or percentage */
  minSecondarySize?: SizeSpec;
  /** Size of the splitter handle in pixels (default: 4) */
  splitterSize?: number;
  /** Callback when the primary panel size changes during dragging */
  onUpdatePrimarySize?: (size: number) => void;
  /** Callback when the user completes resizing */
  onPrimarySizeUpdateCompleted?: (size: number) => void;
  /** Additional styles */
  style?: React.CSSProperties;
}

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
  // --- Component state using reducer
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(splitPanelReducer, initialSplitPanelState);
  const { containerSize, primarySize } = state;

  // --- Determine orientation and layout
  const isHorizontal = primaryLocation === "left" || primaryLocation === "right";
  const isPrimaryFirst = primaryLocation === "left" || primaryLocation === "top";

  // --- Calculate effective sizes
  const relevantContainerSize = isHorizontal
    ? containerSize.width
    : containerSize.height;
  const minPrimarySizePx = parseSize(minPrimarySize, relevantContainerSize);
  const maxPrimarySizePx = parseSize(maxPrimarySize, relevantContainerSize);
  const minSecondarySizePx = parseSize(minSecondarySize, relevantContainerSize);

  // --- Initialize primary size when container size is available
  useEffect(() => {
    if (relevantContainerSize > 0 && !state.isInitialized) {
      const initialSize = parseSize(initialPrimarySize, relevantContainerSize);
      const clampedSize = clampSize(
        initialSize,
        minPrimarySizePx,
        maxPrimarySizePx,
        relevantContainerSize,
        minSecondarySizePx
      );
      dispatch({ type: 'INITIALIZE', payload: clampedSize });
    }
  }, [
    relevantContainerSize,
    initialPrimarySize,
    minPrimarySizePx,
    maxPrimarySizePx,
    minSecondarySizePx,
    state.isInitialized,
  ]);

  // --- Prepare useDrag options
  const dragOptions = useMemo(() => ({
    isHorizontal,
    isPrimaryFirst,
    initialSize: primarySize,
    minSize: minPrimarySizePx,
    maxSize: maxPrimarySizePx,
    containerSize: relevantContainerSize,
    minSecondarySize: minSecondarySizePx,
    onSizeChange: (size: number) => {
      dispatch({ type: 'SET_PRIMARY_SIZE', payload: size });
      onUpdatePrimarySize?.(size);
    },
    onSizeChangeComplete: onPrimarySizeUpdateCompleted,
  }), [
    isHorizontal,
    isPrimaryFirst,
    primarySize,
    minPrimarySizePx,
    maxPrimarySizePx,
    relevantContainerSize,
    minSecondarySizePx,
    onUpdatePrimarySize,
    onPrimarySizeUpdateCompleted,
  ]);

  // --- Use drag hook for handling resize interactions
  const { isDragging, globalCursor, handleMouseDown } = useDrag(dragOptions);

  // --- Manage global cursor during dragging
  useEffect(() => {
    if (globalCursor) {
      document.body.style.cursor = globalCursor;
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      // Cleanup on unmount
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [globalCursor]);

  // --- Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        dispatch({ 
          type: 'SET_CONTAINER_SIZE', 
          payload: { width: rect.width, height: rect.height } 
        });
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
    return calculateSplitterPosition(isPrimaryFirst, primarySize, relevantContainerSize);
  }, [
    primaryVisible,
    secondaryVisible,
    isPrimaryFirst,
    primarySize,
    relevantContainerSize,
  ]);

  // --- Get children
  const childrenArray = React.Children.toArray(children);
  const primaryChild = childrenArray[0];
  const secondaryChild = childrenArray[1];

  // --- Calculate panel styles
  const primaryPanelStyle = useMemo(() => 
    getPanelStyle(isHorizontal, primarySize, primaryVisible),
    [isHorizontal, primarySize, primaryVisible]
  );

  const secondaryPanelStyle = useMemo(() => 
    getPanelStyle(isHorizontal, relevantContainerSize - primarySize, secondaryVisible),
    [isHorizontal, relevantContainerSize, primarySize, secondaryVisible]
  );

  // --- Calculate splitter style
  const shouldShowSplitter = primaryVisible && secondaryVisible;
  const splitterStyle = useMemo(() => 
    getSplitterStyle(isHorizontal, splitterPosition, splitterSize, shouldShowSplitter),
    [isHorizontal, splitterPosition, splitterSize, shouldShowSplitter]
  );

  // --- Render panels in correct order
  const panels = useMemo(() => {
    if (isPrimaryFirst) {
      return (
        <>
          {primaryChild && (
            <Panel
              type="primary"
              style={primaryPanelStyle}
              data-testid="_$_SplitPanel-primary-panel"
            >
              {primaryChild}
            </Panel>
          )}
          {secondaryChild && (
            <Panel
              type="secondary"
              style={secondaryPanelStyle}
              data-testid="_$_SplitPanel-secondary-panel"
            >
              {secondaryChild}
            </Panel>
          )}
        </>
      );
    }

    return (
      <>
        {secondaryChild && (
          <Panel
            type="secondary"
            style={secondaryPanelStyle}
            data-testid="_$_SplitPanel-secondary-panel"
          >
            {secondaryChild}
          </Panel>
        )}
        {primaryChild && (
          <Panel
            type="primary"
            style={primaryPanelStyle}
            data-testid="_$_SplitPanel-primary-panel"
          >
            {primaryChild}
          </Panel>
        )}
      </>
    );
  }, [
    isPrimaryFirst, 
    primaryChild, 
    secondaryChild, 
    primaryPanelStyle, 
    secondaryPanelStyle
  ]);

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
        },
        className
      )}
      style={style}
      data-testid={dataTestId}
    >
      {panels}
      <Splitter
        isHorizontal={isHorizontal}
        isDragging={isDragging}
        style={splitterStyle}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};

export default SplitPanel;
