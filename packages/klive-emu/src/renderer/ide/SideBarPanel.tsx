import * as React from "react";
import SideBarHeader from "./SideBarHeader";

interface State {
  expanded: boolean;
}

/**
 * Represents the statusbar of the emulator
 */
export default class SideBarPanel extends React.Component<{}, State> {
  constructor(props: {}) {
    super(props);
    this.state = {
      expanded: false,
    };
  }

  render() {
    return (
      <div className={this.state.expanded ? "expanded" : "collapsed"}>
        <SideBarHeader
          expanded={this.state.expanded}
          clicked={() =>
            this.setState({
              expanded: !this.state.expanded,
            })
          }
        />
        <div
          className="host-panel"
          style={{
            display: this.state.expanded ? "flex" : "none",
          }}
        >
          {this.props.children}
        </div>
      </div>
    );
  }
}
