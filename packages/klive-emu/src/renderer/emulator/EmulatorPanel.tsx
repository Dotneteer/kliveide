import * as React from "react";
import { connect } from "react-redux";
import ReactResizeDetector from "react-resize-detector";
import { AppState } from "../../shared/state/AppState";
import { VirtualMachineCoreBase } from "../machines/VirtualMachineCoreBase";
import { vmEngineService } from "../machines/vm-engine-service";

interface Props {
  executionState?: number;
}

interface State {
  canvasWidth: number;
  canvasHeight: number;
  shadowCanvasWidth: number;
  shadowCanvasHeight: number;
  hostRectangle?: DOMRect;
  screenRectangle?: DOMRect;
  overlay?: string;
  panelMessage?: string;
  overlayMessage?: string;
}

/**
 * Represents the display panel of the emulator
 */
class EmulatorPanel extends React.Component<Props, State> {
  private _hostElement: React.RefObject<HTMLDivElement>;
  private _screenElement: React.RefObject<HTMLCanvasElement>;
  private _shadowScreenElement: React.RefObject<HTMLCanvasElement>;
  private _engine: VirtualMachineCoreBase | null = null;

  private _imageBuffer: ArrayBuffer;
  private _imageBuffer8: Uint8Array;
  private _pixelData: Uint32Array;

  constructor(props: Props) {
    super(props);
    this._hostElement = React.createRef();
    this._screenElement = React.createRef();
    this._shadowScreenElement = React.createRef();
    this.state = {
      canvasWidth: 0,
      canvasHeight: 0,
      shadowCanvasWidth: 0,
      shadowCanvasHeight: 0,
    };
  }

  componentDidMount(): void {
    vmEngineService.vmEngineChanged.on(this.vmChange);
    this.calculateDimensions();
  }

  componentWillUnmount(): void {
    if (this._engine) {
      vmEngineService.screenRefreshed.off(this.handleScreenRefresh);
    }
    vmEngineService.vmEngineChanged.off(this.vmChange);
  }

  render() {
    return (
      <div ref={this._hostElement} className="emulator-panel">
        <div
          className="emulator-screen"
          style={{
            width: `${this.state.canvasWidth}px`,
            height: `${this.state.canvasHeight}px`,
          }}
        >
          <canvas
            ref={this._screenElement}
            width={this.state.canvasWidth}
            height={this.state.canvasHeight}
          />
          <canvas
            ref={this._shadowScreenElement}
            style={{ display: "none" }}
            width={this.state.canvasWidth}
            height={this.state.canvasHeight}
          />
        </div>
        <ReactResizeDetector
          handleWidth
          handleHeight
          onResize={this.handleResize}
        />
      </div>
    );
  }

  vmChange = () => {
    if (this._engine) {
      vmEngineService.screenRefreshed.off(this.handleScreenRefresh);
    }
    this._engine = vmEngineService.getEngine();
    if (this._engine) {
      vmEngineService.screenRefreshed.on(this.handleScreenRefresh);
    }
    this.calculateDimensions();
    this.configureSound();
    this.configureScreen();
  };

  handleScreenRefresh = () => {
    this.displayScreenData();
  };

  handleResize = () => {
    this.calculateDimensions();
  };

  // --- Calculate the dimensions so that the virtual machine display fits the screen
  calculateDimensions() {
    if (!this._hostElement || !vmEngineService.hasEngine) {
      return;
    }
    const clientWidth = this._hostElement.current.clientWidth;
    const clientHeight = this._hostElement.current.clientHeight;
    const width = vmEngineService.getEngine().screenWidth;
    const height = vmEngineService.getEngine().screenHeight;
    let widthRatio = Math.floor((clientWidth - 8) / width);
    if (widthRatio < 1) widthRatio = 1;
    let heightRatio = Math.floor((clientHeight - 8) / height);
    if (heightRatio < 1) heightRatio = 1;
    const ratio = Math.min(widthRatio, heightRatio);
    const canvasWidth = width * ratio;
    const canvasHeight = height * ratio;

    this._shadowScreenElement.current.width = width;
    this._shadowScreenElement.current.height = height;
    const shadowCanvasWidth = width;
    const shadowCanvasHeight = height;
    this.setState({
      canvasWidth,
      canvasHeight,
      shadowCanvasWidth,
      shadowCanvasHeight,
    });
    console.log(JSON.stringify(this.state, null, 2));
  }

  configureSound(): void {
    const audioCtx = new AudioContext();
    const sampleRate = audioCtx.sampleRate;
    audioCtx.close();
    if (vmEngineService.hasEngine) {
      vmEngineService.getEngine().setAudioSampleRate(sampleRate);
    }
  }

  // --- Setup the screen buffers
  configureScreen() {
    const dataLen =
      this.state.shadowCanvasWidth * this.state.shadowCanvasHeight * 4;
    console.log(dataLen);
    this._imageBuffer = new ArrayBuffer(dataLen);
    this._imageBuffer8 = new Uint8Array(this._imageBuffer);
    this._pixelData = new Uint32Array(this._imageBuffer);
  }

  // --- Displays the screen
  displayScreenData() {
    const executionState = this.props.executionState ?? 0;
    // --- Do not refresh after stopped state
    if (!executionState || executionState === 5) return;

    const screenEl = this._screenElement.current;
    const shadowScreenEl = this._shadowScreenElement.current;
    const shadowCtx = shadowScreenEl.getContext("2d");
    if (!shadowCtx) return;

    shadowCtx.imageSmoothingEnabled = false;
    const shadowImageData = shadowCtx.getImageData(
      0,
      0,
      shadowScreenEl.width,
      shadowScreenEl.height
    );
    const screenCtx = screenEl.getContext("2d");
    let j = 0;

    const screenData = this._engine.getScreenData();
    for (
      let i = 0;
      i < this.state.shadowCanvasWidth * this.state.shadowCanvasHeight;
      i++
    ) {
      this._pixelData[j++] = screenData[i];
    }
    shadowImageData.data.set(this._imageBuffer8);
    shadowCtx.putImageData(shadowImageData, 0, 0);
    if (screenCtx) {
      screenCtx.imageSmoothingEnabled = false;
      screenCtx.drawImage(
        shadowScreenEl,
        0,
        0,
        this.state.canvasWidth,
        this.state.canvasHeight
      );
    }
  }

  // --- Hide the display
  hideDisplayData() {
    const screenEl = this._screenElement.current;
    if (!screenEl) return;

    const screenCtx = screenEl.getContext("2d");
    if (screenCtx) {
      screenCtx.clearRect(0, 0, screenEl.width, screenEl.height);
    }
  }
}

export default connect((state: AppState) => {
  return {
    displayScreen: state.emuViewOptions,
    executionState: state.emulatorPanel.executionState,
  };
}, null)(EmulatorPanel);
