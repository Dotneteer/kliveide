import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";
import { createStyledPanel } from "../common/PanelStyles";

const Root = createStyledPanel({
  background: "var(--shell-canvas-background-color)",
  others: {
    overflow: "hidden",
    "border-top": "1px solid var(--panel-separator-border)"
  }
});

interface Props {
  initialSize?: number;
}

interface State {}

/**
 * Represents the statusbar of the emulator
 */
class IdeDocumentFrame extends React.Component<Props, State> {
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
}, null)(IdeDocumentFrame);
