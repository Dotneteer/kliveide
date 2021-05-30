import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";
import { GutterDirection, SplitContainer } from "../common/SplitContainer";
import IdeDocumentsFrame from "./IdeDocumentsFrame";
import { animationTick } from "../common/utils";
import { createSizedStyledPanel } from "../common/PanelStyles";

const Root = createSizedStyledPanel({
  fitToClient: true,
  background: "var(--emulator-background-color)",
});

interface Props {
  direction: GutterDirection;
}

interface State {
  refreshKey: number;
}

/**
 * Represents the main canvas of the emulator
 */
class IdeDesk extends React.Component<Props, State> {
  static defaultProps: Props = {
    direction: "vertical",
  };

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
        <SplitContainer direction={this.props.direction} refreshTag={this.state.refreshKey}>
          <IdeDocumentsFrame />
          <IdeDocumentsFrame />
          <IdeDocumentsFrame initialSize={200} />
        </SplitContainer>
      </Root>
    );
  }
}

export default connect((state: AppState) => {
  return {};
}, null)(IdeDesk);
