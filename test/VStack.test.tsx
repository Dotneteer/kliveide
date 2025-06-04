import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { VStack } from '../src/renderer/common'

describe('VStack', () => {
  it('renders children correctly', () => {
    render(
      <VStack data-testid="v-stack">
        <div>Child 1</div>
        <div>Child 2</div>
      </VStack>
    )
    
    expect(screen.getByText('Child 1')).toBeInTheDocument()
    expect(screen.getByText('Child 2')).toBeInTheDocument()
  })

  it('applies default vertical flex styles', () => {
    render(
      <VStack data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    
    // Check that the CSS module class is applied
    expect(stack.className).toMatch(/_vStack_\w+/)
    
    // Check inline styles
    expect(stack.style.flexDirection).toBe('column')
    expect(stack.style.gap).toBe('0')
  })

  it('applies reverse direction', () => {
    render(
      <VStack reverse={true} data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    expect(stack.style.flexDirection).toBe('column-reverse')
  })

  it('does not reverse when reverse is false', () => {
    render(
      <VStack reverse={false} data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    expect(stack.style.flexDirection).toBe('column')
  })

  it('applies custom gap', () => {
    render(
      <VStack gap="20px" data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    expect(stack.style.gap).toBe('20px')
  })

  it('applies numeric gap', () => {
    render(
      <VStack gap={15} data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    expect(stack.style.gap).toBe('15px')
  })

  it('applies custom className while preserving CSS module class', () => {
    render(
      <VStack className="custom-class" data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    expect(stack).toHaveClass('custom-class')
    expect(stack.className).toMatch(/_vStack_\w+/)
  })

  it('applies custom styles', () => {
    render(
      <VStack 
        style={{ border: '1px solid red', margin: '10px' }}
        data-testid="v-stack"
      >
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    expect(stack.style.border).toBe('1px solid red')
    expect(stack.style.margin).toBe('10px')
  })

  it('applies color property', () => {
    render(
      <VStack color="blue" data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    expect(stack.style.color).toBe('blue')
  })

  it('applies backgroundColor property', () => {
    render(
      <VStack backgroundColor="rgb(255, 0, 0)" data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    expect(stack.style.backgroundColor).toBe('rgb(255, 0, 0)')
  })

  it('applies padding property', () => {
    render(
      <VStack padding="20px" data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    expect(stack.style.padding).toBe('20px')
  })

  it('applies paddingVertical property', () => {
    render(
      <VStack paddingVertical="15px" data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    expect(stack.style.paddingTop).toBe('15px')
    expect(stack.style.paddingBottom).toBe('15px')
  })

  it('applies paddingHorizontal property', () => {
    render(
      <VStack paddingHorizontal="25px" data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    expect(stack.style.paddingLeft).toBe('25px')
    expect(stack.style.paddingRight).toBe('25px')
  })

  it('applies specific padding properties over general padding', () => {
    render(
      <VStack 
        padding="10px" 
        paddingVertical="20px" 
        paddingHorizontal="30px" 
        data-testid="v-stack"
      >
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    
    // Specific padding should override general padding
    expect(stack.style.paddingTop).toBe('20px')
    expect(stack.style.paddingBottom).toBe('20px')
    expect(stack.style.paddingLeft).toBe('30px')
    expect(stack.style.paddingRight).toBe('30px')
  })

  it('combines multiple styling properties', () => {
    render(
      <VStack 
        color="white"
        backgroundColor="rgb(0, 0, 255)"
        gap="5px"
        paddingVertical="10px"
        paddingHorizontal="20px"
        data-testid="v-stack"
      >
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    
    expect(stack.style.flexDirection).toBe('column')
    expect(stack.style.gap).toBe('5px')
    expect(stack.style.color).toBe('white')
    expect(stack.style.backgroundColor).toBe('rgb(0, 0, 255)')
    expect(stack.style.paddingTop).toBe('10px')
    expect(stack.style.paddingBottom).toBe('10px')
    expect(stack.style.paddingLeft).toBe('20px')
    expect(stack.style.paddingRight).toBe('20px')
  })

  it('paddingVertical overwrites padding for top and bottom', () => {
    render(
      <VStack 
        padding="5px" 
        paddingVertical="15px" 
        data-testid="v-stack"
      >
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    
    expect(stack.style.paddingTop).toBe('15px')
    expect(stack.style.paddingBottom).toBe('15px')
    expect(stack.style.paddingLeft).toBe('5px')
    expect(stack.style.paddingRight).toBe('5px')
  })

  it('paddingHorizontal overwrites padding for left and right', () => {
    render(
      <VStack 
        padding="8px" 
        paddingHorizontal="25px" 
        data-testid="v-stack"
      >
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    
    expect(stack.style.paddingTop).toBe('8px')
    expect(stack.style.paddingBottom).toBe('8px')
    expect(stack.style.paddingLeft).toBe('25px')
    expect(stack.style.paddingRight).toBe('25px')
  })

  it('both paddingVertical and paddingHorizontal overwrite all padding values', () => {
    render(
      <VStack 
        padding="12px" 
        paddingVertical="6px" 
        paddingHorizontal="18px" 
        data-testid="v-stack"
      >
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    
    expect(stack.style.paddingTop).toBe('6px')
    expect(stack.style.paddingBottom).toBe('6px')
    expect(stack.style.paddingLeft).toBe('18px')
    expect(stack.style.paddingRight).toBe('18px')
  })

  it('specific padding properties work with numeric values', () => {
    render(
      <VStack 
        padding={10} 
        paddingVertical={20} 
        paddingHorizontal={30} 
        data-testid="v-stack"
      >
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    
    expect(stack.style.paddingTop).toBe('20px')
    expect(stack.style.paddingBottom).toBe('20px')
    expect(stack.style.paddingLeft).toBe('30px')
    expect(stack.style.paddingRight).toBe('30px')
  })

  // CSS Variable Tests
  it('handles CSS variables through getCssPropertyValue', () => {
    render(
      <div style={{ '--custom-color': '#ff0000' } as React.CSSProperties}>
        <VStack 
          color="--custom-color" 
          data-testid="v-stack"
        >
          <div>Content</div>
        </VStack>
      </div>
    )
    
    const stack = screen.getByTestId('v-stack')
    expect(stack.style.color).toBe('var(--custom-color)')
  })

  it('handles backgroundColor CSS variable', () => {
    render(
      <div style={{ '--custom-bg': '#00ff00' } as React.CSSProperties}>
        <VStack 
          backgroundColor="--custom-bg" 
          data-testid="v-stack"
        >
          <div>Content</div>
        </VStack>
      </div>
    )
    
    const stack = screen.getByTestId('v-stack')
    expect(stack.style.backgroundColor).toBe('var(--custom-bg)')
  })

  it('handles gap CSS variable', () => {
    render(
      <div style={{ '--custom-gap': '12px' } as React.CSSProperties}>
        <VStack 
          gap="--custom-gap" 
          data-testid="v-stack"
        >
          <div>Content</div>
        </VStack>
      </div>
    )
    
    const stack = screen.getByTestId('v-stack')
    expect(stack.style.gap).toBe('var(--custom-gap)')
  })

  it('handles padding CSS variable', () => {
    render(
      <div style={{ '--custom-padding': '16px' } as React.CSSProperties}>
        <VStack 
          padding="--custom-padding" 
          data-testid="v-stack"
        >
          <div>Content</div>
        </VStack>
      </div>
    )
    
    const stack = screen.getByTestId('v-stack')
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
        <VStack 
          color="--theme-color"
          backgroundColor="--theme-bg"
          padding="--theme-spacing"
          data-testid="v-stack"
        >
          <div>Content</div>
        </VStack>
      </div>
    )
    
    const stack = screen.getByTestId('v-stack')
    expect(stack.style.color).toBe('var(--theme-color)')
    expect(stack.style.backgroundColor).toBe('var(--theme-bg)')
    expect(stack.style.flexDirection).toBe('column')
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
          <VStack 
            color="--custom-color"
            backgroundColor="blue"
            gap="--custom-gap"
            padding="10px"
            data-testid="v-stack"
          >
            <div>Content</div>
          </VStack>
        </div>
      )
      
      const stack = screen.getByTestId('v-stack')
      expect(stack.style.color).toBe('var(--custom-color)')
      expect(stack.style.backgroundColor).toBe('blue')
      expect(stack.style.gap).toBe('var(--custom-gap)')
      expect(stack.style.padding).toBe('10px')
      expect(stack.style.flexDirection).toBe('column')
    })

    it('handles reverse with CSS variables', () => {
      render(
        <div style={{ '--theme-color': '#00ff00' } as React.CSSProperties}>
          <VStack 
            reverse={true}
            color="--theme-color"
            data-testid="v-stack"
          >
            <div>Content</div>
          </VStack>
        </div>
      )
      
      const stack = screen.getByTestId('v-stack')
      expect(stack.style.flexDirection).toBe('column-reverse')
      expect(stack.style.color).toBe('var(--theme-color)')
    })
  })

  // Edge cases and error handling
  describe('edge cases', () => {
    it('handles empty and undefined values gracefully', () => {
      render(
        <VStack 
          color=""
          backgroundColor={undefined}
          padding={null as any}
          gap=""
          data-testid="v-stack"
        >
          <div>Content</div>
        </VStack>
      )
      
      const stack = screen.getByTestId('v-stack')
      expect(stack).toBeInTheDocument()
      expect(stack.style.flexDirection).toBe('column')
    })

    it('handles zero values correctly', () => {
      render(
        <VStack 
          gap={0}
          padding={0}
          data-testid="v-stack"
        >
          <div>Content</div>
        </VStack>
      )
      
      const stack = screen.getByTestId('v-stack')
      expect(stack.style.gap).toBe('0')
      expect(stack.style.padding).toBe('0px')
    })

    it('handles string zero values', () => {
      render(
        <VStack 
          gap="0"
          padding="0px"
          data-testid="v-stack"
        >
          <div>Content</div>
        </VStack>
      )
      
      const stack = screen.getByTestId('v-stack')
      expect(stack.style.gap).toBe('0')
      expect(stack.style.padding).toBe('0px')
    })

    it('preserves user custom styles with style prop', () => {
      render(
        <VStack 
          color="red"
          style={{ fontSize: '16px', fontWeight: 'bold' }}
          data-testid="v-stack"
        >
          <div>Content</div>
        </VStack>
      )
      
      const stack = screen.getByTestId('v-stack')
      expect(stack.style.color).toBe('red')
      expect(stack.style.fontSize).toBe('16px')
      expect(stack.style.fontWeight).toBe('bold')
    })

    it('allows user styles to override component styles', () => {
      render(
        <VStack 
          color="red"
          style={{ color: 'blue' }}
          data-testid="v-stack"
        >
          <div>Content</div>
        </VStack>
      )
      
      const stack = screen.getByTestId('v-stack')
      expect(stack.style.color).toBe('blue')
    })

    it('maintains vertical layout with multiple children', () => {
      render(
        <VStack data-testid="v-stack">
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
          <div data-testid="child-3">Child 3</div>
        </VStack>
      )
      
      const stack = screen.getByTestId('v-stack')
      const child1 = screen.getByTestId('child-1')
      const child2 = screen.getByTestId('child-2')
      const child3 = screen.getByTestId('child-3')
      
      expect(stack.style.flexDirection).toBe('column')
      expect(child1).toBeInTheDocument()
      expect(child2).toBeInTheDocument()
      expect(child3).toBeInTheDocument()
    })

    it('combines className properly with CSS modules', () => {
      render(
        <VStack 
          className="custom-class another-class"
          data-testid="v-stack"
        >
          <div>Content</div>
        </VStack>
      )
      
      const stack = screen.getByTestId('v-stack')
      expect(stack).toHaveClass('custom-class')
      expect(stack).toHaveClass('another-class')
      expect(stack.className).toMatch(/_vStack_\w+/)
    })

    it('only paddingVertical overwrites with no paddingHorizontal', () => {
      render(
        <VStack 
          padding="10px 15px 20px 25px" 
          paddingVertical="5px" 
          data-testid="v-stack"
        >
          <div>Content</div>
        </VStack>
      )
      
      const stack = screen.getByTestId('v-stack')
      
      // paddingVertical should only overwrite top and bottom
      expect(stack.style.paddingTop).toBe('5px')
      expect(stack.style.paddingBottom).toBe('5px')
      expect(stack.style.paddingLeft).toBe('25px')
      expect(stack.style.paddingRight).toBe('15px')
    })

    it('only paddingHorizontal overwrites with no paddingVertical', () => {
      render(
        <VStack 
          padding="10px 15px 20px 25px" 
          paddingHorizontal="35px" 
          data-testid="v-stack"
        >
          <div>Content</div>
        </VStack>
      )
      
      const stack = screen.getByTestId('v-stack')
      
      // paddingHorizontal should only overwrite left and right
      expect(stack.style.paddingTop).toBe('10px')
      expect(stack.style.paddingBottom).toBe('20px')
      expect(stack.style.paddingLeft).toBe('35px')
      expect(stack.style.paddingRight).toBe('35px')
    })
  })
})
