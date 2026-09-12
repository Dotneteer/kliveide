import { memo, useSyncExternalStore } from "react";
import { HoverStore } from "./sprite-hover";

type Props = {
  hover: HoverStore;
  cellSize: number;
  stroke: string;
};

/**
 * The box on the cursor pixel - its own component, subscribing on its own.
 *
 * The grid used to hold the cursor in local state, so moving the pointer one pixel re-rendered all
 * 256 `<rect>`s to move a single outline. Only this component re-renders now.
 *
 * It is also the *keyboard* cursor: arrow keys write to the same store the pointer does, so there
 * is one cursor rather than a mouse position and a separate caret that can disagree.
 */
export const SpriteCursor = memo(({ hover, cellSize, stroke }: Props) => {
  const position = useSyncExternalStore(hover.subscribe, hover.get, hover.get);
  if (!position) return null;
  return (
    <rect
      x={position.col * cellSize}
      y={position.row * cellSize}
      width={cellSize}
      height={cellSize}
      fill="none"
      stroke={stroke}
      strokeWidth={cellSize >= 12 ? 2 : 1}
      pointerEvents="none"
      shapeRendering="crispEdges"
    />
  );
});
