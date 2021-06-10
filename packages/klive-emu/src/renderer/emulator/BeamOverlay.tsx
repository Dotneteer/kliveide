import * as React from "react";
import { SpectrumMachineStateBase } from "../machines/spectrum/ZxSpectrumCoreBase";
import { vmEngineService } from "../machines/vm-engine-service";
import styles from "styled-components";

/**
 * Component properties
 */
interface Props {
  panelRectangle: DOMRect;
  screenRectangle: DOMRect;
  width: number;
  height: number;
  tactToDisplay: number;
}

/**
 * Represents the beam overlay of the emulator
 */
export default function BeamOverlay(props: Props) {
  if (!vmEngineService.hasEngine) {
    return null;
  }

  // --- Obtain the display attributes
  const state = vmEngineService
    .getEngine()
    .getMachineState() as SpectrumMachineStateBase;
  const verticalSyncLines = state.verticalSyncLines;
  const nonVisibleBorderTopLines = state.nonVisibleBorderTopLines;
  const borderTopLines = state.borderTopLines;
  const displayLines = state.displayLines;
  const nonVisibleBorderBottomLines = state.nonVisibleBorderBottomLines;
  const nonVisibleBorderRightTime = state.nonVisibleBorderRightTime;
  const borderLeftPixels = state.borderLeftPixels;
  const displayWidth = state.displayWidth;
  const screenWidth = state.screenWidth;
  const screenHeight = state.screenHeight;
  const screenLineTime = state.screenLineTime;
  const rasterLines = state.rasterLines;

  // --- Entire viewport
  const zoom =
    (props.screenRectangle.right - props.screenRectangle.left) / screenWidth;

  // --- Display area
  const dspLeft =
    props.screenRectangle.left -
    props.panelRectangle.left +
    zoom * borderLeftPixels;
  const dspTop =
    props.screenRectangle.top -
    props.panelRectangle.top +
    zoom * borderTopLines;
  const dspWidth = zoom * displayWidth + 1;
  const dspHeight = zoom * displayLines + 1;

  // --- Non-visible area
  const nvLeft = props.screenRectangle.left - props.panelRectangle.left;
  const nvTop =
    props.screenRectangle.top -
    props.panelRectangle.top -
    zoom * nonVisibleBorderTopLines +
    1;
  const nvWidth = zoom * (screenWidth + nonVisibleBorderRightTime * 2) + 1;
  const nvHeight =
    zoom *
      (screenHeight + nonVisibleBorderTopLines + nonVisibleBorderBottomLines) +
    1;

  // --- Sync area
  const synLeft = nvLeft;
  const synTop = nvTop - zoom * verticalSyncLines + 1;
  const synWidth = zoom * screenLineTime * 2;
  const synHeight = zoom * rasterLines;

  // --- Beam line
  const bmLine =
    synTop + zoom * (Math.floor(props.tactToDisplay / screenLineTime) + 1);
  const bmLeft = synLeft;
  const bmRight = synLeft + synWidth;
  const bmLineWidth = zoom;

  // --- Beam cross
  const bcPos =
    synLeft + zoom * 2 * Math.floor(props.tactToDisplay % screenLineTime);
  const bcTop = bmLine - 8;
  const bcBottom = bmLine + 8;
  const bcLineWidth = 2 * zoom;

  return (
    <Root>
      <svg width={props.width} height={props.height}>
        <rect
          x={dspLeft}
          y={dspTop}
          width={dspWidth}
          height={dspHeight}
          style={{ stroke: "none", fill: "rgba(255, 255, 255, 0.1)" }}
        />
        <rect
          x={nvLeft}
          y={nvTop}
          width={nvWidth}
          height={nvHeight}
          style={{ stroke: "none", fill: "rgba(255, 255, 255, 0.1)" }}
        />
        <rect
          x={synLeft}
          y={synTop}
          width={synWidth}
          height={synHeight}
          style={{ stroke: "none", fill: "rgba(255, 255, 255, 0.1)" }}
        />
        <line
          x1={bmLeft}
          y1={bmLine}
          x2={bmRight}
          y2={bmLine}
          style={{
            stroke: "rgb(255,0,128)",
            strokeWidth: bmLineWidth,
          }}
        />
        <line
          x1={bcPos}
          y1={bcTop}
          x2={bcPos}
          y2={bcBottom}
          style={{
            stroke: "rgba(255,0,128, 0.75)",
            strokeWidth: bcLineWidth,
          }}
        />
      </svg>
    </Root>
  );
}

/**
 * The root node of the component
 */
const Root = styles.div`
 position: absolute;
 left: 0;
 top: 0;
`;
