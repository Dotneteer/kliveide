import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";
import { SplitContainer } from "../common/SplitContainer";
import EmulatorPanel from "./EmulatorPanel";
import { emuStore } from "./emuStore";
import KeyboardPanel from "./KeyboardPanel";
import { vmEngineService } from "../machines/vm-engine-service";
import { emuKeyboardHeightAction } from "../../shared/state/emulator-panel-reducer";
import { animationTick } from "../common/utils";

interface Props {
  showKeyboard?: boolean;
  keyboardHeight?: string;
  type?: string;
}

interface State {
  delayToggle: boolean;
}

/**
 * Represents the main canvas of the emulator
 */
class MainPanel extends React.Component<Props, State> {
  private _lastShowKeyboard = false;
  private _delayIsOver = true;

  constructor(props: Props) {
    super(props);
    this.state = {
      delayToggle: true,
    };
  }

  render() {
    if (this._lastShowKeyboard !== this.props.showKeyboard) {
      this._lastShowKeyboard = this.props.showKeyboard;
      if (this._lastShowKeyboard) {
        this._delayIsOver = false;
        this.delayKeyboardDisplay();
      }
    }
    return (
      <div className="main-panel">
        <SplitContainer
          direction="vertical"
          refreshTag={!!this.props.showKeyboard}
          splitterMoved={this.handleMoved}
        >
          <EmulatorPanel />
          <KeyboardPanel
            initialHeight={this.props.keyboardHeight}
            type={this.props.type}
            showPanel={this._delayIsOver}
          />
        </SplitContainer>
      </div>
    );
  }

  handleMoved = (children: NodeListOf<HTMLDivElement>): void => {
    if (children.length > 0) {
      const height = children[children.length - 1].offsetHeight;
      emuStore.dispatch(emuKeyboardHeightAction(height));
    }
  };

  async delayKeyboardDisplay(): Promise<void> {
    await animationTick();
    await animationTick();
    this._delayIsOver = true;
    this.setState({ delayToggle: !this.state.delayToggle });
  }
}

export default connect((state: AppState) => {
  const type = vmEngineService.hasEngine
    ? vmEngineService.getEngine().keyboardType
    : null;
  return {
    showKeyboard: state.emuViewOptions.showKeyboard,
    keyboardHeight: state.emulatorPanel.keyboardHeight
      ? `${state.emulatorPanel.keyboardHeight}px`
      : undefined,
    type,
  };
}, null)(MainPanel);
