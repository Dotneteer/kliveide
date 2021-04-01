import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";
import { vmEngineStore } from "./vm-engine-store";

interface Props {
}

interface State {
  canvasWidth: number;
  canvasHeight: number;
  screenWidth: number;
  screenHeight: number;
  hostRectangle: DOMRect;
  screenRectangle: DOMRect;
  overlay: string;
  panelMessage: string;
  overlayMessage: string;
}

/**
 * Represents the display panel of the emulator
 */
class EmulatorPanel extends React.Component<Props, State> {
  private _hostElement: React.RefObject<HTMLDivElement>;
  private _screenElement: React.RefObject<HTMLCanvasElement>;
  private _shadowScreenElement: React.RefObject<HTMLCanvasElement>;

  constructor(props: Props) {
    super(props);
    this._hostElement = React.createRef();
    const store = vmEngineStore;
  }

  componentDidMount() {
    console.log("Mounted");
    this._hostElement.current.getBoundingClientRect();
  }

  render() {
    return (
      <div ref={this._hostElement} className="emulator-panel">
        <div className="emulator-screen">
          <canvas ref={this._screenElement} />
          <canvas ref={this._shadowScreenElement} style={{ display: "none" }} />
        </div>
      </div>
    );
  }
}

export default connect((state: AppState) => {
  return { displayScreen: state.emuViewOptions };
}, null)(EmulatorPanel);

