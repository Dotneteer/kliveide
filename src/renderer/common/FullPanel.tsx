import React from 'react'
import classNames from 'classnames'
import styles from './FullPanel.module.scss'
import { getCssPropertyValue } from './cssUtils'
import { BasePanelProps } from './types'

interface FullPanelProps extends BasePanelProps {
  /** Layout direction */
  direction?: 'horizontal' | 'vertical'
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
    gap: getCssPropertyValue(gap),
    // --- Color and background styling
    ...(color && { color: getCssPropertyValue(color) }),
    ...(backgroundColor && { backgroundColor: getCssPropertyValue(backgroundColor) }),
    // --- Padding properties (specific overrides general)
    ...(padding !== undefined && padding !== null && { padding: getCssPropertyValue(padding) }),
    ...(paddingVertical !== undefined && paddingVertical !== null && { 
      paddingTop: getCssPropertyValue(paddingVertical), 
      paddingBottom: getCssPropertyValue(paddingVertical) 
    }),
    ...(paddingHorizontal !== undefined && paddingHorizontal !== null && { 
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
