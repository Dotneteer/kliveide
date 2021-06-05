import * as React from "react";

import { createPanel, createSizedStyledPanel } from "../../common/PanelStyles";
import { SvgIcon } from "../../common/SvgIcon";
import styles from "styled-components";

const Root = createSizedStyledPanel({
  height: 24,
  fitToClient: false,
  others: {
    "border-bottom": "1px solid var(--panel-separator-border)",
    outline: "none",
  },
});

const Caption = createSizedStyledPanel({
  splitsVertical: false,
  others: {
    "align-items": "center",
    "padding-left": "4px",
  },
});

const Text = createPanel({
  color: "var(--sidebar-header-color)",
  "font-size": "0.8em",
  "font-weight": "600",
  "padding-left": "4px",
});

interface Props {
  title: string;
  expanded: boolean;
  sizeable: boolean;
  clicked?: () => void;
}

interface State {
  focused: boolean;
  pointed: boolean;
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
      pointed: false,
    };
    this._hostElement = React.createRef();
  }

  render() {
    const Grip = styles.div`
      display: relative;
      top: 4px;
      left: 0px;
      height: 6px;
      width: 100%;
      background: ${
        this.state.pointed
          ? "var(--toolbar-selected-border-color)"
          : "transparent"
      };
      cursor: ns-resize;
    `;
    const borderStyle = this.state.focused
      ? "2px solid var(--toolbar-selected-border-color)"
      : "2px solid transparent";

    const gripElement: React.RefObject<HTMLDivElement> = React.createRef();
    return (
      <Root
        ref={this._hostElement}
        onFocus={() => this.setState({ focused: true })}
        onBlur={() => this.setState({ focused: false })}
        onKeyPress={this.handleKeyPress}
        tabIndex={0}
        style={{
          borderLeft: borderStyle,
          borderRight: borderStyle,
          borderTop: borderStyle,
          borderBottom: this.state.focused
            ? borderStyle
            : "1px solid var(--panel-separator-border)",
        }}
      >
        {this.props.sizeable && (
          <Grip ref={gripElement}
            onMouseEnter={() => {
              this.setState({ pointed: true });
            }}
            onMouseLeave={() => {
              this.setState({ pointed: false });
            }}
            onMouseDown={() => {
              gripElement.current.requestPointerLock();
            }}
            onMouseUp={() => {
              document.exitPointerLock();
            }}
            onMouseMove={(e) => {
              console.log(e.clientX, e.clientY);
            }}
          />
        )}
        <Caption onClick={() => this.props.clicked?.()}>
          <SvgIcon
            iconName="chevron-right"
            width={16}
            height={16}
            rotate={this.props.expanded ? 90 : 0}
          ></SvgIcon>
          <Text>
            {this.props.title.toUpperCase()}({this.props.sizeable.toString()})
          </Text>
        </Caption>
      </Root>
    );
  }

  handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.code === "Enter" || e.code === "Space") {
      this.props.clicked?.();
    }
  };
}
