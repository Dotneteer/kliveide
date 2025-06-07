import { useCallback, useState } from "react";

/**
 * Options for the drag hook
 */
export interface UseDragOptions {
  /** Whether the split is horizontal (left/right) or vertical (top/bottom) */
  isHorizontal: boolean;
  /** Whether the primary panel is rendered first */
  isPrimaryFirst: boolean;
  /** Initial size of the panel in pixels */
  initialSize: number;
  /** Minimum allowed size in pixels */
  minSize: number;
  /** Maximum allowed size in pixels */
  maxSize: number;
  /** Total container size in pixels */
  containerSize: number;
  /** Minimum size of the secondary panel in pixels */
  minSecondarySize: number;
  /** Callback when the size changes during dragging */
  onSizeChange?: (size: number) => void;
  /** Callback when the dragging completes */
  onSizeChangeComplete?: (size: number) => void;
}

/**
 * Return value from the useDrag hook
 */
export interface UseDragResult {
  /** Current size of the panel */
  size: number;
  /** Whether dragging is in progress */
  isDragging: boolean;
  /** Current global cursor value or null if not dragging */
  globalCursor: string | null;
  /** Handler for mouse down event to start dragging */
  handleMouseDown: (e: React.MouseEvent) => void;
}

/**
 * Custom hook to handle drag resizing for split panels
 * 
 * This hook encapsulates the state and logic for drag operations,
 * including size constraints, cursor styles, and global event listeners
 */
export const useDrag = ({
  isHorizontal,
  isPrimaryFirst,
  initialSize,
  minSize,
  maxSize,
  containerSize,
  minSecondarySize,
  onSizeChange,
  onSizeChangeComplete,
}: UseDragOptions): UseDragResult => {
  // State
  const [size, setSize] = useState(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const [globalCursor, setGlobalCursor] = useState<string | null>(null);

  // Cursor type based on orientation
  const cursorType = isHorizontal ? "col-resize" : "row-resize";

  // Handler for mouse down on splitter
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const startPosition = isHorizontal ? e.clientX : e.clientY;
      const startSize = size;

      // Set standard resize cursor
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

        // Clamp size to constraints
        const clampedSize = Math.max(
          minSize,
          Math.min(
            newSize,
            Math.min(
              maxSize,
              containerSize - minSecondarySize
            )
          )
        );

        setSize(clampedSize);
        onSizeChange?.(clampedSize);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        setGlobalCursor(null);
        onSizeChangeComplete?.(size);
        
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [
      isHorizontal,
      isPrimaryFirst,
      size,
      minSize,
      maxSize,
      containerSize,
      minSecondarySize,
      cursorType,
      onSizeChange,
      onSizeChangeComplete,
    ]
  );

  return {
    size,
    isDragging,
    globalCursor,
    handleMouseDown,
  };
};
