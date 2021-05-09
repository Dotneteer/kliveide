import * as React from "react";
import styles from "styled-components";

const Root = styles.div`
  position: relative;
  flex-shrink: 0;
  flex-grow: 0;
  height: 0;
  left: 8px;
  top: 8px;
  margin-right: 16px;
`;

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
    const Overlay = styles.span`
    display: inline-block;
    background-color: #404040;
    color: ${this.props.error ? "coral" : "lightgreen"};
    opacity: 0.9;
    padding: 2px 10px 4px 10px;
    border-radius: 4px;
    cursor: pointer;
  `;

    if (this.props.text) {
      return (
        <Root onClick={this.handleClick}>
          <Overlay title="Hide overlay (click to show again)">
            {this.props.text}
          </Overlay>
        </Root>
      );
    } else {
      return null;
    }
  }
}
