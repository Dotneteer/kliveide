import * as React from "react";
import { SvgIcon } from "./SvgIcon";
import styles from "styled-components";
import { animationTick } from "./utils";

const DEFAULT_SIZE = 22;
const DEFAULT_HILITE_SIZE = 28;

interface Props {
  iconName: string;
  size?: number;
  highlightSize?: number;
  title?: string;
  fill?: string;
  enable?: boolean;
  selected?: boolean;
  clicked?: () => void;
}

interface State {
  currentSize: number;
}

/**
 * Represents the statusbar of the emulator
 */
export class ToolbarIconButton extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      currentSize: props.size ?? DEFAULT_SIZE,
    };
  }

  render() {
    const Root = styles.div`
      display: flex;
      width: 36px;
      height: 36px;
      padding: 4px 4px;
      margin: 0px 0px;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border: 1px solid transparent;
      ${
        this.props.selected
          ? `
          border: 2px solid var(--toolbar-selected-border-color);
          `
          : ``
      }
      ${this.props.enable ?? true ? "" : `cursor: default;`}
    `;

    return (
      <Root
        title={this.props.title}
        onMouseDown={(ev) => this.handleMouseDown(ev)}
        onMouseUp={this.handleMouseUp}
        onMouseLeave={this.handleMouseLeave}
      >
        <SvgIcon
          iconName={this.props.iconName}
          fill={
            this.props.enable ?? true
              ? this.props.fill
              : "--toolbar-button-disabled-fill"
          }
          width={this.state.currentSize}
          height={this.state.currentSize}
        />
      </Root>
    );
  }

  handleMouseDown = (ev: React.MouseEvent) => {
    if (ev.button === 0) {
      this.updateSize(true);
    }
  };
  handleMouseUp = () => {
    this.updateSize(false);
    this.props?.clicked?.()
  };
  handleMouseLeave = () => {
    if (!(this.props.enable ?? true)) {
      return;
    }
    this.updateSize(false);
  };

  updateSize(pointed: boolean) {
    animationTick();
    this.setState({
      currentSize: pointed
        ? this.props.highlightSize ?? DEFAULT_HILITE_SIZE
        : this.props.size ?? DEFAULT_SIZE,
    });
  }
}
