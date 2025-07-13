import React from 'react'
import styles from './ClickableImage.module.scss'

/**
 * ClickableImage Props Interface
 * @interface ClickableImageProps
 * @property {string} src - The image source URL
 * @property {string} alt - Alternative text for the image
 * @property {string|number} [width] - Width of the image (can be in pixels or any valid CSS unit)
 * @property {string|number} [height] - Height of the image (can be in pixels or any valid CSS unit)
 * @property {string} [className] - Additional CSS class names
 * @property {React.CSSProperties} [style] - Inline CSS styles
 */
interface ClickableImageProps {
  src: string
  alt: string
  width?: string | number
  height?: string | number
  className?: string
  style?: React.CSSProperties
}

// Helper function to handle base path for images
const getAdjustedPath = (path: string): string => {
  // Early return if the path is an absolute URL or data URL
  if (path.startsWith('http') || path.startsWith('data:')) {
    return path
  }

  // Try to detect if we're in a production environment
  // This works in both browser and during static generation
  const isProduction = process.env.NODE_ENV === 'production'
  
  // Use the basePath from Next.js config
  const basePath = isProduction ? '/kliveide' : ''
  
  // If the path already starts with the base path, return it as is
  if (path.startsWith(basePath)) {
    return path
  }
  
  // If path starts with '/', make sure it's properly combined with base path
  if (path.startsWith('/')) {
    return `${basePath}${path}`
  }
  
  // Otherwise, ensure there's a leading slash
  return `${basePath}/${path}`
}

export const ClickableImage: React.FC<ClickableImageProps> = ({
  src,
  alt,
  width,
  height,
  className = '',
  style = {},
}) => {
  // Combine classes
  const imageClasses = [
    styles.image,
    styles.default,
    className
  ].filter(Boolean).join(' ')

  // Custom styles for dynamic properties
  const customStyle: React.CSSProperties = {
    ...(width && { 
      width: typeof width === 'string' && /^\d+$/.test(width) ? `${width}px` : width 
    }),
    ...(height ? { 
      height: typeof height === 'string' && /^\d+$/.test(height) ? `${height}px` : height 
    } : { height: 'auto' }),
    ...style
  }

  // Adjust image paths for both the link and image src
  const adjustedSrc = getAdjustedPath(src)

  return (
    <div className={styles.container}>
      <a href={adjustedSrc} target="_blank" rel="noopener noreferrer" className={styles.imageLink}>
        <img
          src={adjustedSrc}
          alt={alt}
          className={imageClasses}
          style={customStyle}
        />
      </a>
    </div>
  )
}

export default ClickableImage
