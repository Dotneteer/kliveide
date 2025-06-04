import React from 'react'
import { getCssPropertyValue } from './cssUtils'
import { BasePanelProps } from './types'

/** Base properties shared by all stack components */
export interface BaseStackProps extends BasePanelProps {}

/** Internal props for the Stack component */
interface StackProps extends BaseStackProps {
  /** Base flex direction (row or column) */
  baseDirection: 'row' | 'column'
}

/**
 * Stack - Base component for horizontal and vertical stack layouts
 * 
 * This is an internal component that provides the common logic for HStack and VStack.
 * It handles all the styling properties and flex layout logic.
 */
export const Stack: React.FC<StackProps> = ({
  children,
  className = '',
  reverse = false,
  gap = 0,
  color,
  backgroundColor,
  padding,
  paddingVertical,
  paddingHorizontal,
  style = {},
  baseDirection,
  ...props
}) => {
  // --- Convert direction and reverse to CSS flexDirection
  const getFlexDirection = (): React.CSSProperties['flexDirection'] => {
    if (baseDirection === 'row') {
      return reverse ? 'row-reverse' : 'row'
    } else {
      return reverse ? 'column-reverse' : 'column'
    }
  }

  const stackStyle: React.CSSProperties = {
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
      className={className}
      style={stackStyle}
      {...props}
    >
      {children}
    </div>
  )
}
