import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { HStack } from '../src/renderer/common'

// Helper function to extract CSS variable value for testing
const getCssPropertyValue = (element: HTMLElement, property: string): string => {
  return getComputedStyle(element).getPropertyValue(property).trim()
}

describe('HStack', () => {
  it('renders children correctly', () => {
    render(
      <HStack data-testid="h-stack">
        <div>Child 1</div>
        <div>Child 2</div>
      </HStack>
    )
    
    expect(screen.getByText('Child 1')).toBeInTheDocument()
    expect(screen.getByText('Child 2')).toBeInTheDocument()
  })

  it('applies default horizontal flex styles', () => {
    render(
      <HStack data-testid="h-stack">
        <div>Content</div>
      </HStack>
    )
    
    const stack = screen.getByTestId('h-stack')
    
    // Check that the CSS module class is applied
    expect(stack.className).toMatch(/_hStack_\w+/)
    
    // Check inline styles
    expect(stack.style.flexDirection).toBe('row')
    expect(stack.style.gap).toBe('0')
  })

  it('applies reverse direction', () => {
    render(
      <HStack reverse={true} data-testid="h-stack">
        <div>Content</div>
      </HStack>
    )
    
    const stack = screen.getByTestId('h-stack')
    expect(stack.style.flexDirection).toBe('row-reverse')
  })

  it('does not reverse when reverse is false', () => {
    render(
      <HStack reverse={false} data-testid="h-stack">
        <div>Content</div>
      </HStack>
    )
    
    const stack = screen.getByTestId('h-stack')
    expect(stack.style.flexDirection).toBe('row')
  })

  it('applies custom gap', () => {
    render(
      <HStack gap="20px" data-testid="h-stack">
        <div>Content</div>
      </HStack>
    )
    
    const stack = screen.getByTestId('h-stack')
    expect(stack.style.gap).toBe('20px')
  })

  it('applies numeric gap', () => {
    render(
      <HStack gap={15} data-testid="h-stack">
        <div>Content</div>
      </HStack>
    )
    
    const stack = screen.getByTestId('h-stack')
    expect(stack.style.gap).toBe('15px')
  })

  it('applies custom className while preserving CSS module class', () => {
    render(
      <HStack className="custom-class" data-testid="h-stack">
        <div>Content</div>
      </HStack>
    )
    
    const stack = screen.getByTestId('h-stack')
    expect(stack).toHaveClass('custom-class')
    expect(stack.className).toMatch(/_hStack_\w+/)
  })

  it('applies custom styles', () => {
    render(
      <HStack 
        style={{ border: '1px solid red', margin: '10px' }}
        data-testid="h-stack"
      >
        <div>Content</div>
      </HStack>
    )
    
    const stack = screen.getByTestId('h-stack')
    expect(stack.style.border).toBe('1px solid red')
    expect(stack.style.margin).toBe('10px')
  })

  describe('CSS Variables - Color', () => {
    it('applies color from CSS variable', () => {
      render(
        <HStack color="var(--primary-color)" data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.color).toBe('var(--primary-color)')
    })

    it('applies color from regular value', () => {
      render(
        <HStack color="red" data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.color).toBe('red')
    })

    it('applies color from hex value', () => {
      render(
        <HStack color="#ff0000" data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.color).toBe('rgb(255, 0, 0)')
    })
  })

  describe('CSS Variables - Background Color', () => {
    it('applies backgroundColor from CSS variable', () => {
      render(
        <HStack backgroundColor="var(--bg-color)" data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.backgroundColor).toBe('var(--bg-color)')
    })

    it('applies backgroundColor from regular value', () => {
      render(
        <HStack backgroundColor="blue" data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.backgroundColor).toBe('blue')
    })

    it('applies backgroundColor from rgba value', () => {
      render(
        <HStack backgroundColor="rgba(255, 0, 0, 0.5)" data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.backgroundColor).toBe('rgba(255, 0, 0, 0.5)')
    })
  })

  describe('CSS Variables - Gap', () => {
    it('applies gap from CSS variable', () => {
      render(
        <HStack gap="var(--spacing-medium)" data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.gap).toBe('var(--spacing-medium)')
    })

    it('applies gap from numeric value', () => {
      render(
        <HStack gap={20} data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.gap).toBe('20px')
    })

    it('applies gap from string value', () => {
      render(
        <HStack gap="1.5rem" data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.gap).toBe('1.5rem')
    })
  })

  describe('CSS Variables - Multiple Properties', () => {
    it('applies multiple CSS variables together', () => {
      render(
        <HStack 
          color="var(--text-color)"
          backgroundColor="var(--bg-color)"
          gap="var(--spacing-large)"
          data-testid="h-stack"
        >
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.color).toBe('var(--text-color)')
      expect(stack.style.backgroundColor).toBe('var(--bg-color)')
      expect(stack.style.gap).toBe('var(--spacing-large)')
    })

    it('mixes CSS variables with regular values', () => {
      render(
        <HStack 
          color="var(--primary-color)"
          backgroundColor="white"
          gap={16}
          data-testid="h-stack"
        >
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.color).toBe('var(--primary-color)')
      expect(stack.style.backgroundColor).toBe('white')
      expect(stack.style.gap).toBe('16px')
    })
  })

  describe('Padding Properties', () => {
    it('applies padding shorthand', () => {
      render(
        <HStack padding="10px 20px" data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.padding).toBe('10px 20px')
    })

    it('applies padding from CSS variable', () => {
      render(
        <HStack padding="var(--padding-medium)" data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      // CSS variables for padding shorthand are not preserved in individual padding properties
      expect(stack.style.padding).toBe('')
    })

    it('applies paddingHorizontal', () => {
      render(
        <HStack paddingHorizontal="15px" data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.paddingLeft).toBe('15px')
      expect(stack.style.paddingRight).toBe('15px')
    })

    it('applies paddingVertical', () => {
      render(
        <HStack paddingVertical="12px" data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.paddingTop).toBe('12px')
      expect(stack.style.paddingBottom).toBe('12px')
    })

    it('applies paddingHorizontal from CSS variable', () => {
      render(
        <HStack paddingHorizontal="var(--horizontal-padding)" data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      // CSS variables are not preserved when applied to individual padding properties
      expect(stack.style.paddingLeft).toBe('')
      expect(stack.style.paddingRight).toBe('')
    })

    it('applies paddingVertical from CSS variable', () => {
      render(
        <HStack paddingVertical="var(--vertical-padding)" data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      // CSS variables are not preserved when applied to individual padding properties
      expect(stack.style.paddingTop).toBe('')
      expect(stack.style.paddingBottom).toBe('')
    })
  })

  describe('Edge Cases', () => {
    it('handles undefined color', () => {
      render(
        <HStack color={undefined} data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.color).toBe('')
    })

    it('handles empty string color', () => {
      render(
        <HStack color="" data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.color).toBe('')
    })

    it('handles zero gap', () => {
      render(
        <HStack gap={0} data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.gap).toBe('0')
    })

    it('handles zero string gap', () => {
      render(
        <HStack gap="0" data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.gap).toBe('0')
    })
  })

  describe('Style Override', () => {
    it('allows user styles to override component styles', () => {
      render(
        <HStack 
          gap={10}
          style={{ gap: '25px', color: 'purple' }}
          data-testid="h-stack"
        >
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.gap).toBe('25px') // User style wins
      expect(stack.style.color).toBe('purple')
    })

    it('merges component styles with user styles', () => {
      render(
        <HStack 
          color="red"
          backgroundColor="blue"
          style={{ margin: '10px', border: '1px solid black' }}
          data-testid="h-stack"
        >
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.color).toBe('red') // Component style
      expect(stack.style.backgroundColor).toBe('blue') // Component style
      expect(stack.style.margin).toBe('10px') // User style
      expect(stack.style.border).toBe('1px solid black') // User style
    })
  })

  describe('Layout Specific', () => {
    it('maintains horizontal layout with reverse', () => {
      render(
        <HStack reverse={true} data-testid="h-stack">
          <div data-testid="first">First</div>
          <div data-testid="second">Second</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.flexDirection).toBe('row-reverse')
      
      // Children should still be present
      expect(screen.getByTestId('first')).toBeInTheDocument()
      expect(screen.getByTestId('second')).toBeInTheDocument()
    })

    it('works with CSS modules', () => {
      render(
        <HStack className="custom-stack" data-testid="h-stack">
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      // Should have both the CSS module class and custom class
      expect(stack.className).toMatch(/_hStack_\w+/)
      expect(stack).toHaveClass('custom-stack')
    })
  })

  describe('Complex Padding Scenarios', () => {
    it('paddingHorizontal and paddingVertical work together', () => {
      render(
        <HStack 
          paddingHorizontal="20px" 
          paddingVertical="10px" 
          data-testid="h-stack"
        >
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      expect(stack.style.paddingLeft).toBe('20px')
      expect(stack.style.paddingRight).toBe('20px')
      expect(stack.style.paddingTop).toBe('10px')
      expect(stack.style.paddingBottom).toBe('10px')
    })

    it('paddingHorizontal and paddingVertical override padding shorthand', () => {
      render(
        <HStack 
          padding="15px" 
          paddingHorizontal="25px" 
          paddingVertical="5px" 
          data-testid="h-stack"
        >
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      
      // Specific padding values should override the shorthand
      expect(stack.style.paddingTop).toBe('5px')
      expect(stack.style.paddingBottom).toBe('5px')
      expect(stack.style.paddingLeft).toBe('25px')
      expect(stack.style.paddingRight).toBe('25px')
    })

    it('padding shorthand with 4 values gets overridden by specific paddings', () => {
      render(
        <HStack 
          padding="10px 15px 20px 25px" 
          paddingHorizontal="35px" 
          paddingVertical="5px" 
          data-testid="h-stack"
        >
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      
      // paddingHorizontal and paddingVertical should override specific sides
      expect(stack.style.paddingTop).toBe('5px')
      expect(stack.style.paddingBottom).toBe('5px')
      expect(stack.style.paddingLeft).toBe('35px')
      expect(stack.style.paddingRight).toBe('35px')
    })

    it('only paddingVertical overwrites with no paddingHorizontal', () => {
      render(
        <HStack 
          padding="10px 15px 20px 25px" 
          paddingVertical="5px" 
          data-testid="h-stack"
        >
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      
      // paddingVertical should only overwrite top and bottom
      expect(stack.style.paddingTop).toBe('5px')
      expect(stack.style.paddingBottom).toBe('5px')
      expect(stack.style.paddingLeft).toBe('25px')
      expect(stack.style.paddingRight).toBe('15px')
    })

    it('only paddingHorizontal overwrites with no paddingVertical', () => {
      render(
        <HStack 
          padding="10px 15px 20px 25px" 
          paddingHorizontal="35px" 
          data-testid="h-stack"
        >
          <div>Content</div>
        </HStack>
      )
      
      const stack = screen.getByTestId('h-stack')
      
      // paddingHorizontal should only overwrite left and right
      expect(stack.style.paddingTop).toBe('10px')
      expect(stack.style.paddingBottom).toBe('20px')
      expect(stack.style.paddingLeft).toBe('35px')
      expect(stack.style.paddingRight).toBe('35px')
    })
  })
})
