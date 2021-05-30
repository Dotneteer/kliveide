import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";
import ActivityBar from "./ActivityBar";
import SideBar from "./SideBar";
import IdeMain from "./IdeMain";
import { SplitContainer } from "../common/SplitContainer";
import { animationTick } from "../common/utils";
import { createSizedStyledPanel } from "../common/PanelStyles";

const Root = createSizedStyledPanel({
  fitToClient: true,
  splitsVertical: false,
  others: {
    "background-color": "var(--emulator-background-color)",
  }
});

interface Props {}

interface State {
  refreshKey: number;
}

/**
 * Represents the main canvas of the emulator
 */
class IdeWorkbench extends React.Component<Props, State> {
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
        <ActivityBar />
        <SplitContainer direction="horizontal" refreshTag={this.state.refreshKey}>
          <SideBar />
          <IdeMain />
        </SplitContainer>
      </Root>
    );
  }
}

export default connect((state: AppState) => {
  return {};
}, null)(IdeWorkbench);
