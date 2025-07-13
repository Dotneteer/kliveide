import React from 'react'

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
  // Custom styles for dynamic properties
  const customStyle: React.CSSProperties = {
    ...(width && { 
      width: typeof width === 'string' && /^\d+$/.test(width) ? `${width}px` : width 
    }),
    ...(height ? { 
      height: typeof height === 'string' && /^\d+$/.test(height) ? `${height}px` : height 
    } : { height: 'auto' }),
    maxWidth: '100%',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
    boxShadow: '0 8px 20px -2px rgba(0, 0, 0, 0.3)',
    ...style
  }

  const containerStyle: React.CSSProperties = {
    textAlign: 'center',
    margin: '20px 0'
  }

  const linkStyle: React.CSSProperties = {
    display: 'inline-block',
    textDecoration: 'none'
  }

  return (
    <div style={containerStyle} className={className}>
      <a 
        href={src} 
        target="_blank" 
        rel="noopener noreferrer" 
        style={linkStyle}
      >
        <img
          src={src}
          alt={alt}
          style={customStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 14px 32px -5px rgba(0, 0, 0, 0.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 8px 20px -2px rgba(0, 0, 0, 0.3)'
          }}
        />
      </a>
    </div>
  )
}

export default ClickableImage
