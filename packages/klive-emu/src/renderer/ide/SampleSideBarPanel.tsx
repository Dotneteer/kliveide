import * as React from "react";
import { createSizedStyledPanel } from "../common/PanelStyles";
import { ISideBarPanel, SideBarPanelDescriptorBase } from "./side-bar/SideBarService";

interface Props {
  color: string;
  descriptor: ISideBarPanel;
}

interface State {
  count: number;
}

/**
 * A sample side bar panel
 */
export default class SampleSideBarPanel extends React.Component<Props, State> {
  static defaultProps = {
    color: "blue",
  };

  private _hostElement: React.RefObject<HTMLDivElement>;

  constructor(props: Props) {
    super(props);
    this.state = {
      count: this.props.descriptor.getPanelState().count ?? 0,
    };
    this._hostElement = React.createRef();
  }

  /**
   * Gets the height of the panel
   * @returns Panel height
   */
  getHeight(): number {
    return this._hostElement?.current?.offsetHeight ?? 0;
  }

  render() {
    const PlaceHolder = createSizedStyledPanel({
      others: {
        border: `4px dotted ${this.props.color}`,
      },
    });
    return (
      <PlaceHolder
        onClick={() => {
          const count = this.state.count + 1;
          this.setState({ count });
          this.props.descriptor.setPanelState({ count });
        }}
        ref={this._hostElement}
      >
        {this.state.count}
      </PlaceHolder>
    );
  }
}

/**
 * Descriptor for the sample side bar panel
 */
export class SampleSideBarPanelDescriptor
  extends SideBarPanelDescriptorBase
{
  private _hostElement: React.RefObject<SampleSideBarPanel>;

  constructor(
    public readonly title: string,
    public readonly color: string
  ) {
    super(title);
    this._hostElement = React.createRef();
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return (
      <SampleSideBarPanel ref={this._hostElement} color={this.color} descriptor={this} />
    );
  }

  /**
   * Gets the current height of the content element
   */
  getContentsHeight(): number {
    return this._hostElement.current.getHeight();
  }
}
