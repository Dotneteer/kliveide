import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Create mock modules before importing the component to be tested
vi.mock('../src/renderer/theming/icon-defs', () => ({
  iconLibrary: [
    {
      name: 'test-icon',
      path: 'M0,0 L10,10',
      width: 16,
      height: 16
    }
  ]
}))

vi.mock('../src/renderer/theming/image-defs', () => ({
  imageLibrary: []
}))

// Import after mocking
import { IconButton } from '../src/renderer/common'

describe('IconButton', () => {
  it('renders with default props', () => {
    render(<IconButton iconName="test-icon" data-testid="icon-button" />)
    
    const button = screen.getByTestId('icon-button')
    expect(button).toBeInTheDocument()
    expect(button.tagName).toBe('BUTTON')
    expect(button).toBeEnabled()
  })

  it('renders with specified dimensions', () => {
    render(
      <IconButton 
        iconName="test-icon" 
        iconSize={24}
        buttonWidth={48}
        buttonHeight={48}
        data-testid="sized-button" 
      />
    )
    
    const button = screen.getByTestId('sized-button')
    expect(button.style.width).toBe('48px')
    expect(button.style.height).toBe('48px')
    
    const icon = button.querySelector('svg')
    expect(icon).toBeInTheDocument()
    expect(icon?.getAttribute('width')).toBe('24')
    expect(icon?.getAttribute('height')).toBe('24')
  })

  it('displays a title/tooltip when specified', () => {
    render(
      <IconButton 
        iconName="test-icon" 
        title="Test Button"
        data-testid="title-button" 
      />
    )
    
    const button = screen.getByTestId('title-button')
    expect(button.getAttribute('title')).toBe('Test Button')
  })

  it('applies selected state correctly', () => {
    render(
      <IconButton 
        iconName="test-icon" 
        selected={true}
        data-testid="selected-button" 
      />
    )
    
    const button = screen.getByTestId('selected-button')
    expect(button.className).toContain('selected')
  })

  it('applies disabled state correctly', () => {
    render(
      <IconButton 
        iconName="test-icon" 
        enable={false}
        data-testid="disabled-button" 
      />
    )
    
    const button = screen.getByTestId('disabled-button')
    expect(button).toBeDisabled()
    expect(button.className).toContain('disabled')
  })

  it('applies no padding when specified', () => {
    render(
      <IconButton 
        iconName="test-icon" 
        noPadding={true}
        data-testid="no-padding-button" 
      />
    )
    
    const button = screen.getByTestId('no-padding-button')
    expect(button.className).toContain('noPadding')
  })

  it('calls click handler when clicked', () => {
    const handleClick = vi.fn()
    
    render(
      <IconButton 
        iconName="test-icon" 
        click={handleClick}
        data-testid="click-button" 
      />
    )
    
    const button = screen.getByTestId('click-button')
    fireEvent.click(button)
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not call click handler when disabled', () => {
    const handleClick = vi.fn()
    
    render(
      <IconButton 
        iconName="test-icon" 
        enable={false}
        click={handleClick}
        data-testid="disabled-click-button" 
      />
    )
    
    const button = screen.getByTestId('disabled-click-button')
    fireEvent.click(button)
    
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('applies custom class name', () => {
    render(
      <IconButton 
        iconName="test-icon" 
        className="custom-class"
        data-testid="class-button" 
      />
    )
    
    const button = screen.getByTestId('class-button')
    expect(button.className).toContain('custom-class')
  })

  it('applies custom style', () => {
    render(
      <IconButton 
        iconName="test-icon" 
        style={{ margin: '10px' }}
        data-testid="style-button" 
      />
    )
    
    const button = screen.getByTestId('style-button')
    expect(button.style.margin).toBe('10px')
  })

  it('passes additional props to the button', () => {
    render(
      <IconButton 
        iconName="test-icon" 
        data-custom="custom-value"
        data-testid="props-button" 
      />
    )
    
    const button = screen.getByTestId('props-button')
    expect(button.getAttribute('data-custom')).toBe('custom-value')
  })
})
