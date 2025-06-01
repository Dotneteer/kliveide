import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { VStack } from '../src/renderer/common'

describe('VStack', () => {
  it('renders children correctly', () => {
    render(
      <VStack>
        <div>Test Content</div>
      </VStack>
    )
    
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('applies default flex styles', () => {
    render(
      <VStack data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    
    // Check that the CSS module class is applied (this ensures SCSS will be loaded)
    expect(stack.className).toMatch(/_vStack_\w+/)
    
    // Check inline styles that we can verify
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

  it('applies normal direction by default', () => {
    render(
      <VStack data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    
    expect(stack.style.flexDirection).toBe('column')
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
      <VStack gap="16px" data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.gap).toBe('16px')
  })

  it('applies custom className', () => {
    render(
      <VStack className="custom-stack" data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    expect(stack).toHaveClass('custom-stack')
    // --- Check that CSS module class is applied (starts with underscore)
    expect(stack.className).toMatch(/_vStack_\w+/)
  })

  it('applies custom styles', () => {
    render(
      <VStack 
        style={{ backgroundColor: 'red', padding: '10px' }}
        data-testid="v-stack"
      >
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.backgroundColor).toBe('rgb(255, 0, 0)')
    expect(styles.padding).toBe('10px')
  })

  it('applies color property', () => {
    render(
      <VStack color="blue" data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    const styles = window.getComputedStyle(stack)
    
    // Browser normalizes "blue" to rgb(0, 0, 255)
    expect(styles.color).toBe('rgb(0, 0, 255)')
  })

  it('applies backgroundColor property', () => {
    render(
      <VStack backgroundColor="rgb(255, 0, 0)" data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.backgroundColor).toBe('rgb(255, 0, 0)')
  })

  it('applies padding property', () => {
    render(
      <VStack padding="20px" data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.padding).toBe('20px')
  })

  it('applies paddingVertical property', () => {
    render(
      <VStack paddingVertical="15px" data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.paddingTop).toBe('15px')
    expect(styles.paddingBottom).toBe('15px')
  })

  it('applies paddingHorizontal property', () => {
    render(
      <VStack paddingHorizontal="25px" data-testid="v-stack">
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    const styles = window.getComputedStyle(stack)
    
    expect(styles.paddingLeft).toBe('25px')
    expect(styles.paddingRight).toBe('25px')
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
    const styles = window.getComputedStyle(stack)
    
    // Specific padding should override general padding
    expect(styles.paddingTop).toBe('20px')
    expect(styles.paddingBottom).toBe('20px')
    expect(styles.paddingLeft).toBe('30px')
    expect(styles.paddingRight).toBe('30px')
  })

  it('combines multiple styling properties', () => {
    render(
      <VStack 
        color="white"
        backgroundColor="rgb(0, 0, 255)"
        paddingVertical="10px"
        paddingHorizontal="20px"
        data-testid="v-stack"
      >
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    const styles = window.getComputedStyle(stack)
    
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
      <VStack 
        padding="5px" 
        paddingVertical="15px" 
        data-testid="v-stack"
      >
        <div>Content</div>
      </VStack>
    )
    
    const stack = screen.getByTestId('v-stack')
    const styles = window.getComputedStyle(stack)
    
    // paddingVertical should overwrite top and bottom, but leave left and right from padding
    expect(styles.paddingTop).toBe('15px')
    expect(styles.paddingBottom).toBe('15px')
    expect(styles.paddingLeft).toBe('5px')
    expect(styles.paddingRight).toBe('5px')
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
    const styles = window.getComputedStyle(stack)
    
    // paddingHorizontal should overwrite left and right, but leave top and bottom from padding
    expect(styles.paddingTop).toBe('8px')
    expect(styles.paddingBottom).toBe('8px')
    expect(styles.paddingLeft).toBe('25px')
    expect(styles.paddingRight).toBe('25px')
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
    const styles = window.getComputedStyle(stack)
    
    // Both specific paddings should completely overwrite the general padding
    expect(styles.paddingTop).toBe('6px')
    expect(styles.paddingBottom).toBe('6px')
    expect(styles.paddingLeft).toBe('18px')
    expect(styles.paddingRight).toBe('18px')
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
    const styles = window.getComputedStyle(stack)
    
    // Numeric values should be converted and override properly
    expect(styles.paddingTop).toBe('20px')
    expect(styles.paddingBottom).toBe('20px')
    expect(styles.paddingLeft).toBe('30px')
    expect(styles.paddingRight).toBe('30px')
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
    const styles = window.getComputedStyle(stack)
    
    // paddingVertical should only overwrite top and bottom
    expect(styles.paddingTop).toBe('5px')
    expect(styles.paddingBottom).toBe('5px')
    expect(styles.paddingLeft).toBe('25px')
    expect(styles.paddingRight).toBe('15px')
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
    const styles = window.getComputedStyle(stack)
    
    // paddingHorizontal should only overwrite left and right
    expect(styles.paddingTop).toBe('10px')
    expect(styles.paddingBottom).toBe('20px')
    expect(styles.paddingLeft).toBe('35px')
    expect(styles.paddingRight).toBe('35px')
  })
})
