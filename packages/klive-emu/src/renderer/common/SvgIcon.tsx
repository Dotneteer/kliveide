import * as React from "react";
import { themeStore } from "../themes/theme-store";

interface Props {
  iconName: string;
  xclass?: string;
  width?: number;
  height?: number;
  fill?: string;
  rotate?: number;
}

/**
 * Represents the statusbar of the emulator
 */
export class SvgIcon extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const fill = this.props.fill;
    const fillValue =
      fill === null || fill === undefined
        ? "white"
        : this.props.fill.startsWith("--")
        ? themeStore.getProperty(fill)
        : fill;
    const styleValue = {
      width: `${
        this.props.width === undefined
          ? themeStore.getProperty("--icon-default-size")
          : this.props.width
      }px`,
      height: `${
      this.props.height === undefined
        ? themeStore.getProperty("--icon-default-size")
        : this.props.height
    }px`,
      fill: `${fillValue}`,
      transform: `rotate(${this.props.rotate ?? 0}deg)`,
    };
    const iconInfo = themeStore.getIcon(this.props.iconName);
    return (
      <svg
        className={this.props.xclass}
        xmlns="http://www.w3.org/2000/svg"
        style={styleValue}
        viewBox={"0 0 " + iconInfo.width + " " + iconInfo.height}
      >
        <path
          d={iconInfo.path}
          fillRule={iconInfo["fill-rule"] as any}
          clipRule={iconInfo["clip-rule"]}
        />
      </svg>
    );
  }
}
