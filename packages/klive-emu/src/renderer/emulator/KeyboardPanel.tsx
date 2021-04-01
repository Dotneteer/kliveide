import * as React from "react";

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
export class KeyboardPanel extends React.Component<Props> {
  private _visible: boolean;
  private _initialHeight: string;
  private _showPanel: boolean;

  constructor(props: Props) {
    super(props);
  }

  componentDidMount() {
    this._visible = this.props.visible ?? true;
    this._initialHeight = this.props.initialHeight ?? "50%";
    this._showPanel = this.props.showPanel ?? true;
  }

  render() {
    if (this._visible) {
      return (
        <div className="keyboard-panel">{this._showPanel && <div></div>}</div>
      );
    }
    return null;
  }
}
