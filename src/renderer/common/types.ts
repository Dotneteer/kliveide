// --- TypeScript type definitions for shared renderer components

// --- Base component properties are now merged directly into component-specific interfaces

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

// --- Add more shared types here as needed
