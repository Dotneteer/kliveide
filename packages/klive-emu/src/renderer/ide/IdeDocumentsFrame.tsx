import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";
import { createSizedStyledPanel } from "../common/PanelStyles";
import { GutterDirection } from "../common/SplitContainer";
import DocumentTabBar from "./DocumentTabBar";

const Root = createSizedStyledPanel({
  background: "var(--shell-canvas-background-color)",
  others: {
    "border-top": "1px solid var(--panel-separator-border)",
    "border-right": "1px solid var(--panel-separator-border)",
  },
});

const PlaceHolder = createSizedStyledPanel({});

interface Props {
  initialSize?: number;
  direction: GutterDirection;
}

interface State {}

/**
 * Represents the statusbar of the emulator
 */
class IdeDocumentFrame extends React.Component<Props, State> {
  static defaultProps: Props = {
    direction: "vertical",
  };
  constructor(props: Props) {
    super(props);
    this.state = {
      activeIndex: -1,
      pointedIndex: -1,
    };
  }

  render() {
    return (
      <Root data-initial-size={this.props.initialSize}>
        <DocumentTabBar />
        <PlaceHolder />
      </Root>
    );
  }
}

export default connect((state: AppState) => {
  return {};
}, null)(IdeDocumentFrame);
