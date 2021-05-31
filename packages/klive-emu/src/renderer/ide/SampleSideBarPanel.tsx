import * as React from "react";
import { createSizedStyledPanel } from "../common/PanelStyles";
import { ISideBarPanel } from "./side-bar/SideBarService";

interface Props {
  id: number;
  color: string;
}

interface State {
  count: number;
}

export default class SampleSideBarPanel extends React.Component<Props, State> {
  static defaultProps = {
    color: "blue",
  };

  private _hostElement: React.RefObject<HTMLDivElement>;

  constructor(props: Props) {
    super(props);
    this.state = {
      count: 0,
    };
    this._hostElement = React.createRef();
  }

  render() {
    const PlaceHolder = createSizedStyledPanel({
      others: {
        border: `4px dotted ${this.props.color}`,
      },
    });
    return (
      <PlaceHolder
        onClick={() => this.setState({ count: this.state.count + 1 })}
        ref={this._hostElement}
      >
        {this.state.count}
      </PlaceHolder>
    );
  }
}

export class SampleSideBarPanelDescriptor implements ISideBarPanel {
  constructor(
    public readonly id: number,
    public readonly title: string,
    public readonly color: string
  ) {
    this.expanded = false;
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <SampleSideBarPanel id={this.id} color={this.color} />;
  }

  /**
   * Gets the current height of the content element
   */
  getContentsHeight(): number {
    return 0;
  }

  /**
   * Signs if the specified panel is expanded
   * @param expanded
   */
  expanded: boolean;
}
