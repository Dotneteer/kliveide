import * as React from "react";
import SideBarHeader from "./SideBarHeader";
import { ISideBarPanel } from "./SideBarService";

/**
 * Component properties
 */
interface Props {
  descriptor: ISideBarPanel;
  sizeable: boolean;
  visibilityChanged: () => void;
}

/**
 * Component state
 */
interface State {
  expanded: boolean;
}

/**
 * Represents a panel of the side bar
 */
export default class SideBarPanel extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      expanded: this.props.descriptor.expanded,
    };
  }

  /**
   * A side bar panel is composed from a header and a content panel. The header
   * allows expanding or collapsing the panel, and provides a resizing grip.
   */
  render() {
    return (
      <div className={this.state.expanded ? "expanded" : "collapsed"}>
        <SideBarHeader
          title={this.props.descriptor.title}
          expanded={this.state.expanded}
          sizeable={this.props.sizeable}
          clicked={() => {
            const expanded = !this.state.expanded;
            this.setState({ expanded });
            this.props.descriptor.expanded = expanded;
            this.props.visibilityChanged();
          }}
        />
        <div
          className="host-panel"
          style={{
            display: this.state.expanded ? "flex" : "none",
          }}
        >
          {this.props.descriptor.createContentElement()}
        </div>
      </div>
    );
  }
}
