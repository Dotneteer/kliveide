// Test to validate spatial cursor logic
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

describe('Spatial Cursor Logic Validation', () => {
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

  it('validates enhanced spatial cursor behavior for top primary layout', () => {
    const { container } = render(
      <SplitPanel 
        primaryLocation="top" 
        initialPrimarySize="150px" // Start well within normal range 
        minPrimarySize="50px"     // Lower minimum
        maxPrimarySize="350px"    // Higher maximum
        minSecondarySize="50px"   // Lower minimum
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
    
    const panel = container.querySelector('[data-testid="split-panel"]') as HTMLElement
    const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
    
    console.log('🔍 Testing spatial cursor logic...')
    
    // Test 1: Normal resizing when not at constraints
    console.log('Test 1: Normal resizing when not at constraints (150px primary, 250px secondary)')
    act(() => {
      fireEvent.mouseDown(splitter, { clientX: 300, clientY: 150 }) // At the splitter position
    })
    
    console.log(`Global cursor: ${document.body.style.cursor}`)
    expect(document.body.style.cursor).toBe('row-resize') // Normal vertical resize
    
    act(() => {
      fireEvent.mouseUp(document)
    })
    
    console.log('✅ Spatial cursor logic validation complete!')
  })
  
  it('shows s-resize when mouse is above splitter and primary is at minimum size', () => {
    const { container } = render(
      <SplitPanel 
        primaryLocation="top" 
        initialPrimarySize="50px"  // Start at minimum
        minPrimarySize="50px"      // Minimum size
        maxPrimarySize="350px"     // Maximum size 
        minSecondarySize="50px"    // Minimum secondary size
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
    
    // Mouse is above the splitter (y=25) when primary is at minimum (50px)
    act(() => {
      fireEvent.mouseDown(splitter, { clientX: 300, clientY: 25 })
    })
    
    // Should show s-resize (can only move down)
    expect(document.body.style.cursor).toBe('s-resize')
    
    act(() => {
      fireEvent.mouseUp(document)
    })
  })
  
  it('shows n-resize when mouse is below splitter and primary is at maximum size', () => {
    const { container } = render(
      <SplitPanel 
        primaryLocation="top" 
        initialPrimarySize="350px"  // Start at maximum
        minPrimarySize="50px"       // Minimum size
        maxPrimarySize="350px"      // Maximum size
        minSecondarySize="50px"     // Minimum secondary size
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
    
    // Mouse is below the splitter (y=370) when primary is at maximum (350px)
    act(() => {
      fireEvent.mouseDown(splitter, { clientX: 300, clientY: 370 })
    })
    
    // Should show n-resize (can only move up)
    expect(document.body.style.cursor).toBe('n-resize')
    
    act(() => {
      fireEvent.mouseUp(document)
    })
  })
  
  it('shows e-resize when mouse is left of splitter and primary is at minimum (left layout)', () => {
    const { container } = render(
      <SplitPanel 
        primaryLocation="left" 
        initialPrimarySize="50px"  // Start at minimum
        minPrimarySize="50px"      // Minimum size
        maxPrimarySize="350px"     // Maximum size
        minSecondarySize="50px"    // Minimum secondary size
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
    
    // Mouse is left of the splitter (x=25) when primary is at minimum (50px)
    act(() => {
      fireEvent.mouseDown(splitter, { clientX: 25, clientY: 200 })
    })
    
    // Should show e-resize (can only move right)
    expect(document.body.style.cursor).toBe('e-resize')
    
    act(() => {
      fireEvent.mouseUp(document)
    })
  })
})
