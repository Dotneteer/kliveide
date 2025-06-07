# Project Conventions

This document serves as a knowledge base for coding and refactoring conventions in the Kliveide project. It's intended to be used by GitHub Copilot and human contributors to maintain consistency across the codebase.

## Application Architecture

### Overview

- Kliveide is an Electron-based application with two main parts:
  - IDE - Development environment for retro computer programming
  - Emulator - Virtual machines for various retro computers
- The application follows Electron's main/renderer process architecture

## Project Structure

### Source Code Organization

- All source code resides in the `src` folder with the following structure:
  - `common` - Shared code between main and renderer processes
    - `abstractions` - Type definitions shared across main process
  - `main` - Electron main process code
  - `preload` - Electron preload scripts
  - `renderer` - Frontend code for the Electron renderer process
    - `abstractions` - Type definitions and interfaces
    - `common` - Reusable UI components
    - `emulator` - Emulator application UI
    - `ide` - IDE application UI

### Testing

- All tests are in the `test` folder
- Tests follow the same naming convention as their source files with `.test.ts(x)` suffix

## Type Definitions

### Abstractions Folder

- Place type definitions and interfaces in the `abstractions` folder
- Each type should be in a separate file
- No runtime artifacts (constants, functions) should be in abstractions files
- Import types using `import type` syntax

## Import Conventions

- Use `import type` when importing from the abstractions folder:
  ```typescript
  import type { BasePanelProps, Direction } from '../abstractions'
  ```

## File Naming Conventions

- React components use PascalCase (e.g., `FullPanel.tsx`)
- Component CSS modules use the same name with `.module.scss` extension (e.g., `FullPanel.module.scss`)
- Utility functions use camelCase (e.g., `cssUtils.ts`)
- Type definition files use PascalCase for the primary type (e.g., `Direction.ts`)

## Component Structure

### General Components

- Components should have descriptive JSDoc comments
- Props interfaces should be defined near the component they belong to
- Default values should be set in the component's destructuring

### UI Component Library

The `renderer/common` folder contains reusable UI components:

- `FullPanel` - A flex container that fills the available client area
- `Stack` - Base component for flex layout containers
- `HStack` - Horizontal stack (row layout)
- `VStack` - Vertical stack (column layout) 
- `SplitPanel` - Resizable split container with primary and secondary panels

## Code Style

### CSS Modules

- Component-specific styles are in `.module.scss` files
- Each component has its own CSS module
- Class names in CSS modules should be camelCase

### Utility Functions

- Utility functions are organized by domain (e.g., `cssUtils.ts`)
- Custom hooks use the `use` prefix (e.g., `useDrag.ts`)

## Code Comments

### JSDoc/TSDoc Comments

- Use JSDoc/TSDoc comments for types, interfaces, components, and methods
- Keep comments concise and under 100 characters per line
- Document parameters, returns, and important behavior

```typescript
/**
 * FullPanel - A flex container that stretches to fill the entire available client area
 * 
 * @param props.direction - Layout direction ('horizontal' or 'vertical', default: 'vertical')
 * @param props.reverse - Reverses the direction of children layout (default: false)
 */
```

## AI Collaboration

### Conversation History

- **IMPORTANT**: This conventions file MUST be prioritized when summarizing conversation history
- Always include the existence and purpose of this file in conversation summaries
- The conventions outlined here should be maintained across all coding sessions
- When starting a new session, reference this file first to ensure consistency with project standards
- When adding new code or refactoring, make sure to follow these conventions

### Component Example

```tsx
// Standard component structure with imports, interface, and implementation
import React from 'react'
import classNames from 'classnames'
import styles from './Component.module.scss'
import type { SomeType } from '../abstractions'

/**
 * Component interface with proper documentation
 */
interface ComponentProps {
  /** Prop documentation */
  someProp?: SomeType
}

/**
 * Component - Brief description of what it does
 * 
 * More detailed explanation if needed.
 */
const Component: React.FC<ComponentProps> = ({
  someProp = 'default',
  ...props
}) => {
  // --- Computed value with implementation
  const computed = someProp === 'value' ? 'result' : 'alternative'
  
  return (
    <div className={styles.component}>
      {computed}
    </div>
  )
}

export default Component
```

### In-Body Comments

- Use end-of-line comments with three dashes for in-body code comments
- Place these comments on the line before the code they describe
- Total line length including indentation should not exceed 100 characters

```typescript
// --- Calculate flex direction in a single expression
flexDirection: direction === 'horizontal' 
  ? (reverse ? 'row-reverse' : 'row') 
  : (reverse ? 'column-reverse' : 'column'),

// --- Apply optional styling properties
...(color && { color: getCssPropertyValue(color) }),
```

## Testing

### Test Organization

- Tests are in the `test` folder mirroring the structure of the source code
- Vitest is used as the testing framework
- React Testing Library is used for component tests

### Test Naming and Structure

- Test files use the same name as the source file with `.test.ts(x)` suffix
- Use describe/it blocks for organizing tests
- Group tests by features or components
- Tests should be independent and not rely on execution order

### Component Testing Example

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Component } from '../src/renderer/common'

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component />)
    expect(screen.getByTestId('_$_Component')).toBeInTheDocument()
  })

  it('applies specified properties', () => {
    render(<Component someProp="value" />)
    const component = screen.getByTestId('_$_Component')
    expect(component).toHaveStyle({ property: 'expectedValue' })
  })
})
```

### Code Comment Examples

```typescript
// --- Calculate flex direction in a single expression
flexDirection: direction === 'horizontal' 
  ? (reverse ? 'row-reverse' : 'row') 
  : (reverse ? 'column-reverse' : 'column'),

// --- Apply optional styling properties
...(color && { color: getCssPropertyValue(color) }),
```
