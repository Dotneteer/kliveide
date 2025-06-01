import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import IdeApp from '../src/renderer/ide/IdeApp'

describe('IdeApp', () => {
  it('should render the Klive IDE title', () => {
    render(<IdeApp />)
    
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveTextContent('Klive IDE')
  })

  it('should have the correct heading structure', () => {
    render(<IdeApp />)
    
    const heading = screen.getByText('Klive IDE')
    expect(heading.tagName).toBe('H1')
  })
})
