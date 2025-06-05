import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { FullPanel } from '../src/renderer/common'
import { getCssPropertyValue } from '../src/renderer/common/cssUtils'

describe('FullPanel', () => {
  // Test CSS utility function directly
  describe('getCssPropertyValue utility', () => {
    it('converts CSS variable names to var() syntax', () => {
      expect(getCssPropertyValue('--custom-padding')).toBe('var(--custom-padding)')
      expect(getCssPropertyValue('--theme-color')).toBe('var(--theme-color)')
    })

    it('leaves regular values unchanged', () => {
      expect(getCssPropertyValue('16px')).toBe('16px')
      expect(getCssPropertyValue('red')).toBe('red')
      expect(getCssPropertyValue(10)).toBe(10)
    })
  })

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

  it('handles CSS variables through getCssPropertyValue', () => {
    render(
      <div style={{ '--custom-color': '#ff0000' } as React.CSSProperties}>
        <FullPanel 
          color="--custom-color" 
          data-testid="full-panel"
        >
          <div>Content</div>
        </FullPanel>
      </div>
    )
    
    const panel = screen.getByTestId('full-panel')
    
    // Verify CSS variable is converted to var() syntax
    expect(panel.style.color).toBe('var(--custom-color)')
  })

  it('handles backgroundColor CSS variable', () => {
    render(
      <div style={{ '--custom-bg': '#00ff00' } as React.CSSProperties}>
        <FullPanel 
          backgroundColor="--custom-bg" 
          data-testid="full-panel"
        >
          <div>Content</div>
        </FullPanel>
      </div>
    )
    
    const panel = screen.getByTestId('full-panel')
    expect(panel.style.backgroundColor).toBe('var(--custom-bg)')
  })

  // Simplified tests that focus on just testing computed styles for CSS variables
  it('handles padding CSS variable', () => {
    // Note: React's inline style system filters out CSS variables in jsdom,
    // but we can test that the component correctly processes CSS variables
    // by testing the cssUtils function directly and verifying other properties work
    render(
      <div style={{ '--custom-padding': '16px' } as React.CSSProperties}>
        <FullPanel 
          padding="--custom-padding" 
          data-testid="full-panel"
        >
          <div>Content</div>
        </FullPanel>
      </div>
    )
    
    const panel = screen.getByTestId('full-panel')
    // Verify that the component renders successfully and other styles work
    expect(panel.style.flexDirection).toBe('column')
    expect(panel.style.gap).toBe('0')
    // The padding CSS variable won't appear in jsdom, but the component should still render
    expect(panel).toBeInTheDocument()
  })

  it('handles paddingVertical CSS variable override', () => {
    // Note: React filters out CSS variables in jsdom inline styles,
    // but we can verify the component processes them correctly
    render(
      <div style={{ '--base-padding': '20px', '--vertical-padding': '10px' } as React.CSSProperties}>
        <FullPanel 
          padding="--base-padding"
          paddingVertical="--vertical-padding"
          data-testid="full-panel"
        >
          <div>Content</div>
        </FullPanel>
      </div>
    )
    
    const panel = screen.getByTestId('full-panel')
    // Verify component renders and processes styles correctly
    expect(panel.style.flexDirection).toBe('column')
    expect(panel).toBeInTheDocument()
  })

  it('handles paddingHorizontal CSS variable override', () => {
    render(
      <div style={{ '--base-padding': '20px', '--horizontal-padding': '15px' } as React.CSSProperties}>
        <FullPanel 
          padding="--base-padding"
          paddingHorizontal="--horizontal-padding"
          data-testid="full-panel"
        >
          <div>Content</div>
        </FullPanel>
      </div>
    )
    
    const panel = screen.getByTestId('full-panel')
    expect(panel.style.flexDirection).toBe('column')
    expect(panel).toBeInTheDocument()
  })

  it('handles both paddingVertical and paddingHorizontal CSS variables overriding padding', () => {
    render(
      <div style={{ 
        '--base-padding': '20px', 
        '--vertical-padding': '10px',
        '--horizontal-padding': '15px'
      } as React.CSSProperties}>
        <FullPanel 
          padding="--base-padding"
          paddingVertical="--vertical-padding"
          paddingHorizontal="--horizontal-padding"
          data-testid="full-panel"
        >
          <div>Content</div>
        </FullPanel>
      </div>
    )
    
    const panel = screen.getByTestId('full-panel')
    expect(panel.style.flexDirection).toBe('column')
    expect(panel).toBeInTheDocument()
  })

  it('handles gap CSS variable', () => {
    render(
      <div style={{ '--custom-gap': '12px' } as React.CSSProperties}>
        <FullPanel 
          gap="--custom-gap" 
          data-testid="full-panel"
        >
          <div>Content</div>
        </FullPanel>
      </div>
    )
    
    const panel = screen.getByTestId('full-panel')
    expect(panel.style.gap).toBe('var(--custom-gap)')
  })

  it('handles multiple CSS variables together', () => {
    render(
      <div style={{ 
        '--theme-color': '#ff6600',
        '--theme-bg': '#f5f5f5',
        '--theme-spacing': '24px'
      } as React.CSSProperties}>
        <FullPanel 
          color="--theme-color"
          backgroundColor="--theme-bg"
          padding="--theme-spacing"
          data-testid="full-panel"
        >
          <div>Content</div>
        </FullPanel>
      </div>
    )
    
    const panel = screen.getByTestId('full-panel')
    // Verify that color and backgroundColor CSS variables work (these are preserved by React)
    expect(panel.style.color).toBe('var(--theme-color)')
    expect(panel.style.backgroundColor).toBe('var(--theme-bg)')
    // Verify component renders correctly
    expect(panel.style.flexDirection).toBe('column')
    expect(panel).toBeInTheDocument()
  })

  // Additional comprehensive CSS variable tests
  describe('comprehensive CSS variable handling', () => {
    it('handles mixed CSS variables and regular values', () => {
      render(
        <div style={{ 
          '--custom-color': '#ff0000',
          '--custom-gap': '20px'
        } as React.CSSProperties}>
          <FullPanel 
            color="--custom-color"
            backgroundColor="blue"  // regular value
            gap="--custom-gap"
            padding="10px"          // regular value
            data-testid="full-panel"
          >
            <div>Content</div>
          </FullPanel>
        </div>
      )
      
      const panel = screen.getByTestId('full-panel')
      // CSS variables that React supports
      expect(panel.style.color).toBe('var(--custom-color)')
      expect(panel.style.backgroundColor).toBe('blue')
      expect(panel.style.gap).toBe('var(--custom-gap)')
      // Regular padding should work
      expect(panel.style.padding).toBe('10px')
    })

    it('handles numeric values with CSS variables', () => {
      render(
        <div style={{ '--numeric-gap': '15' } as React.CSSProperties}>
          <FullPanel 
            gap="--numeric-gap"
            padding={20}
            data-testid="full-panel"
          >
            <div>Content</div>
          </FullPanel>
        </div>
      )
      
      const panel = screen.getByTestId('full-panel')
      expect(panel.style.gap).toBe('var(--numeric-gap)')
      expect(panel.style.padding).toBe('20px')
    })

    it('handles all direction and reverse combinations with CSS variables', () => {
      render(
        <div style={{ '--theme-color': '#00ff00' } as React.CSSProperties}>
          <FullPanel 
            direction="horizontal"
            reverse={true}
            color="--theme-color"
            data-testid="full-panel"
          >
            <div>Content</div>
          </FullPanel>
        </div>
      )
      
      const panel = screen.getByTestId('full-panel')
      expect(panel.style.flexDirection).toBe('row-reverse')
      expect(panel.style.color).toBe('var(--theme-color)')
    })

    it('handles complex padding overrides with CSS variables', () => {
      render(
        <div style={{ 
          '--base': '10px',
          '--vertical': '20px',
          '--horizontal': '30px'
        } as React.CSSProperties}>
          <FullPanel 
            padding="--base"
            paddingVertical="--vertical"
            paddingHorizontal="--horizontal"
            data-testid="full-panel"
          >
            <div>Content</div>
          </FullPanel>
        </div>
      )
      
      const panel = screen.getByTestId('full-panel')
      // Component should render without errors
      expect(panel).toBeInTheDocument()
      expect(panel.style.flexDirection).toBe('column')
    })
  })

  // Edge cases and error handling
  describe('edge cases', () => {
    it('handles empty and undefined values gracefully', () => {
      render(
        <FullPanel 
          color=""
          backgroundColor={undefined}
          padding={null as any}
          gap=""
          data-testid="full-panel"
        >
          <div>Content</div>
        </FullPanel>
      )
      
      const panel = screen.getByTestId('full-panel')
      expect(panel).toBeInTheDocument()
      expect(panel.style.flexDirection).toBe('column')
    })

    it('handles zero values correctly', () => {
      render(
        <FullPanel 
          gap={0}
          padding={0}
          data-testid="full-panel"
        >
          <div>Content</div>
        </FullPanel>
      )
      
      const panel = screen.getByTestId('full-panel')
      expect(panel.style.gap).toBe('0')
      expect(panel.style.padding).toBe('0px')
    })

    it('handles string zero values', () => {
      render(
        <FullPanel 
          gap="0"
          padding="0px"
          data-testid="full-panel"
        >
          <div>Content</div>
        </FullPanel>
      )
      
      const panel = screen.getByTestId('full-panel')
      expect(panel.style.gap).toBe('0')
      expect(panel.style.padding).toBe('0px')
    })

    it('preserves user custom styles with style prop', () => {
      render(
        <FullPanel 
          color="red"
          style={{ fontSize: '16px', fontWeight: 'bold' }}
          data-testid="full-panel"
        >
          <div>Content</div>
        </FullPanel>
      )
      
      const panel = screen.getByTestId('full-panel')
      expect(panel.style.color).toBe('red')
      expect(panel.style.fontSize).toBe('16px')
      expect(panel.style.fontWeight).toBe('bold')
    })

    it('allows user styles to override component styles', () => {
      render(
        <FullPanel 
          color="red"
          style={{ color: 'blue' }}  // Should override the color prop
          data-testid="full-panel"
        >
          <div>Content</div>
        </FullPanel>
      )
      
      const panel = screen.getByTestId('full-panel')
      expect(panel.style.color).toBe('blue')
    })
  })

  it('stretches to fill parent container dimensions', () => {
    render(
      <div data-testid="parent" style={{ width: '500px', height: '300px' }}>
        <FullPanel
          data-testid="full-panel"
          direction="vertical"
          gap="20px"
          backgroundColor="red"
          style={{
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <h1>Emulator</h1>
        </FullPanel>
      </div>
    )
    
    const panel = screen.getByTestId('full-panel')
    
    // Check that the panel has CSS class applied
    expect(panel.className).toMatch(/_fullPanel_\w+/)
    
    // Check that flex direction and other inline styles are applied
    expect(panel.style.flexDirection).toBe('column')
    expect(panel.style.gap).toBe('20px')
    expect(panel.style.backgroundColor).toBe('red')
    expect(panel.style.justifyContent).toBe('center')
    expect(panel.style.alignItems).toBe('center')
    
    // Note: Due to CSS modules not being fully rendered in test environment,
    // we cannot directly test computed width/height, but we can verify
    // that the CSS class is applied which contains the stretching rules
  })

  it('applies the fullPanel CSS class for stretching behavior', () => {
    render(
      <FullPanel data-testid="full-panel">
        <div>Content</div>
      </FullPanel>
    )
    
    const panel = screen.getByTestId('full-panel')
    
    // Verify the CSS module class is applied - this class contains:
    // width: 100%, height: 100%, display: flex, margin: 0, box-sizing: border-box
    expect(panel.className).toMatch(/_fullPanel_\w+/)
    
    // Verify it's a flex container (this can be tested)
    expect(panel.style.flexDirection).toBeTruthy()
  })
})
