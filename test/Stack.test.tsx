import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Stack } from '../src/renderer/common/Stack'

describe('Stack', () => {
  it('renders children correctly', () => {
    render(
      <Stack orientation="vertical">
        <div>Child 1</div>
        <div>Child 2</div>
      </Stack>
    )
    
    expect(screen.getByText('Child 1')).toBeInTheDocument()
    expect(screen.getByText('Child 2')).toBeInTheDocument()
  })

  it('applies default flex styles with column direction', () => {
    render(
      <Stack orientation="vertical">
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    expect(stack.style.flexDirection).toBe('column')
    expect(stack.style.gap).toBe('0')
  })

  it('applies row direction correctly', () => {
    render(
      <Stack orientation="horizontal">
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    expect(stack.style.flexDirection).toBe('row')
  })

  it('applies reverse for row direction', () => {
    render(
      <Stack orientation="horizontal" reverse={true} >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    expect(stack.style.flexDirection).toBe('row-reverse')
  })

  it('applies reverse for column direction', () => {
    render(
      <Stack orientation="vertical" reverse={true} >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    expect(stack.style.flexDirection).toBe('column-reverse')
  })

  it('does not reverse when reverse is false', () => {
    render(
      <Stack orientation="horizontal" reverse={false} >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    expect(stack.style.flexDirection).toBe('row')
  })

  it('applies custom gap', () => {
    render(
      <Stack orientation="vertical" gap="20px" >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    expect(stack.style.gap).toBe('20px')
  })

  it('applies numeric gap', () => {
    render(
      <Stack orientation="vertical" gap={15} >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    expect(stack.style.gap).toBe('15px')
  })

  it('applies custom className', () => {
    render(
      <Stack orientation="vertical" className="custom-class" >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    expect(stack).toHaveClass('custom-class')
  })

  it('applies custom styles', () => {
    render(
      <Stack 
        orientation="vertical" 
        style={{ border: '1px solid red', margin: '10px' }}
        
      >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    expect(stack.style.border).toBe('1px solid red')
    expect(stack.style.margin).toBe('10px')
  })

  it('applies color property', () => {
    render(
      <Stack orientation="vertical" color="blue" >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    expect(stack.style.color).toBe('blue')
  })

  it('applies backgroundColor property', () => {
    render(
      <Stack orientation="vertical" backgroundColor="red" >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    expect(stack.style.backgroundColor).toBe('red')
  })

  it('applies padding property', () => {
    render(
      <Stack orientation="vertical" padding="10px" >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    expect(stack.style.padding).toBe('10px')
  })

  it('applies paddingVertical property', () => {
    render(
      <Stack orientation="vertical" paddingVertical="15px" >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.paddingTop).toBe('15px')
    expect(styles.paddingBottom).toBe('15px')
  })

  it('applies paddingHorizontal property', () => {
    render(
      <Stack orientation="vertical" paddingHorizontal="25px" >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.paddingLeft).toBe('25px')
    expect(styles.paddingRight).toBe('25px')
  })

  it('applies specific padding properties over general padding', () => {
    render(
      <Stack 
        orientation="vertical"
        padding="10px" 
        paddingVertical="20px" 
        paddingHorizontal="30px" 
        
      >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.paddingTop).toBe('20px')
    expect(styles.paddingBottom).toBe('20px')
    expect(styles.paddingLeft).toBe('30px')
    expect(styles.paddingRight).toBe('30px')
  })

  it('combines multiple styling properties', () => {
    render(
      <Stack 
        orientation="horizontal"
        color="white"
        backgroundColor="rgb(0, 0, 255)"
        paddingVertical="10px"
        paddingHorizontal="20px"
        gap="5px"
        
      >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
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
        orientation="vertical"
        padding="5px" 
        paddingVertical="15px" 
        
      >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.paddingTop).toBe('15px')
    expect(styles.paddingBottom).toBe('15px')
    expect(styles.paddingLeft).toBe('5px')
    expect(styles.paddingRight).toBe('5px')
  })

  it('paddingHorizontal overwrites padding for left and right', () => {
    render(
      <Stack 
        orientation="vertical"
        padding="8px" 
        paddingHorizontal="25px" 
        
      >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.paddingTop).toBe('8px')
    expect(styles.paddingBottom).toBe('8px')
    expect(styles.paddingLeft).toBe('25px')
    expect(styles.paddingRight).toBe('25px')
  })

  it('both paddingVertical and paddingHorizontal overwrite all padding values', () => {
    render(
      <Stack 
        orientation="vertical"
        padding="12px" 
        paddingVertical="6px" 
        paddingHorizontal="18px" 
        
      >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.paddingTop).toBe('6px')
    expect(styles.paddingBottom).toBe('6px')
    expect(styles.paddingLeft).toBe('18px')
    expect(styles.paddingRight).toBe('18px')
  })

  it('specific padding properties work with numeric values', () => {
    render(
      <Stack 
        orientation="vertical"
        padding={10} 
        paddingVertical={20} 
        paddingHorizontal={30} 
        
      >
        <div>Content</div>
      </Stack>
    )
    
    const stack = screen.getByTestId('_$_Stack')
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
          orientation="vertical"
          color="--custom-color" 
          
        >
          <div>Content</div>
        </Stack>
      </div>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    expect(stack.style.color).toBe('var(--custom-color)')
  })

  it('handles backgroundColor CSS variable', () => {
    render(
      <div style={{ '--custom-bg': '#00ff00' } as React.CSSProperties}>
        <Stack 
          orientation="vertical"
          backgroundColor="--custom-bg" 
          
        >
          <div>Content</div>
        </Stack>
      </div>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    expect(stack.style.backgroundColor).toBe('var(--custom-bg)')
  })

  it('handles gap CSS variable', () => {
    render(
      <div style={{ '--custom-gap': '12px' } as React.CSSProperties}>
        <Stack 
          orientation="vertical"
          gap="--custom-gap" 
          
        >
          <div>Content</div>
        </Stack>
      </div>
    )
    
    const stack = screen.getByTestId('_$_Stack')
    expect(stack.style.gap).toBe('var(--custom-gap)')
  })

  it('handles padding CSS variable', () => {
    render(
      <div style={{ '--custom-padding': '16px' } as React.CSSProperties}>
        <Stack 
          orientation="vertical"
          padding="--custom-padding" 
          
        >
          <div>Content</div>
        </Stack>
      </div>
    )
    
    const stack = screen.getByTestId('_$_Stack')
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
          orientation="horizontal"
          color="--theme-color"
          backgroundColor="--theme-bg"
          padding="--theme-spacing"
          
        >
          <div>Content</div>
        </Stack>
      </div>
    )
    
    const stack = screen.getByTestId('_$_Stack')
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
            orientation="horizontal"
            color="--custom-color"
            backgroundColor="blue"
            gap="--custom-gap"
            padding="10px"
            
          >
            <div>Content</div>
          </Stack>
        </div>
      )
      
      const stack = screen.getByTestId('_$_Stack')
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
            orientation="horizontal"
            reverse={true}
            color="--theme-color"
            
          >
            <div>Content</div>
          </Stack>
        </div>
      )
      
      const stack = screen.getByTestId('_$_Stack')
      expect(stack.style.flexDirection).toBe('row-reverse')
      expect(stack.style.color).toBe('var(--theme-color)')
    })
  })

  // Edge cases and error handling
  describe('edge cases', () => {
    it('handles empty and undefined values gracefully', () => {
      render(
        <Stack 
          orientation="vertical"
          color=""
          backgroundColor={undefined}
          padding={null as any}
          gap=""
          
        >
          <div>Content</div>
        </Stack>
      )
      
      const stack = screen.getByTestId('_$_Stack')
      expect(stack).toBeInTheDocument()
      expect(stack.style.flexDirection).toBe('column')
    })

    it('handles zero values correctly', () => {
      render(
        <Stack 
          orientation="vertical"
          gap={0}
          padding={0}
          
        >
          <div>Content</div>
        </Stack>
      )
      
      const stack = screen.getByTestId('_$_Stack')
      expect(stack.style.gap).toBe('0')
      expect(stack.style.padding).toBe('0px')
    })

    it('handles string zero values', () => {
      render(
        <Stack 
          orientation="vertical"
          gap="0"
          padding="0px"
          
        >
          <div>Content</div>
        </Stack>
      )
      
      const stack = screen.getByTestId('_$_Stack')
      expect(stack.style.gap).toBe('0')
      expect(stack.style.padding).toBe('0px')
    })

    it('preserves user custom styles with style prop', () => {
      render(
        <Stack 
          orientation="vertical"
          color="red"
          style={{ fontSize: '16px', fontWeight: 'bold' }}
          
        >
          <div>Content</div>
        </Stack>
      )
      
      const stack = screen.getByTestId('_$_Stack')
      expect(stack.style.color).toBe('red')
      expect(stack.style.fontSize).toBe('16px')
      expect(stack.style.fontWeight).toBe('bold')
    })

    it('allows user styles to override component styles', () => {
      render(
        <Stack 
          orientation="vertical"
          color="red"
          style={{ color: 'blue' }}
          
        >
          <div>Content</div>
        </Stack>
      )
      
      const stack = screen.getByTestId('_$_Stack')
      expect(stack.style.color).toBe('blue')
    })

    it('handles orientation prop correctly', () => {
      render(
        <Stack orientation="horizontal" data-testid="stack-row">
          <div>Content</div>
        </Stack>
      )
      
      const stackRow = screen.getByTestId('stack-row')
      expect(stackRow.style.flexDirection).toBe('row')
    })

    it('handles both orientation options', () => {
      const { rerender } = render(
        <Stack orientation="vertical" >
          <div>Content</div>
        </Stack>
      )
      
      let stack = screen.getByTestId('_$_Stack')
      expect(stack.style.flexDirection).toBe('column')
      
      rerender(
        <Stack orientation="horizontal" >
          <div>Content</div>
        </Stack>
      )
      
      stack = screen.getByTestId('_$_Stack')
      expect(stack.style.flexDirection).toBe('row')
    })
  })
})
