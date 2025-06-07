import React from 'react'

/**
 * Base properties shared by panel container components
 */
export interface BasePanelProps {
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
