import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";

interface Props {
  type: string;
  visible?: boolean;
  initialHeight?: string;
  showPanel?: boolean;
  layout?: string;
}
/**
 * Represents the keyboard panel of the emulator
 */
class KeyboardPanel extends React.Component<Props> {
  private _showPanel: boolean;

  componentDidMount() {
    this._showPanel = this.props.showPanel ?? true;
  }

  render() {
    if (this.props.visible) {
      return (
        <div data-initial-size={this.props.initialHeight}
          className="keyboard-panel"
        >
          {this._showPanel && <div></div>}
        </div>
      );
    }
    return null;
  }
}

export default connect((state: AppState) => {
  return { visible: state.emuViewOptions.showKeyboard };
}, null)(KeyboardPanel);
