import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";

import styles from "styled-components";

const Root = styles.div`
  display: flex;
  flex-direction: column;
  flex-grow: 0;
  flex-shrink: 0;
  height: 100%;
  width: 192px;
  background-color: var(--sidebar-background-color);
  position: relative;
`;

interface Props {
}

interface State {
}

/**
 * Represents the statusbar of the emulator
 */
class SideBar extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      activeIndex: -1,
      pointedIndex: -1,
    };
  }

  render() {
    return (
      <Root data-initial-size={100}>
      </Root>
    );
  }

}

export default connect((state: AppState) => {
  return {
  };
}, null)(SideBar);
