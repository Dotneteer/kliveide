import React from 'react'
import classNames from 'classnames'
import styles from './FullPanel.module.scss'
import { getCssPropertyValue } from './cssUtils'

interface FullPanelProps {
  /** React children */
  children?: React.ReactNode
  /** CSS class name */
  className?: string
  /** Layout direction */
  direction?: 'horizontal' | 'vertical'
  /** Whether to reverse the direction */
  reverse?: boolean
  /** Gap between flex items */
  gap?: string | number
  /** Text color */
  color?: string
  /** Background color */
  backgroundColor?: string
  /** Padding on all sides */
  padding?: string | number
  /** Padding on top and bottom */
  paddingVertical?: string | number
  /** Padding on left and right */
  paddingHorizontal?: string | number
  /** Additional styles */
  style?: React.CSSProperties
}

/**
 * FullPanel - A flex container that stretches to fill the entire available client area
 * 
 * This component creates a flex layout container that automatically fills its parent's
 * dimensions. Perfect for creating main layout containers in Electron windows.
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
  // --- Convert direction and reverse to CSS flexDirection
  const getFlexDirection = (): React.CSSProperties['flexDirection'] => {
    if (direction === 'horizontal') {
      return reverse ? 'row-reverse' : 'row'
    } else {
      return reverse ? 'column-reverse' : 'column'
    }
  }

  const panelStyle: React.CSSProperties = {
    // --- Dynamic flex layout properties
    flexDirection: getFlexDirection(),
    gap,
    // --- Color and background styling
    ...(color && { color: getCssPropertyValue(color) }),
    ...(backgroundColor && { backgroundColor: getCssPropertyValue(backgroundColor) }),
    // --- Padding properties (specific overrides general)
    ...(padding && { padding: getCssPropertyValue(padding) }),
    ...(paddingVertical && { 
      paddingTop: getCssPropertyValue(paddingVertical), 
      paddingBottom: getCssPropertyValue(paddingVertical) 
    }),
    ...(paddingHorizontal && { 
      paddingLeft: getCssPropertyValue(paddingHorizontal), 
      paddingRight: getCssPropertyValue(paddingHorizontal) 
    }),
    // --- User provided styles override defaults
    ...style
  }

  return (
    <div 
      className={classNames(styles.fullPanel, className)}
      style={panelStyle}
      {...props}
    >
      {children}
    </div>
  )
}

export default FullPanel
