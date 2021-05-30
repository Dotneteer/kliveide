import * as React from "react";
import { ISideBarPanel, ISideBarPanelHost } from "../abstraction/side-bar";
import { createSizedStyledPanel } from "../common/PanelStyles";

interface Props {
  id: number;
  host: ISideBarPanelHost;
  color: string;
}

interface State {
  expanded: boolean;
  count: number;
}

export default class SampleSideBarPanel
  extends React.Component<Props, State>
  implements ISideBarPanel
{
  static defaultProps = {
    color: "blue",
  };

  private _hostElement: React.RefObject<HTMLDivElement>;

  constructor(props: Props) {
    super(props);
    this.state = {
      expanded: false,
      count: 0,
    };
    this._hostElement = React.createRef();
  }

  componentDidMount(): void {
    if (!this.props.host) {
      throw new Error("ISideBarPanelHost is not defined.");
    }
    this.props.host.registerPanel(this.props.id, this);
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

  // --------------------------------------------------------------------------
  // ISideBarPanel implementation
  // --------------------------------------------------------------------------

  /**
   * The title of the side bar panel
   */
  get title(): string {
    return `Hello ${this.props.color}`;
  }

  /**
   * The DIV element that represents the contents of the panel
   */
  get element(): HTMLDivElement {
    return this._hostElement.current;
  }

  /**
   * Sets the expanded flag of the side bar panel
   * @param expanded
   */
  setExpanded(expanded: boolean): void {
    this.setState({
      expanded,
    });
  }
}
