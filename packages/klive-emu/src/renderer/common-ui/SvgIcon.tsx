import * as React from "react";
import { CSSProperties } from "react";
import { getThemeService } from "../../abstractions/service-helpers";

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

  /**
   * Additional style attributes
   */
  style?: CSSProperties;
}

/**
 * Represents an SVG icon from the stock
 */
export function SvgIcon({
  iconName,
  xclass,
  width,
  height,
  fill,
  rotate,
  style,
  children,
}: React.PropsWithChildren<Props>) {
  const themeService = getThemeService();
  const fillValue =
    fill === null || fill === undefined
      ? "white"
      : fill.startsWith("--")
      ? themeService.getProperty(fill)
      : fill;
  const styleValue: CSSProperties = {
    width: `${
      width === undefined
        ? themeService.getProperty("--icon-default-size")
        : width
    }px`,
    height: `${
      height === undefined
        ? themeService.getProperty("--icon-default-size")
        : height
    }px`,
    fill: `${fillValue}`,
    transform: `rotate(${rotate ?? 0}deg)`,
    flexShrink: 0,
    flexGrow: 0,
  };
  const iconInfo = themeService.getIcon(iconName);
  return (
    <svg
      className={xclass}
      xmlns="http://www.w3.org/2000/svg"
      style={{ ...styleValue, ...style }}
      viewBox={"0 0 " + iconInfo.width + " " + iconInfo.height}
    >
      {children}
      <path
        d={iconInfo.path}
        fillRule={iconInfo["fill-rule"] as any}
        clipRule={iconInfo["clip-rule"]}
      />
    </svg>
  );
}
