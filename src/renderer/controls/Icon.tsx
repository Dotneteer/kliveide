import { useTheme } from "@renderer/theming/ThemeProvider";
import { CSSProperties, memo, useMemo } from "react";

/**
 * Properties for the Icon component
 */
interface IconProps {
  /** Name of the icon to display from the theme's icon collection */
  iconName: string;
  /** Optional CSS class to apply to the icon */
  xclass?: string;
  /** Width of the icon in pixels (default: 24) */
  width?: number;
  /** Height of the icon in pixels (default: 24) */
  height?: number;
  /** Fill color for the icon. Can be a CSS color or a theme variable prefixed with -- */
  fill?: string;
  /** Rotation angle in degrees */
  rotate?: number;
  /** Additional inline styles to apply */
  style?: CSSProperties;
  /** Opacity of the icon (0.0 - 1.0) */
  opacity?: number;
  /** Alternative text for the icon (for accessibility) */
  alt?: string;
  /** For testing purposes */
  "data-testid"?: string;
}

// Type for SVG fill-rule attribute
type FillRule = "nonzero" | "evenodd" | "inherit";

/**
 * Represents an SVG icon from the theme's icon collection or an image
 */
export const Icon = memo(({
  iconName,
  xclass,
  width = 24,
  height = 24,
  fill,
  rotate,
  style,
  opacity = 1.0,
  alt = "",
  "data-testid": dataTestId = "icon"
}: IconProps) => {
  const theme = useTheme();

  // Early return for invalid icon name
  if (!iconName) {
    return null;
  }

  // Handle image-based icons (prefixed with @)
  if (iconName.startsWith("@")) {
    // Get image info from the theme
    const imageNameWithTone = iconName.substring(1) + 
      (theme.theme.tone === "light" ? "-light" : "");
    const imageInfo = theme.getImage(imageNameWithTone);
    
    // Memoize style calculation
    const imageStyle = useMemo(() => ({
      width: `${width}px`,
      height: `${height}px`,
      opacity,
      transform: rotate ? `rotate(${rotate}deg)` : undefined,
      flexShrink: 0,
      flexGrow: 0,
      ...style
    }), [width, height, opacity, rotate, style]);

    const imageSrc = `data:image/${imageInfo.type};base64,${imageInfo.data}`;
    
    return (
      <img
        className={xclass}
        src={imageSrc}
        alt={alt}
        style={imageStyle}
        data-testid={dataTestId}
      />
    );
  }

  // Handle SVG icons
  const iconInfo = theme.getIcon(iconName);
  
  // Compute fill value based on priority: 
  // 1. Provided fill (theme variable or direct color)
  // 2. Icon's default fill
  // 3. Fallback to white
  const fillValue = useMemo(() => {
    if (fill === null || fill === undefined) {
      return iconInfo.fill ?? "white";
    }
    
    return fill.startsWith("--") 
      ? theme.getThemeProperty(fill) 
      : fill;
  }, [fill, iconInfo.fill, theme]);
  
  // Memoize style calculation
  const svgStyle = useMemo(() => ({
    width: `${width}px`,
    height: `${height}px`,
    fill: fillValue,
    fillOpacity: opacity,
    transform: `rotate(${rotate ?? 0}deg)`,
    flexShrink: 0,
    flexGrow: 0,
    ...style
  }), [width, height, fillValue, opacity, rotate, style]);

  // Viewbox dimensions based on icon info
  const viewBox = `0 0 ${iconInfo.width} ${iconInfo.height}`;
  
  return (
    <svg
      className={xclass}
      xmlns="http://www.w3.org/2000/svg"
      style={svgStyle}
      viewBox={viewBox}
      role="img"
      aria-hidden={!alt}
      aria-label={alt || undefined}
      data-testid={dataTestId}
    >
      <path
        d={iconInfo.path}
        fillRule={iconInfo["fill-rule"] as FillRule}
        clipRule={iconInfo["clip-rule"]}
      />
    </svg>
  );
});
