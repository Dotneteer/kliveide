import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";
import ReactResizeDetector from "react-resize-detector";
import Sp48Keyboard from "./Sp48Keyboard";
import Cz88Keyboard from "./Cz88Keyboard";
import { animationTick } from "../common/utils";
import styles from "styled-components";

const Root = styles.div`
  display: flex;
  overflow: hidden;
  flex-shrink: 1;
  flex-grow: 1;
  height: 100%;
  background-color: var(--keyboard-background-color);
  padding: 16px 12px 8px 12px;
  box-sizing: border-box;
  align-content: start;
  justify-items: start;
  justify-content: center;
`;

interface Props {
  type: string;
  visible?: boolean;
  showPanel: boolean;
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
    let keyboard = null;
    switch (this.props.type) {
      case "sp48":
        keyboard = (
          <Sp48Keyboard width={this.state.width} height={this.state.height} />
        );
        break;
      case "cz88":
        keyboard = (
          <Cz88Keyboard
            width={this.state.width}
            height={this.state.height}
            layout={this.props.layout}
          />
        );
    }
    if (this.props.visible) {
      return (
        <Root
          data-initial-size={this.props.initialHeight}
          ref={this._hostElement}
        >
          {this.props.showPanel && keyboard}
          <ReactResizeDetector
            handleWidth
            handleHeight
            onResize={this.handleResize}
          />
        </Root>
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
  return {
    visible: state.emuViewOptions.showKeyboard,
    layout: state.emulatorPanel.keyboardLayout,
  };
}, null)(KeyboardPanel);
