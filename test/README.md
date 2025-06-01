# Testing Setup for Klive IDE

This project uses [Vitest](https://vitest.dev/) for unit and integration testing of React components and TypeScript modules.

## Test Commands

- `npm run test` - Run tests in watch mode (interactive)
- `npm run test:run` - Run tests once and exit
- `npm run test:ui` - Open Vitest UI for visual test running
- `npm run test:coverage` - Run tests with coverage report

## Test Structure

All test files are located in the `/test` directory in the project root:

```
test/
├── setup.ts                    # Test setup and global mocks
├── tsconfig.json              # TypeScript config for tests
├── EmulatorApp.test.tsx       # Tests for Emulator component
├── IdeApp.test.tsx           # Tests for IDE component
├── KliveSettings.test.ts     # Tests for TypeScript types
├── FullPanel.test.tsx        # Tests for shared flex panel component
└── ReactInteraction.test.tsx # Example of user interaction testing
```

## What's Tested

### React Components
- **EmulatorApp**: Renders the "Klive Emulator" title correctly
- **IdeApp**: Renders the "Klive IDE" title correctly
- **FullPanel**: Tests flex layout container with full-area stretching and layout options
- **ReactInteraction**: Example component testing user interactions

### TypeScript Types
- **KliveSettings**: Validates type definitions and object creation

## Test Configuration

- **Environment**: jsdom (simulates browser environment)
- **Framework**: React Testing Library for component testing
- **Globals**: Vitest globals enabled (describe, it, expect available without imports)
- **Coverage**: V8 provider with HTML/JSON/text reports

## Mocking

The test setup includes mocks for:
- Electron APIs (`window.electron`)
- Preload script APIs (`window.api`)

## Coverage

Coverage reports include:
- All source files in `src/renderer/` (components)
- TypeScript type definitions
- Excludes: main process, preload scripts, HTML files, and entry points

Coverage reports are generated in the `coverage/` directory and excluded from git.

## Adding New Tests

1. Create test files with `.test.ts` or `.test.tsx` extension in the `/test` directory
2. Import the module/component you want to test
3. Use Vitest's `describe`, `it`, and `expect` for test structure
4. For React components, use React Testing Library's `render`, `screen`, etc.

## Example Test

\`\`\`typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MyComponent from '../src/renderer/MyComponent'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })
})
\`\`\`

## Testing Shared Components

Shared components in `/src/renderer/common/` should be tested to ensure they work correctly across both Emulator and IDE windows:

1. **Import from common**: Use `import { FullPanel } from '../src/renderer/common'`
2. **Test all variants**: Test different props, states, and interactions
3. **Test accessibility**: Ensure proper ARIA attributes and keyboard navigation
4. **Test styling**: Verify CSS classes are applied correctly

Example shared component test:
```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { FullPanel } from '../src/renderer/common'

describe('FullPanel', () => {
  it('applies default flex styles', () => {
    render(<FullPanel data-testid="panel">Content</FullPanel>)
    
    const panel = screen.getByTestId('panel')
    expect(panel).toHaveStyle({ display: 'flex' })
  })
})
```
