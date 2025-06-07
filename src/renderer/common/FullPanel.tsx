import React from 'react'
import classNames from 'classnames'
import styles from './FullPanel.module.scss'
import { getCssPropertyValue } from './cssUtils'
import type { BasePanelProps, Direction } from '../abstractions'

/**
 * Props for the FullPanel component
 */
interface FullPanelProps extends BasePanelProps {
  /** Layout direction of child elements */
  direction?: Direction
}

/**
 * FullPanel - A flex container that stretches to fill the entire available client area
 * 
 * Creates a flex layout container that automatically fills its parent's dimensions.
 * Perfect for creating main layout containers in Electron windows.
 * 
 * @param props.direction - Layout direction ('horizontal' or 'vertical', default: 'vertical')
 * @param props.reverse - Reverses the direction of children layout (default: false)
 * @param props.gap - Space between child elements (default: 0)
 * @param props.color - Text color
 * @param props.backgroundColor - Background color
 * @param props.padding - Overall padding (overridden by specific paddings)
 * @param props.paddingVertical - Top and bottom padding (overrides general padding)
 * @param props.paddingHorizontal - Left and right padding (overrides general padding)
 */
const FullPanel: React.FC<FullPanelProps> = ({
  children,
  className = '',
  direction = 'vertical',
  reverse = false,
  gap = 0,
  color,
  backgroundColor,
  padding,
  paddingVertical,
  paddingHorizontal,
  style = {},
  ...props
}) => {
  // Build style object with concise property calculations
  const panelStyle: React.CSSProperties = {
    // Calculate flex direction in a single expression
    flexDirection: direction === 'horizontal' 
      ? (reverse ? 'row-reverse' : 'row') 
      : (reverse ? 'column-reverse' : 'column'),
    gap: getCssPropertyValue(gap),
    
    // Apply optional styling properties
    ...(color && { color: getCssPropertyValue(color) }),
    ...(backgroundColor && { backgroundColor: getCssPropertyValue(backgroundColor) }),
    
    // Handle padding with priority (specific overrides general)
    ...(padding != null && { padding: getCssPropertyValue(padding) }),
    ...(paddingVertical != null && { 
      paddingTop: getCssPropertyValue(paddingVertical), 
      paddingBottom: getCssPropertyValue(paddingVertical) 
    }),
    ...(paddingHorizontal != null && { 
      paddingLeft: getCssPropertyValue(paddingHorizontal), 
      paddingRight: getCssPropertyValue(paddingHorizontal) 
    }),
    
    // User styles have highest priority
    ...style
  }

  // Render a div with computed styles and class
  return (
    <div 
      className={classNames(styles.fullPanel, className)}
      style={panelStyle}
      data-testid="_$_FullPanel"
      {...props}
    >
      {children}
    </div>
  )
}

export default FullPanel
