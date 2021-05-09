import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";

import styles from "styled-components";

const Root = styles.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  flex-shrink: 1;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background-color: var(--shell-canvas-background-color);
  border-top: 1px solid var(--panel-separator-border);
`;

interface Props {
  initialSize?: number;
}

interface State {}

/**
 * Represents the statusbar of the emulator
 */
class IdeOutputFrame extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      activeIndex: -1,
      pointedIndex: -1,
    };
  }

  render() {
    return <Root data-initial-size={this.props.initialSize}></Root>;
  }
}

export default connect((state: AppState) => {
  return {};
}, null)(IdeOutputFrame);
