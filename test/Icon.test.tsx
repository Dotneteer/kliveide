import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create mock modules before importing the component to be tested
vi.mock('../src/renderer/theming/icon-defs', () => ({
  iconLibrary: [
    {
      name: 'test-icon',
      path: 'M0,0 L10,10',
      width: 16,
      height: 16
    },
    {
      name: 'unknown',
      path: 'M4,4 L12,12 M12,4 L4,12',
      width: 16, 
      height: 16
    },
    {
      name: 'empty-icon',
      path: '',
      width: 16,
      height: 16
    }
  ]
}))

vi.mock('../src/renderer/theming/image-defs', () => ({
  imageLibrary: [
    {
      name: 'test-image',
      type: 'png',
      data: 'dGVzdC1pbWFnZQ==' // Base64 for "test-image"
    }
  ]
}))

// Import after mocking
import Icon from '../src/renderer/common/Icon'

describe('Icon', () => {
  it('renders an SVG icon correctly', () => {
    render(<Icon name="test-icon" data-testid="test-svg" />)
    
    const icon = screen.getByTestId('test-svg')
    expect(icon.tagName).toBe('svg')
    expect(icon.getAttribute('width')).toBe('24')
    expect(icon.getAttribute('height')).toBe('24')
    expect(icon.getAttribute('viewBox')).toBe('0 0 16 16')
    
    const path = icon.querySelector('path')
    expect(path).toBeInTheDocument()
    expect(path?.getAttribute('d')).toBe('M0,0 L10,10')
  })

  it('renders a PNG image correctly', () => {
    render(<Icon name="@test-image" data-testid="test-img" />)
    
    const img = screen.getByTestId('test-img')
    expect(img.tagName).toBe('IMG')
    expect(img.getAttribute('width')).toBe('24')
    expect(img.getAttribute('height')).toBe('24')
    expect(img.getAttribute('src')).toBe('data:image/png;base64,dGVzdC1pbWFnZQ==')
    expect(img.getAttribute('alt')).toBe('test-image')
  })

  it('uses fallback icon when the primary icon is not found', () => {
    render(<Icon name="non-existent-icon" fallback="test-icon" data-testid="fallback-icon" />)
    
    const icon = screen.getByTestId('fallback-icon')
    expect(icon.tagName).toBe('svg')
    
    const path = icon.querySelector('path')
    expect(path?.getAttribute('d')).toBe('M0,0 L10,10')
  })

  it('uses fallback image when the primary icon is not found', () => {
    render(<Icon name="non-existent-icon" fallback="@test-image" data-testid="fallback-img" />)
    
    const img = screen.getByTestId('fallback-img')
    expect(img.tagName).toBe('IMG')
    expect(img.getAttribute('src')).toBe('data:image/png;base64,dGVzdC1pbWFnZQ==')
  })

  it('uses unknown icon when both primary and fallback are not found', () => {
    render(<Icon name="non-existent-icon" fallback="also-non-existent" data-testid="unknown-icon" />)
    
    const icon = screen.getByTestId('unknown-icon')
    expect(icon.tagName).toBe('svg')
    
    const path = icon.querySelector('path')
    expect(path?.getAttribute('d')).toBe('M4,4 L12,12 M12,4 L4,12')
  })

  it('applies custom width and height', () => {
    render(<Icon name="test-icon" width={32} height={48} data-testid="sized-icon" />)
    
    const icon = screen.getByTestId('sized-icon')
    expect(icon.getAttribute('width')).toBe('32')
    expect(icon.getAttribute('height')).toBe('48')
  })

  it('applies fill color to SVG icons', () => {
    render(<Icon name="test-icon" fill="red" data-testid="colored-icon" />)
    
    const icon = screen.getByTestId('colored-icon')
    expect(icon.getAttribute('fill')).toBe('red')
  })

  it('applies rotation style', () => {
    render(<Icon name="test-icon" rotate={90} data-testid="rotated-icon" />)
    
    const icon = screen.getByTestId('rotated-icon')
    expect(icon.style.transform).toBe('rotate(90deg)')
  })

  it('applies opacity', () => {
    render(<Icon name="test-icon" opacity={0.5} data-testid="transparent-icon" />)
    
    const icon = screen.getByTestId('transparent-icon')
    expect(icon.style.opacity).toBe('0.5')
  })

  it('applies custom class name', () => {
    render(<Icon name="test-icon" className="custom-icon-class" data-testid="classed-icon" />)
    
    const icon = screen.getByTestId('classed-icon')
    expect(icon.classList.contains('custom-icon-class')).toBe(true)
  })

  it('applies custom style object', () => {
    render(
      <Icon 
        name="test-icon" 
        style={{ border: '1px solid black', margin: '10px' }} 
        data-testid="styled-icon" 
      />
    )
    
    const icon = screen.getByTestId('styled-icon')
    expect(icon.style.border).toBe('1px solid black')
    expect(icon.style.margin).toBe('10px')
  })

  it('combines multiple style properties', () => {
    render(
      <Icon 
        name="test-icon" 
        rotate={45}
        opacity={0.8}
        style={{ fontSize: '20px' }} 
        data-testid="multi-styled-icon" 
      />
    )
    
    const icon = screen.getByTestId('multi-styled-icon')
    expect(icon.style.transform).toBe('rotate(45deg)')
    expect(icon.style.opacity).toBe('0.8')
    expect(icon.style.fontSize).toBe('20px')
  })
})
