import { useCallback, useMemo, useState } from "react";

import { describePixel } from "@common/utils/beamGeometry";
import { Icon } from "@renderer/controls/Icon";
import { EmulatorScreenOverlay, type ScreenPointer } from "./EmulatorScreenOverlay";
import { BEAM_HATCH_ID, beamOverlayModel, type BeamOverlayState } from "./beamOverlayModel";
import styles from "./BeamPositionOverlay.module.scss";

type Props = {
  state: BeamOverlayState;
  /** The picture's size in buffer pixels */
  screenWidth: number;
  screenHeight: number;
  /** The machine's pixel aspect (`getAspectRatio()[0]`): the Next's buffer pixels are half as wide */
  aspectX?: number;
  /** The hover readout (D6); off while the probe or the Kempston mouse has the pointer */
  hover: boolean;
};

/**
 * Where the raster is on the paused screen (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` D1, D2, D5-D7): a
 * line across the beam's row and a tick at its pixel (or an edge marker in blanking), the previous
 * frame's part of the picture hatched, the Copper's hit in the secondary accent, and on hover the
 * pixel's line and tact and how far the beam is from it. Never changes a pixel of the picture.
 */
export const BeamPositionOverlay = ({ state, screenWidth, screenHeight, aspectX = 1, hover }: Props) => {
  const model = useMemo(() => beamOverlayModel(state), [state]);
  const [pointer, setPointer] = useState<ScreenPointer>();
  const onPointer = useCallback((p: ScreenPointer | undefined) => setPointer(p), []);
  // --- A hatch square on screen: 8 rows tall, and as wide in screen pixels whatever the aspect
  const hatchW = 8 / (aspectX > 0 ? aspectX : 1);
  return (
    <EmulatorScreenOverlay
      screenWidth={screenWidth}
      screenHeight={screenHeight}
      shapes={model.shapes.map((s) => ({ ...s, className: styles[s.className] }))}
      labels={model.labels.map((l) => ({ ...l, className: styles[l.className] }))}
      defs={
        <pattern id={BEAM_HATCH_ID} patternUnits="userSpaceOnUse" width={hatchW} height={8}>
          <rect className={styles.staleWash} x={0} y={0} width={hatchW} height={8} />
          <line className={styles.hatch} x1={0} y1={8} x2={hatchW} y2={0} vectorEffect="non-scaling-stroke" />
        </pattern>
      }
      onPointer={hover ? onPointer : undefined}
      className={hover ? styles.hovering : undefined}
      testId="beam-overlay"
      svgTestId="beam-shapes"
    >
      {hover && pointer && (
        <div
          className={styles.readout}
          style={{
            left: pointer.flip ? undefined : pointer.left + 14,
            right: pointer.flip ? `calc(100% - ${pointer.left - 14}px)` : undefined,
            top: pointer.top + 14
          }}
          data-testid="beam-readout"
        >
          {describePixel(state.beam, pointer.x, pointer.y)}
        </div>
      )}
    </EmulatorScreenOverlay>
  );
};

/**
 * The beam's pill in the overlay stack (D1): `line 123 · paper row 75 · hc 210 · HC 56,088`. Shown
 * whenever the overlay is, while paused.
 */
export const BeamPositionPill = ({ text }: { text?: string }) => {
  if (!text) return null;
  return (
    <div className={styles.pillHost} data-testid="beam-pill">
      <div className={styles.pill}>
        <Icon iconName="scan-line" width={14} height={14} fill="--color-beam-line" />
        <span>{text}</span>
      </div>
    </div>
  );
};
