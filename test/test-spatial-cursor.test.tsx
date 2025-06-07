// Test to validate standard resize cursor behavior
import { render, fireEvent, act } from '@testing-library/react'
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest'
import SplitPanel from '../src/renderer/common/SplitPanel'

// --- Helper for panel size setup
class MockResizeObserver {
  callback: ResizeObserverCallback
  
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }
  
  observe = vi.fn(() => {
    // Immediately trigger the callback with the mock dimensions
    // This ensures our component initializes with the correct size
    const entry = {
      contentRect: { width: 600, height: 400 },
      target: document.createElement('div'),
      contentBoxSize: [],
      borderBoxSize: [],
      devicePixelContentBoxSize: []
    } as unknown as ResizeObserverEntry;
    
    // Call the callback as if the observer detected a resize
    setTimeout(() => {
      this.callback([entry], this);
    }, 0);
  });
  
  unobserve = vi.fn()
  disconnect = vi.fn()
}

global.ResizeObserver = MockResizeObserver as any

describe('Standard Resize Cursor Validation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    
    // Mock getBoundingClientRect for all elements
    const mockGetBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      top: 0,
      width: 600,
      height: 400,
      x: 0, 
      y: 0,
      right: 600,
      bottom: 400,
      toJSON: () => ({})
    });
    
    Element.prototype.getBoundingClientRect = mockGetBoundingClientRect;
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  it('shows row-resize cursor for horizontal orientation (top/bottom)', () => {
    const { container } = render(
      <SplitPanel 
        primaryLocation="top" 
        initialPrimarySize="150px" 
        minPrimarySize="50px"
        maxPrimarySize="350px"
        minSecondarySize="50px"
        data-testid="split-panel"
      >
        <div>Primary</div>
        <div>Secondary</div>
      </SplitPanel>
    )
    
    // Force dimensions update by advancing timers
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
    
    act(() => {
      fireEvent.mouseDown(splitter, { clientX: 300, clientY: 150 })
    })
    
    expect(document.body.style.cursor).toBe('row-resize')
    
    act(() => {
      fireEvent.mouseUp(document)
    })
  })
  
  it('shows col-resize cursor for vertical orientation (left/right)', () => {
    const { container } = render(
      <SplitPanel 
        primaryLocation="left" 
        initialPrimarySize="150px"
        minPrimarySize="50px"
        maxPrimarySize="350px"
        minSecondarySize="50px"
        data-testid="split-panel"
      >
        <div>Primary</div>
        <div>Secondary</div>
      </SplitPanel>
    )
    
    // Force dimensions update by advancing timers
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
    
    act(() => {
      fireEvent.mouseDown(splitter, { clientX: 150, clientY: 200 })
    })
    
    expect(document.body.style.cursor).toBe('col-resize')
    
    act(() => {
      fireEvent.mouseUp(document)
    })
  })
  
  it('uses standard resize cursor even at minimum size', () => {
    const { container } = render(
      <SplitPanel 
        primaryLocation="top" 
        initialPrimarySize="50px"  // Start at minimum
        minPrimarySize="50px"
        maxPrimarySize="350px"
        minSecondarySize="50px"
        data-testid="split-panel"
      >
        <div>Primary</div>
        <div>Secondary</div>
      </SplitPanel>
    )
    
    // Force dimensions update by advancing timers
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
    
    act(() => {
      fireEvent.mouseDown(splitter, { clientX: 300, clientY: 50 })
    })
    
    expect(document.body.style.cursor).toBe('row-resize')
    
    act(() => {
      fireEvent.mouseUp(document)
    })
  })
})
