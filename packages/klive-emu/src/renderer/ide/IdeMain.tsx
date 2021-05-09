import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";
import IdeDesk from "./IdeDesk";
import styles from "styled-components";

const Root = styles.div`
  height: 100%;
  width: 100%;
  overflow: hidden;
  z-index: 10;
  outline: none;
`;

interface Props {
}

interface State {
}

/**
 * Represents the statusbar of the emulator
 */
class IdeMain extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      activeIndex: -1,
      pointedIndex: -1,
    };
  }

  render() {
    return (
      <Root>
        <IdeDesk />
      </Root>
    );
  }

}

export default connect((state: AppState) => {
  return {
  };
}, null)(IdeMain);
