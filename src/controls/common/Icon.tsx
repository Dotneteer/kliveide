import { useTheme } from "@/theming/ThemeProvider";
import { CSSProperties } from "react";

type Props = {
    iconName: string;
    xclass?: string;
    width?: number;
    height?: number;
    fill?: string;
    rotate?: number;
    style?: CSSProperties;
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
        transform: `rotate(${rotate ?? 0}deg)`,
        flexShrink: 0,
        flexGrow: 0,
      };
      return (
        <svg
          className={xclass}
          xmlns="http://www.w3.org/2000/svg"
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
  