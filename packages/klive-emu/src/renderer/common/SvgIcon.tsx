import * as React from "react";
import { themeService } from "../themes/theme-service";

/**
 * SvgIcon properties
 */
interface Props {
  /**
   * Name of the stock icon obtained from `themeService`
   */
  iconName: string;

  /**
   * Additional CSS class of the SVG icon
   */
  xclass?: string;

  /**
   * Icon width
   */
  width?: number;

  /**
   * Icon height
   */
  height?: number;

  /**
   * Icon fill color
   */
  fill?: string;

  /**
   * Rotation in degrees
   */
  rotate?: number;
}

/**
 * Represents an SVG icon from the stock
 */
export function SvgIcon(props: React.PropsWithChildren<Props>) {
  const fill = props.fill;
  const fillValue =
    fill === null || fill === undefined
      ? "white"
      : props.fill.startsWith("--")
      ? themeService.getProperty(fill)
      : fill;
  const styleValue = {
    width: `${
      props.width === undefined
        ? themeService.getProperty("--icon-default-size")
        : props.width
    }px`,
    height: `${
      props.height === undefined
        ? themeService.getProperty("--icon-default-size")
        : props.height
    }px`,
    fill: `${fillValue}`,
    transform: `rotate(${props.rotate ?? 0}deg)`,
  };
  const iconInfo = themeService.getIcon(props.iconName);
  return (
    <svg
      className={props.xclass}
      xmlns="http://www.w3.org/2000/svg"
      style={styleValue}
      viewBox={"0 0 " + iconInfo.width + " " + iconInfo.height}
    >
      {props.children}
      <path
        d={iconInfo.path}
        fillRule={iconInfo["fill-rule"] as any}
        clipRule={iconInfo["clip-rule"]}
      />
    </svg>
  );
}
