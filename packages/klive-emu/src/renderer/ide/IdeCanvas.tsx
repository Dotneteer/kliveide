import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";
import ActivityBar from "./ActivityBar";
import SideBar from "./SideBar";
import IdeMain from "./IdeMain";
import { SplitContainer } from "../common/SplitContainer";
import { animationTick } from "../common/utils";

interface Props {}

interface State {
  refreshKey: number;
}

/**
 * Represents the main canvas of the emulator
 */
class IdeCanvas extends React.Component<Props, State> {
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
      <div className="ide-main">
        <ActivityBar />
        <SplitContainer direction="horizontal" refreshTag={this.state.refreshKey}>
          <SideBar />
          <IdeMain />
        </SplitContainer>
      </div>
    );
  }
}

export default connect((state: AppState) => {
  return {};
}, null)(IdeCanvas);
