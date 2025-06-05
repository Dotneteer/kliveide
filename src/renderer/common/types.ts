// --- TypeScript type definitions for shared renderer components

import React from 'react'

// --- Base properties shared by panel container components
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

// --- Example theme types
export interface Theme {
  colors: {
    primary: string
    secondary: string
    background: string
    text: string
  }
  spacing: {
    small: string
    medium: string
    large: string
  }
}

// --- SplitPanel component types
export interface SplitPanelProps {
  /** React children - only first two children are used */
  children?: React.ReactNode
  /** CSS class name */
  className?: string
  /** Test ID for testing purposes */
  'data-testid'?: string
  /** Location of the primary panel */
  primaryLocation: 'left' | 'right' | 'top' | 'bottom'
  /** Whether the primary panel is visible */
  primaryVisible?: boolean
  /** Whether the secondary panel is visible */
  secondaryVisible?: boolean
  /** Initial size of the primary panel in pixels or percentage */
  initialPrimarySize?: string | number
  /** Minimum size of the primary panel in pixels or percentage */
  minPrimarySize?: string | number
  /** Minimum size of the secondary panel in pixels or percentage */
  minSecondarySize?: string | number
  /** Callback when the primary panel size changes during dragging */
  onUpdatePrimarySize?: (size: number) => void
  /** Callback when the user completes resizing */
  onPrimarySizeUpdateCompleted?: (size: number) => void
  /** Additional styles */
  style?: React.CSSProperties
}

// --- Add more shared types here as needed
