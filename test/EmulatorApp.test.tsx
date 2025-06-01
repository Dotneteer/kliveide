import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmulatorApp from '../src/renderer/emulator/EmulatorApp'

describe('EmulatorApp', () => {
  it('should render the Klive Emulator title', () => {
    render(<EmulatorApp />)
    
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveTextContent('Klive Emulator')
  })

  it('should have the correct heading structure', () => {
    render(<EmulatorApp />)
    
    const heading = screen.getByText('Klive Emulator')
    expect(heading.tagName).toBe('H1')
  })
})
