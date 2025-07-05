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
  
  // Calculate all values needed for both rendering paths
  const isValid = !!iconName;
  const isImageIcon = isValid && iconName.startsWith("@");
  
  // Calculate common style properties
  const commonStyle = useMemo(() => ({
    width: `${width}px`,
    height: `${height}px`,
    opacity,
    flexShrink: 0,
    flexGrow: 0,
    ...style
  }), [width, height, opacity, style]);
  
  // Get image information if it's an image icon
  const imageData = useMemo(() => {
    if (!isValid || !isImageIcon) return { imageName: "", imageInfo: null, imageSrc: "" };
    
    const imageName = iconName.substring(1) + 
      (theme.theme.tone === "light" ? "-light" : "");
    const imageInfo = theme.getImage(imageName);
    const imageSrc = `data:image/${imageInfo.type};base64,${imageInfo.data}`;
    
    return { imageName, imageInfo, imageSrc };
  }, [isValid, isImageIcon, iconName, theme]);
  
  // Get SVG information if it's an SVG icon
  const svgData = useMemo(() => {
    if (!isValid || isImageIcon) return { 
      iconInfo: { width: 24, height: 24, path: "", fill: "white", "fill-rule": "nonzero" as FillRule },
      viewBox: "0 0 24 24"
    };
    
    const iconInfo = theme.getIcon(iconName);
    const viewBox = `0 0 ${iconInfo.width} ${iconInfo.height}`;
    
    return { iconInfo, viewBox };
  }, [isValid, isImageIcon, iconName, theme]);
  
  // Calculate fill value for SVG icons
  const fillValue = useMemo(() => {
    if (!isValid || isImageIcon) return "white";
    
    if (fill === null || fill === undefined) {
      return svgData.iconInfo.fill ?? "white";
    }
    
    return fill.startsWith("--") 
      ? theme.getThemeProperty(fill) 
      : fill;
  }, [isValid, isImageIcon, fill, svgData.iconInfo.fill, theme]);

  // Early return for invalid icon name
  if (!isValid) {
    return null;
  }

  // Render image-based icons
  if (isImageIcon) {
    const imageStyle = {
      ...commonStyle,
      transform: rotate ? `rotate(${rotate}deg)` : undefined
    };
    
    return (
      <img
        className={xclass}
        src={imageData.imageSrc}
        alt={alt}
        style={imageStyle}
        data-testid={dataTestId}
      />
    );
  }

  // Render SVG icons
  const svgStyle = {
    ...commonStyle,
    fill: fillValue,
    fillOpacity: opacity,
    transform: `rotate(${rotate ?? 0}deg)`
  };
  
  return (
    <svg
      className={xclass}
      xmlns="http://www.w3.org/2000/svg"
      style={svgStyle}
      viewBox={svgData.viewBox}
      role="img"
      aria-hidden={!alt}
      aria-label={alt || undefined}
      data-testid={dataTestId}
    >
      <path
        d={svgData.iconInfo.path}
        fillRule={svgData.iconInfo["fill-rule"] as FillRule}
        clipRule={svgData.iconInfo["clip-rule"]}
      />
    </svg>
  );
});
