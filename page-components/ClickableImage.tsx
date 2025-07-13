import React from 'react'
import styles from './ClickableImage.module.scss'

interface ClickableImageProps {
  src: string
  alt: string
  width?: string | number
  height?: string | number
  className?: string
  style?: React.CSSProperties
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

  return (
    <div className={styles.container}>
      <a href={src} target="_blank" rel="noopener noreferrer" className={styles.imageLink}>
        <img
          src={src}
          alt={alt}
          className={imageClasses}
          style={customStyle}
        />
      </a>
    </div>
  )
}

export default ClickableImage
