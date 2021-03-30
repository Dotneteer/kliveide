import * as React from "react";
import { SvgIcon } from "./SvgIcon";

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
    return (
      <div
        className={`toolbar-button ${this.props.selected ? "selected" : ""}${
          this.props.enable ?? true ? "" : " disabled"
        }`}
        title={this.props.title}
        onMouseDown={(ev) => this.handleMouseDown(ev)}
        onMouseUp={this.handleMouseUp}
        onMouseLeave={this.handleMouseLeave}
        onClick={() => this.props?.clicked?.()}
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
      </div>
    );
  }

  handleMouseDown = (ev: React.MouseEvent) => {
    if (ev.button === 0) {
      this.updateSize(true);
    }
  };
  handleMouseUp = () => this.updateSize(false);
  handleMouseLeave = () => {
    if (!(this.props.enable ?? true)) {
      return;
    }
    this.updateSize(false);
  };

  updateSize(pointed: boolean) {
    this.setState({
      currentSize: pointed
        ? this.props.highlightSize ?? DEFAULT_HILITE_SIZE
        : this.props.size ?? DEFAULT_SIZE,
    });
  }
}
