import React, { CSSProperties } from "react";
import { iconLibrary } from "../theming/icon-defs";
import { imageLibrary } from "../theming/image-defs";
import type { IconInfo } from "../abstractions/IconInfo";
import type { ImageInfo } from "../abstractions/ImageInfo";

/**
 * Properties for the Icon component
 */
type IconProps = {
  /** 
   * The name of the icon or image to display.
   * If name starts with "@", the remaining part is an image name; otherwise, it is an icon name.
   */
  name: string;
  
  /** Fallback icon or image name to use if the primary one is not found */
  fallback?: string;
  
  /** Optional CSS class name */
  className?: string;
  
  /** Icon width in pixels (default: 24) */
  width?: number;
  
  /** Icon height in pixels (default: 24) */
  height?: number;
  
  /** Fill color for SVG icons */
  fill?: string;
  
  /** Rotation angle in degrees */
  rotate?: number;
  
  /** Additional inline styles */
  style?: CSSProperties;
  
  /** Opacity value (0-1) */
  opacity?: number;
  
  /** Rest of props to be passed to the underlying element */
  [key: string]: any;
};

/**
 * Icon component that displays either an SVG icon or PNG image
 */
const Icon: React.FC<IconProps> = ({
  name,
  fallback,
  className = "",
  width = 24,
  height = 24,
  fill,
  rotate,
  style = {},
  opacity,
  ...rest
}) => {
  // --- Find resource based on name or fallback
  const getResource = (resourceName: string) => {
    if (!resourceName) return null;
    
    const isImg = resourceName.startsWith("@");
    const actualName = isImg ? resourceName.substring(1) : resourceName;
    
    return isImg
      ? { type: "image", resource: imageLibrary.find(img => img.name === actualName) }
      : { type: "icon", resource: iconLibrary.find(icon => icon.name === actualName) };
  };
  
  // --- Try to find the resource in order: name → fallback → unknown icon
  let result = getResource(name);
  
  if (!result?.resource && fallback) {
    result = getResource(fallback);
  }
  
  if (!result?.resource) {
    result = { type: "icon", resource: iconLibrary.find(icon => icon.name === "unknown") ||
                            iconLibrary.find(icon => icon.name === "empty-icon") };
  }
  
  // --- Combined style with conditional properties
  const combinedStyle: CSSProperties = {
    ...style,
    ...(rotate && { transform: `rotate(${rotate}deg)` }),
    ...(opacity !== undefined && { opacity }),
  };

  // --- Render the appropriate element based on resource type
  if (result?.type === "image" && result.resource) {
    const image = result.resource as ImageInfo;
    return (
      <img
        src={`data:image/${image.type};base64,${image.data}`}
        className={className}
        width={width}
        height={height}
        style={combinedStyle}
        alt={name.startsWith("@") ? name.substring(1) : name}
        {...rest}
      />
    );
  } else if (result?.type === "icon" && result.resource) {
    const icon = result.resource as IconInfo;
    return (
      <svg
        className={className}
        width={width}
        height={height}
        viewBox={`0 0 ${icon.width} ${icon.height}`}
        style={combinedStyle}
        fill={fill || "currentColor"}
        xmlns="http://www.w3.org/2000/svg"
        {...rest}
      >
        <path d={icon.path} />
      </svg>
    );
  }
  
  return null;
};

export default Icon;