import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";
import { SplitContainer } from "../common/SplitContainer";
import IdeOutputFrame from "./IdeOutputFrame";
import { animationTick } from "../common/utils";
import styles from "styled-components";

const Root = styles.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  flex-shrink: 1;
  width: 100%;
  height: 100%;
  background-color: var(--emulator-background-color);
`;

interface Props {}

interface State {
  refreshKey: number;
}

/**
 * Represents the main canvas of the emulator
 */
class IdeDesk extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      refreshKey: 0,
    };
  }

  async componentDidMount(): Promise<void> {
    await animationTick();
    this.setState({
      refreshKey: 1,
    });
  }

  render() {
    return (
      <Root>
        <SplitContainer direction="vertical" refreshTag={this.state.refreshKey}>
          <IdeOutputFrame />
          <IdeOutputFrame initialSize={200} />
        </SplitContainer>
      </Root>
    );
  }
}

export default connect((state: AppState) => {
  return {};
}, null)(IdeDesk);
