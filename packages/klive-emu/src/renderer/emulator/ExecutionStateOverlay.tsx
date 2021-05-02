import * as React from "react";

interface Props {
  text: string;
  error: boolean;
  clicked?: () => void;
}

/**
 * Represents the overlay of the emulator's panel
 */
export default class ExecutionStateOverlay extends React.Component<Props> {
  handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    this.props.clicked?.();
  };

  render() {
    if (this.props.text) {
      return (
        <div className="play-overlay" onClick={this.handleClick}>
          <span
            className={
              "overlay-text" + (this.props.error ? "overlay-error" : "")
            }
            title="Hide overlay (click to show again)"
          >
            {this.props.text}
          </span>
        </div>
      );
    } else {
      return null;
    }
  }
}
