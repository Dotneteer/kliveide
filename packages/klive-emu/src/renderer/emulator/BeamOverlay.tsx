import * as React from "react";
import { SpectrumMachineStateBase } from "../machines/spectrum/ZxSpectrumCoreBase";
import { vmEngineService } from "../machines/vm-engine-service";

interface Props {
  panelRectangle: DOMRect;
  screenRectangle: DOMRect;
  width: number;
  height: number;
  tactToDisplay: number;
}

interface State {
  dspLeft: number;
  dspTop: number;
  dspWidth: number;
  dspHeight: number;
  nvLeft: number;
  nvTop: number;
  nvWidth: number;
  nvHeight: number;
  synLeft: number;
  synTop: number;
  synWidth: number;
  synHeight: number;
  bmLine: number;
  bmLeft: number;
  bmRight: number;
  bmLineWidth: number;
  bcPos: number;
  bcTop: number;
  bcBottom: number;
  bcLineWidth: number;
  mounted: boolean;
}

/**
 * Represents the beam overlay of the emulator
 */
export default class BeamOverlay extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { mounted: false } as State;
  }

  componentDidMount(): void {
    if (!vmEngineService.hasEngine) {
      return;
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
      (this.props.screenRectangle.right - this.props.screenRectangle.left) /
      screenWidth;

    // --- Display area
    const dspLeft =
      this.props.screenRectangle.left -
      this.props.panelRectangle.left +
      zoom * borderLeftPixels;
    const dspTop =
      this.props.screenRectangle.top -
      this.props.panelRectangle.top +
      zoom * borderTopLines;
    const dspWidth = zoom * displayWidth + 1;
    const dspHeight = zoom * displayLines + 1;

    // --- Non-visible area
    const nvLeft =
      this.props.screenRectangle.left - this.props.panelRectangle.left;
    const nvTop =
      this.props.screenRectangle.top -
      this.props.panelRectangle.top -
      zoom * nonVisibleBorderTopLines +
      1;
    const nvWidth = zoom * (screenWidth + nonVisibleBorderRightTime * 2) + 1;
    const nvHeight =
      zoom *
        (screenHeight +
          nonVisibleBorderTopLines +
          nonVisibleBorderBottomLines) +
      1;

    // --- Sync area
    const synLeft = nvLeft;
    const synTop = nvTop - zoom * verticalSyncLines + 1;
    const synWidth = zoom * screenLineTime * 2;
    const synHeight = zoom * rasterLines;

    // --- Beam line
    const bmLine =
      synTop +
      zoom * (Math.floor(this.props.tactToDisplay / screenLineTime) + 1);
    const bmLeft = synLeft;
    const bmRight = synLeft + synWidth;
    const bmLineWidth = zoom;

    // --- Beam cross
    const bcPos =
      synLeft +
      zoom * 2 * Math.floor(this.props.tactToDisplay % screenLineTime);
    const bcTop = bmLine - 8;
    const bcBottom = bmLine + 8;
    const bcLineWidth = 2 * zoom;

    this.setState({
      dspLeft,
      dspTop,
      dspWidth,
      dspHeight,
      nvLeft,
      nvTop,
      nvWidth,
      nvHeight,
      synLeft,
      synTop,
      synWidth,
      synHeight,
      bmLine,
      bmLeft,
      bmRight,
      bmLineWidth,
      bcPos,
      bcTop,
      bcBottom,
      bcLineWidth,
      mounted: true,
    });
  }

  render() {
    return (
      <div className="beam-overlay">
        {this.state.mounted && (
          <svg width={this.props.width} height={this.props.height}>
            <rect
              x={this.state.dspLeft}
              y={this.state.dspTop}
              width={this.state.dspWidth}
              height={this.state.dspHeight}
              style={{ stroke: "none", fill: "rgba(255, 255, 255, 0.1)" }}
            />
            <rect
              x={this.state.nvLeft}
              y={this.state.nvTop}
              width={this.state.nvWidth}
              height={this.state.nvHeight}
              style={{ stroke: "none", fill: "rgba(255, 255, 255, 0.1)" }}
            />
            <rect
              x={this.state.synLeft}
              y={this.state.synTop}
              width={this.state.synWidth}
              height={this.state.synHeight}
              style={{ stroke: "none", fill: "rgba(255, 255, 255, 0.1)" }}
            />
            <line
              x1={this.state.bmLeft}
              y1={this.state.bmLine}
              x2={this.state.bmRight}
              y2={this.state.bmLine}
              style={{
                stroke: "rgb(255,0,128)",
                strokeWidth: this.state.bmLineWidth,
              }}
            />
            <line
              x1={this.state.bcPos}
              y1={this.state.bcTop}
              x2={this.state.bcPos}
              y2={this.state.bcBottom}
              style={{
                stroke: "rgba(255,0,128, 0.75)",
                strokeWidth: this.state.bcLineWidth,
              }}
            />
          </svg>
        )}
      </div>
    );
  }
}
