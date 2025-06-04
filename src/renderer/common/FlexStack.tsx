import React from 'react'
import classNames from 'classnames'
import { getCssPropertyValue } from './cssUtils'

/** Base properties shared by all stack components */
export interface BaseStackProps {
  /** React children */
  children?: React.ReactNode
  /** CSS class name */
  className?: string
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

/** Internal props for the FlexStack component */
interface FlexStackProps extends BaseStackProps {
  /** CSS module styles object */
  moduleStyles: Record<string, string>
  /** CSS module class name to apply */
  moduleClassName: string
  /** Base flex direction (row or column) */
  baseDirection: 'row' | 'column'
}

/**
 * FlexStack - Base component for horizontal and vertical stack layouts
 * 
 * This is an internal component that provides the common logic for HStack and VStack.
 * It handles all the styling properties and flex layout logic.
 */
export const FlexStack: React.FC<FlexStackProps> = ({
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
  moduleStyles,
  moduleClassName,
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
      className={classNames(moduleStyles[moduleClassName], className)}
      style={stackStyle}
      {...props}
    >
      {children}
    </div>
  )
}
