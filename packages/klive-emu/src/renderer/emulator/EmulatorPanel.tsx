import { TouchBarScrubber } from "electron";
import * as React from "react";
import { connect } from "react-redux";
import ReactResizeDetector from "react-resize-detector";
import { AppState } from "../../shared/state/AppState";
import { VirtualMachineCoreBase } from "../machines/VirtualMachineCoreBase";
import {
  vmEngineService,
  VmStateChangedArgs,
} from "../machines/vm-engine-service";
import { BeamOverlay } from "./BeamOverlay";
import { ExecutionStateOverlay } from "./ExecutionStateOverlay";

interface Props {
  executionState?: number;
}

interface State {
  windowWidth: number;
  windowHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  shadowCanvasWidth: number;
  shadowCanvasHeight: number;
  hostRectangle?: DOMRect;
  screenRectangle?: DOMRect;
  overlay?: string;
  panelMessage?: string;
  showOverlay?: boolean;
  tactToDisplay?: number;
  calcCount: number;
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

  private _pressedKeys: Record<string, boolean> = {};

  constructor(props: Props) {
    super(props);
    this._hostElement = React.createRef();
    this._screenElement = React.createRef();
    this._shadowScreenElement = React.createRef();
    this.state = {
      windowWidth: 0,
      windowHeight: 0,
      canvasWidth: 0,
      canvasHeight: 0,
      shadowCanvasWidth: 0,
      shadowCanvasHeight: 0,
      overlay:
        "Not yet started. Press F5 to start or Ctrl+F5 to debug machine.",
      showOverlay: true,
      calcCount: 0
    };
  }

  async componentDidMount(): Promise<void> {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    vmEngineService.vmEngineChanged.on(this.vmChange);
    vmEngineService.executionStateChanged.on(this.executionStateChange);
    this.calculateDimensions();
  }

  componentWillUnmount(): void {
    if (this._engine) {
      vmEngineService.screenRefreshed.off(this.handleScreenRefresh);
      vmEngineService.vmEngineChanged.off(this.vmChange);
      vmEngineService.executionStateChanged.on(this.executionStateChange);
    }
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  render() {
    return (
      <div ref={this._hostElement} className="emulator-panel" tabIndex={-1}>
        <div
          className="emulator-screen"
          style={{
            width: `${this.state.canvasWidth}px`,
            height: `${this.state.canvasHeight}px`,
          }}
          onClick={() => this.setState({ showOverlay: true })}
        >
          {this.props.executionState === 3 && (
            <BeamOverlay
              key={this.state.calcCount}
              panelRectangle={this.state.hostRectangle}
              screenRectangle={this.state.screenRectangle}
              width={this.state.windowWidth}
              height={this.state.windowHeight}
              tactToDisplay={this.state.tactToDisplay}
            />
          )}
          {this.state.showOverlay && (
            <ExecutionStateOverlay
              text={
                this.state.panelMessage
                  ? this.state.panelMessage
                  : this.state.overlay
              }
              error={!!vmEngineService.vmEngineError}
              clicked={() => {
                this.setState({ showOverlay: false });
              }}
            />
          )}
          <canvas
            ref={this._screenElement}
            width={this.state.canvasWidth}
            height={this.state.canvasHeight}
          />
          <canvas
            ref={this._shadowScreenElement}
            style={{ display: "none" }}
            width={this.state.shadowCanvasWidth}
            height={this.state.shadowCanvasHeight}
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
    this.configureScreen();
  };

  executionStateChange = (args: VmStateChangedArgs) => {
    this.calculateDimensions();
    let overlay = "";
    switch (args.newState) {
      case 1:
        overlay = args.isDebug ? "Debug mode" : "";
        break;
      case 3:
        overlay = "Paused";
        const state = this._engine.getMachineState();
        this.setState({
          tactToDisplay: state.lastRenderedFrameTact % state.tactsInFrame,
        });
        this.displayScreenData();
        break;
      case 5:
        overlay = "Stopped";
        break;
      default:
        overlay = "";
        break;
    }
    this.setState({ overlay });
  };

  handleScreenRefresh = () => {
    this.displayScreenData();
  };

  handleResize = () => {
    this.calculateDimensions();
  };

  handleKeyDown = (e: KeyboardEvent) => {
    this.handleKey(e, true);
  };

  handleKeyUp = (e: KeyboardEvent) => {
    this.handleKey(e, false);
  };

  // --- Calculate the dimensions so that the virtual machine display fits the screen
  calculateDimensions() {
    if (!this._hostElement || !vmEngineService.hasEngine) {
      return;
    }
    const hostRectangle =this._hostElement.current.getBoundingClientRect();
    const screenRectangle = this._screenElement.current.getBoundingClientRect();
    const clientWidth = this._hostElement.current.offsetWidth;
    const clientHeight = this._hostElement.current.offsetHeight;
    const width = vmEngineService.getEngine().screenWidth;
    const height = vmEngineService.getEngine().screenHeight;
    let widthRatio = Math.floor((clientWidth - 8) / width);
    if (widthRatio < 1) widthRatio = 1;
    let heightRatio = Math.floor((clientHeight - 8) / height);
    if (heightRatio < 1) heightRatio = 1;
    const ratio = Math.min(widthRatio, heightRatio);
    const canvasWidth = width * ratio;
    const canvasHeight = height * ratio;

    const shadowCanvasWidth = width;
    const shadowCanvasHeight = height;
    this.setState({
      windowWidth: hostRectangle.width,
      windowHeight: hostRectangle.height,
      canvasWidth,
      canvasHeight,
      shadowCanvasWidth,
      shadowCanvasHeight,
      hostRectangle,
      screenRectangle,
      calcCount: this.state.calcCount + 1
    });
    this._shadowScreenElement.current.width = width;
    this._shadowScreenElement.current.height = height;
  }

  // --- Setup the screen buffers
  configureScreen() {
    const dataLen =
      this.state.shadowCanvasWidth * this.state.shadowCanvasHeight * 4;
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

  handleKey(e: KeyboardEvent, isDown: boolean): void {
    const executionState = this.props.executionState ?? 0;
    if (!e || executionState !== 1) return;

    // --- Special key: both Shift released
    if (
      (e.code === "ShiftLeft" || e.code === "ShiftRight") &&
      e.shiftKey === false &&
      !isDown
    ) {
      this.handleMappedKey("ShiftLeft", false);
      this.handleMappedKey("ShiftRight", false);
    } else {
      this.handleMappedKey(e.code, isDown);
    }
    if (isDown) {
      this._pressedKeys[e.code.toString()] = true;
    } else {
      delete this._pressedKeys[e.code.toString()];
    }
  }

  handleMappedKey(code: string, isDown: boolean) {
    if (this._engine) {
      this._engine.handlePhysicalKey(code, isDown);
    }
  }

  // --- Release all keys that remained pressed
  erasePressedKeys() {
    for (let code in this._pressedKeys) {
      this.handleMappedKey(code, false);
    }
    this._pressedKeys = {};
  }
}

export default connect((state: AppState) => {
  return {
    displayScreen: state.emuViewOptions,
    executionState: state.emulatorPanel.executionState,
  };
}, null)(EmulatorPanel);
