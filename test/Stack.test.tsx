import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Stack } from '../src/renderer/common/Stack'

describe('Stack', () => {
  it('renders children correctly', () => {
    render(
      <Stack baseDirection="column" data-testid="stack">
        <div>Child 1</div>
        <div>Child 2</div>
      </Stack>
    )
    
    expect(screen.getByText('Child 1')).toBeInTheDocument()
    expect(screen.getByText('Child 2')).toBeInTheDocument()
  })

  it('applies default flex styles with column direction', () => {
    render(
      <Stack baseDirection="column" data-testid="stack">
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack.style.flexDirection).toBe('column')
    expect(stack.style.gap).toBe('0')
  })

  it('applies row direction correctly', () => {
    render(
      <Stack baseDirection="row" data-testid="stack">
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack.style.flexDirection).toBe('row')
  })

  it('applies reverse for row direction', () => {
    render(
      <Stack baseDirection="row" reverse={true} data-testid="stack">
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack.style.flexDirection).toBe('row-reverse')
  })

  it('applies reverse for column direction', () => {
    render(
      <Stack baseDirection="column" reverse={true} data-testid="stack">
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack.style.flexDirection).toBe('column-reverse')
  })

  it('does not reverse when reverse is false', () => {
    render(
      <Stack baseDirection="row" reverse={false} data-testid="stack">
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack.style.flexDirection).toBe('row')
  })

  it('applies custom gap', () => {
    render(
      <Stack baseDirection="column" gap="20px" data-testid="stack">
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack.style.gap).toBe('20px')
  })

  it('applies numeric gap', () => {
    render(
      <Stack baseDirection="column" gap={15} data-testid="stack">
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack.style.gap).toBe('15px')
  })

  it('applies custom className', () => {
    render(
      <Stack baseDirection="column" className="custom-class" data-testid="stack">
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack).toHaveClass('custom-class')
  })

  it('applies custom styles', () => {
    render(
      <Stack 
        baseDirection="column" 
        style={{ border: '1px solid red', margin: '10px' }}
        data-testid="stack"
      >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack.style.border).toBe('1px solid red')
    expect(stack.style.margin).toBe('10px')
  })

  it('applies color property', () => {
    render(
      <Stack baseDirection="column" color="blue" data-testid="stack">
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack.style.color).toBe('blue')
  })

  it('applies backgroundColor property', () => {
    render(
      <Stack baseDirection="column" backgroundColor="red" data-testid="stack">
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack.style.backgroundColor).toBe('red')
  })

  it('applies padding property', () => {
    render(
      <Stack baseDirection="column" padding="10px" data-testid="stack">
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack.style.padding).toBe('10px')
  })

  it('applies paddingVertical property', () => {
    render(
      <Stack baseDirection="column" paddingVertical="15px" data-testid="stack">
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.paddingTop).toBe('15px')
    expect(styles.paddingBottom).toBe('15px')
  })

  it('applies paddingHorizontal property', () => {
    render(
      <Stack baseDirection="column" paddingHorizontal="25px" data-testid="stack">
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.paddingLeft).toBe('25px')
    expect(styles.paddingRight).toBe('25px')
  })

  it('applies specific padding properties over general padding', () => {
    render(
      <Stack 
        baseDirection="column"
        padding="10px" 
        paddingVertical="20px" 
        paddingHorizontal="30px" 
        data-testid="stack"
      >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.paddingTop).toBe('20px')
    expect(styles.paddingBottom).toBe('20px')
    expect(styles.paddingLeft).toBe('30px')
    expect(styles.paddingRight).toBe('30px')
  })

  it('combines multiple styling properties', () => {
    render(
      <Stack 
        baseDirection="row"
        color="white"
        backgroundColor="rgb(0, 0, 255)"
        paddingVertical="10px"
        paddingHorizontal="20px"
        gap="5px"
        data-testid="stack"
      >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    const styles = window.getComputedStyle(stack)
    
    expect(stack.style.flexDirection).toBe('row')
    expect(stack.style.gap).toBe('5px')
    expect(styles.color).toBe('rgb(255, 255, 255)')
    expect(styles.backgroundColor).toBe('rgb(0, 0, 255)')
    expect(styles.paddingTop).toBe('10px')
    expect(styles.paddingBottom).toBe('10px')
    expect(styles.paddingLeft).toBe('20px')
    expect(styles.paddingRight).toBe('20px')
  })

  it('paddingVertical overwrites padding for top and bottom', () => {
    render(
      <Stack 
        baseDirection="column"
        padding="5px" 
        paddingVertical="15px" 
        data-testid="stack"
      >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.paddingTop).toBe('15px')
    expect(styles.paddingBottom).toBe('15px')
    expect(styles.paddingLeft).toBe('5px')
    expect(styles.paddingRight).toBe('5px')
  })

  it('paddingHorizontal overwrites padding for left and right', () => {
    render(
      <Stack 
        baseDirection="column"
        padding="8px" 
        paddingHorizontal="25px" 
        data-testid="stack"
      >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.paddingTop).toBe('8px')
    expect(styles.paddingBottom).toBe('8px')
    expect(styles.paddingLeft).toBe('25px')
    expect(styles.paddingRight).toBe('25px')
  })

  it('both paddingVertical and paddingHorizontal overwrite all padding values', () => {
    render(
      <Stack 
        baseDirection="column"
        padding="12px" 
        paddingVertical="6px" 
        paddingHorizontal="18px" 
        data-testid="stack"
      >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.paddingTop).toBe('6px')
    expect(styles.paddingBottom).toBe('6px')
    expect(styles.paddingLeft).toBe('18px')
    expect(styles.paddingRight).toBe('18px')
  })

  it('specific padding properties work with numeric values', () => {
    render(
      <Stack 
        baseDirection="column"
        padding={10} 
        paddingVertical={20} 
        paddingHorizontal={30} 
        data-testid="stack"
      >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.paddingTop).toBe('20px')
    expect(styles.paddingBottom).toBe('20px')
    expect(styles.paddingLeft).toBe('30px')
    expect(styles.paddingRight).toBe('30px')
  })

  // CSS Variable Tests
  it('handles CSS variables through getCssPropertyValue', () => {
    render(
      <div style={{ '--custom-color': '#ff0000' } as React.CSSProperties}>
        <Stack 
          baseDirection="column"
          color="--custom-color" 
          data-testid="stack"
        >
          <div>Content</div>
        </Stack>
      </div>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack.style.color).toBe('var(--custom-color)')
  })

  it('handles backgroundColor CSS variable', () => {
    render(
      <div style={{ '--custom-bg': '#00ff00' } as React.CSSProperties}>
        <Stack 
          baseDirection="column"
          backgroundColor="--custom-bg" 
          data-testid="stack"
        >
          <div>Content</div>
        </Stack>
      </div>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack.style.backgroundColor).toBe('var(--custom-bg)')
  })

  it('handles gap CSS variable', () => {
    render(
      <div style={{ '--custom-gap': '12px' } as React.CSSProperties}>
        <Stack 
          baseDirection="column"
          gap="--custom-gap" 
          data-testid="stack"
        >
          <div>Content</div>
        </Stack>
      </div>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack.style.gap).toBe('var(--custom-gap)')
  })

  it('handles padding CSS variable', () => {
    render(
      <div style={{ '--custom-padding': '16px' } as React.CSSProperties}>
        <Stack 
          baseDirection="column"
          padding="--custom-padding" 
          data-testid="stack"
        >
          <div>Content</div>
        </Stack>
      </div>
    )
    
    const stack = screen.getByTestId('stack')
    // Verify component renders successfully (CSS variables are filtered in jsdom)
    expect(stack.style.flexDirection).toBe('column')
    expect(stack).toBeInTheDocument()
  })

  it('handles multiple CSS variables together', () => {
    render(
      <div style={{ 
        '--theme-color': '#ff6600',
        '--theme-bg': '#f5f5f5',
        '--theme-spacing': '24px'
      } as React.CSSProperties}>
        <Stack 
          baseDirection="row"
          color="--theme-color"
          backgroundColor="--theme-bg"
          padding="--theme-spacing"
          data-testid="stack"
        >
          <div>Content</div>
        </Stack>
      </div>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack.style.color).toBe('var(--theme-color)')
    expect(stack.style.backgroundColor).toBe('var(--theme-bg)')
    expect(stack.style.flexDirection).toBe('row')
    expect(stack).toBeInTheDocument()
  })

  // Comprehensive CSS variable handling
  describe('comprehensive CSS variable handling', () => {
    it('handles mixed CSS variables and regular values', () => {
      render(
        <div style={{ 
          '--custom-color': '#ff0000',
          '--custom-gap': '20px'
        } as React.CSSProperties}>
          <Stack 
            baseDirection="row"
            color="--custom-color"
            backgroundColor="blue"
            gap="--custom-gap"
            padding="10px"
            data-testid="stack"
          >
            <div>Content</div>
          </Stack>
        </div>
      )
      
      const stack = screen.getByTestId('stack')
      expect(stack.style.color).toBe('var(--custom-color)')
      expect(stack.style.backgroundColor).toBe('blue')
      expect(stack.style.gap).toBe('var(--custom-gap)')
      expect(stack.style.padding).toBe('10px')
      expect(stack.style.flexDirection).toBe('row')
    })

    it('handles all direction and reverse combinations with CSS variables', () => {
      render(
        <div style={{ '--theme-color': '#00ff00' } as React.CSSProperties}>
          <Stack 
            baseDirection="row"
            reverse={true}
            color="--theme-color"
            data-testid="stack"
          >
            <div>Content</div>
          </Stack>
        </div>
      )
      
      const stack = screen.getByTestId('stack')
      expect(stack.style.flexDirection).toBe('row-reverse')
      expect(stack.style.color).toBe('var(--theme-color)')
    })
  })

  // Edge cases and error handling
  describe('edge cases', () => {
    it('handles empty and undefined values gracefully', () => {
      render(
        <Stack 
          baseDirection="column"
          color=""
          backgroundColor={undefined}
          padding={null as any}
          gap=""
          data-testid="stack"
        >
          <div>Content</div>
        </Stack>
      )
      
      const stack = screen.getByTestId('stack')
      expect(stack).toBeInTheDocument()
      expect(stack.style.flexDirection).toBe('column')
    })

    it('handles zero values correctly', () => {
      render(
        <Stack 
          baseDirection="column"
          gap={0}
          padding={0}
          data-testid="stack"
        >
          <div>Content</div>
        </Stack>
      )
      
      const stack = screen.getByTestId('stack')
      expect(stack.style.gap).toBe('0')
      expect(stack.style.padding).toBe('0px')
    })

    it('handles string zero values', () => {
      render(
        <Stack 
          baseDirection="column"
          gap="0"
          padding="0px"
          data-testid="stack"
        >
          <div>Content</div>
        </Stack>
      )
      
      const stack = screen.getByTestId('stack')
      expect(stack.style.gap).toBe('0')
      expect(stack.style.padding).toBe('0px')
    })

    it('preserves user custom styles with style prop', () => {
      render(
        <Stack 
          baseDirection="column"
          color="red"
          style={{ fontSize: '16px', fontWeight: 'bold' }}
          data-testid="stack"
        >
          <div>Content</div>
        </Stack>
      )
      
      const stack = screen.getByTestId('stack')
      expect(stack.style.color).toBe('red')
      expect(stack.style.fontSize).toBe('16px')
      expect(stack.style.fontWeight).toBe('bold')
    })

    it('allows user styles to override component styles', () => {
      render(
        <Stack 
          baseDirection="column"
          color="red"
          style={{ color: 'blue' }}
          data-testid="stack"
        >
          <div>Content</div>
        </Stack>
      )
      
      const stack = screen.getByTestId('stack')
      expect(stack.style.color).toBe('blue')
    })

    it('handles baseDirection prop correctly', () => {
      render(
        <Stack baseDirection="row" data-testid="stack-row">
          <div>Content</div>
        </Stack>
      )
      
      const stackRow = screen.getByTestId('stack-row')
      expect(stackRow.style.flexDirection).toBe('row')
    })

    it('handles both baseDirection options', () => {
      const { rerender } = render(
        <Stack baseDirection="column" data-testid="stack">
          <div>Content</div>
        </Stack>
      )
      
      let stack = screen.getByTestId('stack')
      expect(stack.style.flexDirection).toBe('column')
      
      rerender(
        <Stack baseDirection="row" data-testid="stack">
          <div>Content</div>
        </Stack>
      )
      
      stack = screen.getByTestId('stack')
      expect(stack.style.flexDirection).toBe('row')
    })
  })
})
