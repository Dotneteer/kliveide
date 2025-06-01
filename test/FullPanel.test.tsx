import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { FullPanel } from '../src/renderer/common'

describe('FullPanel', () => {
  it('renders children correctly', () => {
    render(
      <FullPanel>
        <div>Test Content</div>
      </FullPanel>
    )
    
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('applies default flex styles', () => {
    render(
      <FullPanel data-testid="full-panel">
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    
    // Check that the CSS module class is applied (this ensures SCSS will be loaded)
    expect(panel.className).toMatch(/_fullPanel_\w+/)
    
    // Check inline styles that we can verify
    expect(panel.style.flexDirection).toBe('column')
    expect(panel.style.gap).toBe('0')
  })

  it('applies custom flex direction', () => {
    render(
      <FullPanel direction="horizontal" data-testid="full-panel">
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    expect(styles.flexDirection).toBe('row')
  })

  it('applies vertical direction by default', () => {
    render(
      <FullPanel data-testid="full-panel">
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    expect(styles.flexDirection).toBe('column')
  })

  it('applies reverse for horizontal direction', () => {
    render(
      <FullPanel direction="horizontal" reverse={true} data-testid="full-panel">
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    expect(styles.flexDirection).toBe('row-reverse')
  })

  it('applies reverse for vertical direction', () => {
    render(
      <FullPanel direction="vertical" reverse={true} data-testid="full-panel">
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    expect(styles.flexDirection).toBe('column-reverse')
  })

  it('does not reverse when reverse is false', () => {
    render(
      <FullPanel direction="horizontal" reverse={false} data-testid="full-panel">
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    expect(styles.flexDirection).toBe('row')
  })

  it('applies custom gap', () => {
    render(
      <FullPanel gap="16px" data-testid="full-panel">
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    expect(styles.gap).toBe('16px')
  })

  it('applies custom className', () => {
    render(
      <FullPanel className="custom-panel" data-testid="full-panel">
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    expect(panel).toHaveClass('custom-panel')
    // --- Check that CSS module class is applied (starts with underscore)
    expect(panel.className).toMatch(/_fullPanel_\w+/)
  })

  it('applies custom styles', () => {
    render(
      <FullPanel 
        style={{ backgroundColor: 'red', padding: '10px' }}
        data-testid="full-panel"
      >
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    expect(styles.backgroundColor).toBe('rgb(255, 0, 0)')
    expect(styles.padding).toBe('10px')
  })

  it('applies color property', () => {
    render(
      <FullPanel color="blue" data-testid="full-panel">
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    // Browser normalizes "blue" to rgb(0, 0, 255)
    expect(styles.color).toBe('rgb(0, 0, 255)')
  })

  it('applies backgroundColor property', () => {
    render(
      <FullPanel backgroundColor="rgb(255, 0, 0)" data-testid="full-panel">
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    expect(styles.backgroundColor).toBe('rgb(255, 0, 0)')
  })

  it('applies padding property', () => {
    render(
      <FullPanel padding="20px" data-testid="full-panel">
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    expect(styles.padding).toBe('20px')
  })

  it('applies paddingVertical property', () => {
    render(
      <FullPanel paddingVertical="15px" data-testid="full-panel">
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    expect(styles.paddingTop).toBe('15px')
    expect(styles.paddingBottom).toBe('15px')
  })

  it('applies paddingHorizontal property', () => {
    render(
      <FullPanel paddingHorizontal="25px" data-testid="full-panel">
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    expect(styles.paddingLeft).toBe('25px')
    expect(styles.paddingRight).toBe('25px')
  })

  it('applies specific padding properties over general padding', () => {
    render(
      <FullPanel 
        padding="10px" 
        paddingVertical="20px" 
        paddingHorizontal="30px" 
        data-testid="full-panel"
      >
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    // Specific padding should override general padding
    expect(styles.paddingTop).toBe('20px')
    expect(styles.paddingBottom).toBe('20px')
    expect(styles.paddingLeft).toBe('30px')
    expect(styles.paddingRight).toBe('30px')
  })

  it('combines multiple styling properties', () => {
    render(
      <FullPanel 
        color="white"
        backgroundColor="rgb(0, 0, 255)"
        paddingVertical="10px"
        paddingHorizontal="20px"
        data-testid="full-panel"
      >
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    // Browser normalizes "white" to rgb(255, 255, 255)
    expect(styles.color).toBe('rgb(255, 255, 255)')
    expect(styles.backgroundColor).toBe('rgb(0, 0, 255)')
    expect(styles.paddingTop).toBe('10px')
    expect(styles.paddingBottom).toBe('10px')
    expect(styles.paddingLeft).toBe('20px')
    expect(styles.paddingRight).toBe('20px')
  })

  it('paddingVertical overwrites padding for top and bottom', () => {
    render(
      <FullPanel 
        padding="5px" 
        paddingVertical="15px" 
        data-testid="full-panel"
      >
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    // paddingVertical should overwrite top and bottom, but leave left and right from padding
    expect(styles.paddingTop).toBe('15px')
    expect(styles.paddingBottom).toBe('15px')
    expect(styles.paddingLeft).toBe('5px')
    expect(styles.paddingRight).toBe('5px')
  })

  it('paddingHorizontal overwrites padding for left and right', () => {
    render(
      <FullPanel 
        padding="8px" 
        paddingHorizontal="25px" 
        data-testid="full-panel"
      >
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    // paddingHorizontal should overwrite left and right, but leave top and bottom from padding
    expect(styles.paddingTop).toBe('8px')
    expect(styles.paddingBottom).toBe('8px')
    expect(styles.paddingLeft).toBe('25px')
    expect(styles.paddingRight).toBe('25px')
  })

  it('both paddingVertical and paddingHorizontal overwrite all padding values', () => {
    render(
      <FullPanel 
        padding="12px" 
        paddingVertical="6px" 
        paddingHorizontal="18px" 
        data-testid="full-panel"
      >
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    // Both specific paddings should completely overwrite the general padding
    expect(styles.paddingTop).toBe('6px')
    expect(styles.paddingBottom).toBe('6px')
    expect(styles.paddingLeft).toBe('18px')
    expect(styles.paddingRight).toBe('18px')
  })

  it('specific padding properties work with numeric values', () => {
    render(
      <FullPanel 
        padding={10} 
        paddingVertical={20} 
        paddingHorizontal={30} 
        data-testid="full-panel"
      >
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    // Numeric values should be converted and override properly
    expect(styles.paddingTop).toBe('20px')
    expect(styles.paddingBottom).toBe('20px')
    expect(styles.paddingLeft).toBe('30px')
    expect(styles.paddingRight).toBe('30px')
  })

  it('only paddingVertical overwrites with no paddingHorizontal', () => {
    render(
      <FullPanel 
        padding="10px 15px 20px 25px" 
        paddingVertical="5px" 
        data-testid="full-panel"
      >
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    // paddingVertical should only overwrite top and bottom
    expect(styles.paddingTop).toBe('5px')
    expect(styles.paddingBottom).toBe('5px')
    expect(styles.paddingLeft).toBe('25px')
    expect(styles.paddingRight).toBe('15px')
  })

  it('only paddingHorizontal overwrites with no paddingVertical', () => {
    render(
      <FullPanel 
        padding="10px 15px 20px 25px" 
        paddingHorizontal="35px" 
        data-testid="full-panel"
      >
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    const styles = window.getComputedStyle(panel)
    
    // paddingHorizontal should only overwrite left and right
    expect(styles.paddingTop).toBe('10px')
    expect(styles.paddingBottom).toBe('20px')
    expect(styles.paddingLeft).toBe('35px')
    expect(styles.paddingRight).toBe('35px')
  })
})
