import * as React from "react";
import { ISideBarHeader } from "../abstraction/side-bar";

import { createPanel, createSizedStyledPanel } from "../common/PanelStyles";
import { SvgIcon } from "../common/SvgIcon";

const Root = createSizedStyledPanel({
  height: 24,
  splitsVertical: false,
  fitToClient: false,
  others: {
    "border-bottom": "1px solid var(--panel-separator-border)",
    "align-items": "center",
    "padding-left": "4px",
    outline: "none",
  },
});

const Text = createPanel({
  color: "var(--sidebar-header-color)",
  "font-size": "0.8em",
  "font-weight": "600",
  "padding-left": "4px",
});

interface Props {
  expanded: boolean;
  clicked?: () => void;
}

interface State {
  focused: boolean;
}

/**
 * Represents the statusbar of the emulator
 */
export default class SideBarHeader extends React.Component<Props, State> {
  private _hostElement: React.RefObject<HTMLDivElement>;

  constructor(props: Props) {
    super(props);
    this.state = {
      focused: false,
    };
    this._hostElement = React.createRef();
  }

  render() {
    const borderStyle = this.state.focused ? "1px solid var(--toolbar-selected-border-color)" : "1px solid transparent";
    return (
      <Root
        ref={this._hostElement}
        onFocus={() => this.setState({ focused: true })}
        onBlur={() => this.setState({ focused: false })}
        onClick={() => this.props.clicked?.()}
        onKeyPress={this.handleKeyPress}
        tabIndex={0}
        style={{
          borderLeft: borderStyle,
          borderRight: borderStyle,
          borderTop: borderStyle,
          borderBottom: this.state.focused ? borderStyle : "1px solid var(--panel-separator-border)",
        }}
      >
        <SvgIcon
          iconName="chevron-right"
          width={16}
          height={16}
          rotate={this.props.expanded ? 90 : 0}
        ></SvgIcon>
        <Text>HELLO</Text>
      </Root>
    );
  }

  handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.code === "Enter" || e.code === "Space") {
      this.props.clicked?.();
    }
  }
}
