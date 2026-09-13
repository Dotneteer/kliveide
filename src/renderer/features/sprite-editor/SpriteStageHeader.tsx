import styles from "./SpriteEditor.module.scss";
import { memo } from "react";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";

type Props = {
  cellSize: number;
  fitToPane: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  showGrid: boolean;
  showOnionSkin: boolean;
  /** False on the first sprite, where there is no previous frame to ghost. */
  hasOnionSource: boolean;
  showTransparency: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onToggleGrid: () => void;
  onToggleOnionSkin: () => void;
  onToggleTransparency: () => void;
};

/** Zoom and what the canvas draws over it. */
export const SpriteStageHeader = memo(
  ({
    cellSize,
    fitToPane,
    canZoomIn,
    canZoomOut,
    showGrid,
    showOnionSkin,
    hasOnionSource,
    showTransparency,
    onZoomIn,
    onZoomOut,
    onFit,
    onToggleGrid,
    onToggleOnionSkin,
    onToggleTransparency
  }: Props) => (
    <div className={styles.stageHeader}>
      <SmallIconButton
        iconName="spr-zoom-out"
        title={"Zoom out (-)"}
        enable={canZoomOut}
        clicked={onZoomOut}
      />
      {/*
       * `24x` - screen pixels per sprite pixel - rather than a percentage. For a 16x16 sprite the
       * useful range is 300%-4000%, where a percentage is a number nobody can hold in their head.
       */}
      <span className={styles.zoomLabel}>{cellSize}&times;</span>
      <SmallIconButton
        iconName="spr-zoom-in"
        title={"Zoom in (+)"}
        enable={canZoomIn}
        clicked={onZoomIn}
      />
      <SmallIconButton
        iconName="spr-fit"
        title={"Fit to pane (0)"}
        selected={fitToPane}
        clicked={onFit}
      />
      <ToolbarSeparator small={true} />
      <SmallIconButton
        iconName="spr-grid"
        title={`${showGrid ? "Hide" : "Show"} pixel grid`}
        selected={showGrid}
        clicked={onToggleGrid}
      />
      <SmallIconButton
        iconName="spr-onion"
        title={
          hasOnionSource
            ? `${showOnionSkin ? "Hide" : "Show"} onion skin\nGhosts the previous sprite through the transparent pixels`
            : "Onion skin\nNo previous sprite to ghost"
        }
        selected={showOnionSkin}
        enable={hasOnionSource}
        clicked={onToggleOnionSkin}
      />
      <SmallIconButton
        iconName="spr-checker"
        title={`${showTransparency ? "Hide" : "Show"} transparency color`}
        selected={showTransparency}
        clicked={onToggleTransparency}
      />
    </div>
  )
);
