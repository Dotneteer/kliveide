import * as React from "react";
import { connect } from "react-redux";
import { emuKeyboardHeightAction } from "../../shared/state/emulator-panel-reducer";
import { AppState } from "../../shared/state/AppState";
import { SplitContainer } from "../common/SplitContainer";
import EmulatorPanel from "./EmulatorPanel";
import { emuStore } from "./emuStore";
import KeyboardPanel from "./KeyboardPanel";

interface Props {
  showKeyboard?: boolean;
  keyboardHeight?: string;
}

/**
 * Represents the main canvas of the emulator
 */
class MainPanel extends React.Component<Props> {
  render() {
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
            type="sp48"
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
}

export default connect((state: AppState) => {
  return {
    showKeyboard: state.emuViewOptions.showKeyboard,
    keyboardHeight: state.emulatorPanel?.keyboardHeight
      ? `${state.emulatorPanel?.keyboardHeight}px`
      : undefined,
  };
}, null)(MainPanel);
