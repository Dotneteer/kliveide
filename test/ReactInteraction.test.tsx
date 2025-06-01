import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// --- Mock a simple React component for testing interaction
function CounterComponent() {
  const [count, setCount] = React.useState(0)
  
  return (
    <div>
      <h2>Counter: {count}</h2>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(count - 1)}>Decrement</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  )
}

describe('React Component Interactions', () => {
  it('should handle button clicks correctly', async () => {
    const user = userEvent.setup()
    render(<CounterComponent />)

    const heading = screen.getByRole('heading', { level: 2 })
    const incrementBtn = screen.getByText('Increment')
    const decrementBtn = screen.getByText('Decrement')
    const resetBtn = screen.getByText('Reset')

    // --- Initial state
    expect(heading).toHaveTextContent('Counter: 0')

    // --- Increment
    await user.click(incrementBtn)
    expect(heading).toHaveTextContent('Counter: 1')

    await user.click(incrementBtn)
    expect(heading).toHaveTextContent('Counter: 2')

    // --- Decrement
    await user.click(decrementBtn)
    expect(heading).toHaveTextContent('Counter: 1')

    // --- Reset
    await user.click(resetBtn)
    expect(heading).toHaveTextContent('Counter: 0')
  })

  it('should handle multiple rapid clicks', async () => {
    const user = userEvent.setup()
    render(<CounterComponent />)

    const heading = screen.getByRole('heading', { level: 2 })
    const incrementBtn = screen.getByText('Increment')

    // --- Click multiple times quickly
    await user.click(incrementBtn)
    await user.click(incrementBtn)
    await user.click(incrementBtn)

    expect(heading).toHaveTextContent('Counter: 3')
  })
})
