import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";
import ReactResizeDetector from "react-resize-detector";
import Sp48Keyboard from "./Sp48Keyboard";
import { animationTick } from "../common/utils";

interface Props {
  type: string;
  visible?: boolean;
  initialHeight?: string;
  layout?: string;
}

interface State {
  width: number;
  height: number;
}

/**
 * Represents the keyboard panel of the emulator
 */
class KeyboardPanel extends React.Component<Props, State> {
  private _hostElement: React.RefObject<HTMLDivElement>;

  constructor(props: Props) {
    super(props);
    this._hostElement = React.createRef();
    this.state = {
      width: 0,
      height: 0,
    };
  }

  render() {
    if (this.props.visible) {
      return (
        <div
          className="keyboard-panel"
          data-initial-size={this.props.initialHeight}
          ref={this._hostElement}
        >
          <Sp48Keyboard width={this.state.width} height={this.state.height} />
          <ReactResizeDetector
            handleWidth
            handleHeight
            onResize={this.handleResize}
          />
        </div>
      );
    }
    return null;
  }

  handleResize = async () => {
    await animationTick();
    if (this._hostElement?.current) {
      this.setState({
        width: this._hostElement.current.offsetWidth,
        height: this._hostElement.current.offsetHeight,
      });
    }
  };
}

export default connect((state: AppState) => {
  return { visible: state.emuViewOptions.showKeyboard };
}, null)(KeyboardPanel);
