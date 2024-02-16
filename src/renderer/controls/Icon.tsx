import { useTheme } from "@renderer/theming/ThemeProvider";
import { CSSProperties } from "react";

type Props = {
  iconName: string;
  xclass?: string;
  width?: number;
  height?: number;
  fill?: string;
  rotate?: number;
  style?: CSSProperties;
  opacity?: number;
};

/**
 * Represents an SVG icon from the stock
 */
export const Icon = ({
  iconName,
  xclass,
  width = 24,
  height = 24,
  fill,
  rotate,
  style,
  opacity = 1.0
}: Props) => {
  const theme = useTheme();

  if (iconName) {
    const iconInfo = theme.getIcon(iconName);
    const fillValue =
      fill === null || fill === undefined
        ? iconInfo.fill ?? "white"
        : fill.startsWith("--")
        ? theme.getThemeProperty(fill)
        : fill;
    const styleValue: CSSProperties = {
      width: `${width}px`,
      height: `${height}px`,
      fill: `${fillValue}`,
      fillOpacity: opacity,
      transform: `rotate(${rotate ?? 0}deg)`,
      flexShrink: 0,
      flexGrow: 0
    };

    if (iconName?.startsWith("@")) {
      const imageInfo = theme.getImage(
        iconName.substring(1) + (theme.theme.tone === "light" ? "-light" : "")
      );
      return (
        <img
          className={xclass}
          src={`data:image/${imageInfo.type};base64,${imageInfo.data}`}
          style={{ ...styleValue, ...style, opacity }}
        />
      );
    }

    return (
      <svg
        className={xclass}
        xmlns='http://www.w3.org/2000/svg'
        style={{ ...styleValue, ...style }}
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
  return null;
};
