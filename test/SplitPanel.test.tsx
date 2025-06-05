import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SplitPanel } from '../src/renderer/common'

// --- Mock ResizeObserver
class MockResizeObserver {
  callback: ResizeObserverCallback
  
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }
  
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  
  // Manual trigger for testing
  trigger(entries: ResizeObserverEntry[]) {
    this.callback(entries, this)
  }
}

global.ResizeObserver = MockResizeObserver as any

// --- Helper to simulate container size
const mockContainerSize = (width: number, height: number) => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    bottom: height,
    right: width,
    x: 0,
    y: 0,
    toJSON: () => ({})
  } as DOMRect)
}

describe('SplitPanel', () => {
  beforeEach(() => {
    mockContainerSize(800, 600)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders primary and secondary children correctly', () => {
    render(
      <SplitPanel primaryLocation="left" data-testid="split-panel">
        <div data-testid="primary">Primary Panel</div>
        <div data-testid="secondary">Secondary Panel</div>
      </SplitPanel>
    )
    
    expect(screen.getByTestId('primary')).toBeInTheDocument()
    expect(screen.getByTestId('secondary')).toBeInTheDocument()
    expect(screen.getByText('Primary Panel')).toBeInTheDocument()
    expect(screen.getByText('Secondary Panel')).toBeInTheDocument()
  })

  it('ignores additional children beyond the first two', () => {
    render(
      <SplitPanel primaryLocation="left" data-testid="split-panel">
        <div data-testid="primary">Primary Panel</div>
        <div data-testid="secondary">Secondary Panel</div>
        <div data-testid="third">Third Panel</div>
      </SplitPanel>
    )
    
    expect(screen.getByTestId('primary')).toBeInTheDocument()
    expect(screen.getByTestId('secondary')).toBeInTheDocument()
    expect(screen.queryByTestId('third')).not.toBeInTheDocument()
  })

  it('applies CSS module class correctly', () => {
    render(
      <SplitPanel primaryLocation="left" data-testid="split-panel">
        <div>Primary</div>
        <div>Secondary</div>
      </SplitPanel>
    )
    
    const panel = screen.getByTestId('split-panel')
    expect(panel.className).toMatch(/_splitPanel_\w+/)
  })

  it('applies custom className', () => {
    render(
      <SplitPanel primaryLocation="left" className="custom-split" data-testid="split-panel">
        <div>Primary</div>
        <div>Secondary</div>
      </SplitPanel>
    )
    
    const panel = screen.getByTestId('split-panel')
    expect(panel).toHaveClass('custom-split')
    expect(panel.className).toMatch(/_splitPanel_\w+/)
  })

  it('applies custom styles', () => {
    render(
      <SplitPanel 
        primaryLocation="left" 
        style={{ border: '1px solid red', margin: '10px' }}
        data-testid="split-panel"
      >
        <div>Primary</div>
        <div>Secondary</div>
      </SplitPanel>
    )
    
    const panel = screen.getByTestId('split-panel')
    expect(panel.style.border).toBe('1px solid red')
    expect(panel.style.margin).toBe('10px')
  })

  describe('Primary Location - Layout', () => {
    it('applies horizontal layout for left primary location', () => {
      render(
        <SplitPanel primaryLocation="left" data-testid="split-panel">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const panel = screen.getByTestId('split-panel')
      expect(panel.className).toMatch(/_horizontal_\w+/)
    })

    it('applies horizontal layout for right primary location', () => {
      render(
        <SplitPanel primaryLocation="right" data-testid="split-panel">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const panel = screen.getByTestId('split-panel')
      expect(panel.className).toMatch(/_horizontal_\w+/)
    })

    it('applies vertical layout for top primary location', () => {
      render(
        <SplitPanel primaryLocation="top" data-testid="split-panel">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const panel = screen.getByTestId('split-panel')
      expect(panel.className).toMatch(/_vertical_\w+/)
    })

    it('applies vertical layout for bottom primary location', () => {
      render(
        <SplitPanel primaryLocation="bottom" data-testid="split-panel">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const panel = screen.getByTestId('split-panel')
      expect(panel.className).toMatch(/_vertical_\w+/)
    })
  })

  describe('Panel Visibility', () => {
    it('shows primary panel when primaryVisible is true', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left" primaryVisible={true}>
          <div data-testid="primary">Primary</div>
          <div data-testid="secondary">Secondary</div>
        </SplitPanel>
      )
      
      const primaryPanel = container.querySelector('[data-testid="_$_SplitPanel-primary-panel"]') as HTMLElement
      expect(primaryPanel?.style.display).not.toBe('none')
    })

    it('hides primary panel when primaryVisible is false', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left" primaryVisible={false}>
          <div data-testid="primary">Primary</div>
          <div data-testid="secondary">Secondary</div>
        </SplitPanel>
      )
      
      const primaryPanel = container.querySelector('[data-testid="primary"]')?.parentElement as HTMLElement
      expect(primaryPanel?.style.display).toBe('none')
    })

    it('shows secondary panel when secondaryVisible is true', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left" secondaryVisible={true}>
          <div data-testid="primary">Primary</div>
          <div data-testid="secondary">Secondary</div>
        </SplitPanel>
      )
      
      const secondaryPanel = container.querySelector('[data-testid="secondary"]')?.parentElement as HTMLElement
      expect(secondaryPanel?.style.display).not.toBe('none')
    })

    it('hides secondary panel when secondaryVisible is false', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left" secondaryVisible={false}>
          <div data-testid="primary">Primary</div>
          <div data-testid="secondary">Secondary</div>
        </SplitPanel>
      )
      
      const secondaryPanel = container.querySelector('[data-testid="secondary"]')?.parentElement as HTMLElement
      expect(secondaryPanel?.style.display).toBe('none')
    })
  })

  describe('Splitter Visibility', () => {
    it('shows splitter when both panels are visible', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left" primaryVisible={true} secondaryVisible={true}>
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      expect(splitter?.style.display).not.toBe('none')
    })

    it('hides splitter when primary panel is hidden', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left" primaryVisible={false} secondaryVisible={true}>
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      expect(splitter?.style.display).toBe('none')
    })

    it('hides splitter when secondary panel is hidden', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left" primaryVisible={true} secondaryVisible={false}>
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      expect(splitter?.style.display).toBe('none')
    })

    it('hides splitter when both panels are hidden', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left" primaryVisible={false} secondaryVisible={false}>
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      expect(splitter?.style.display).toBe('none')
    })
  })

  describe('Splitter Sizing', () => {
    it('uses default splitter size of 4px', () => {
      mockContainerSize(800, 600)
      
      const { container } = render(
        <SplitPanel primaryLocation="left" data-testid="split-panel">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      expect(splitter?.style.width).toBe('4px')
    })

    it('applies custom splitter size for horizontal orientation', () => {
      mockContainerSize(800, 600)
      
      const { container } = render(
        <SplitPanel primaryLocation="left" splitterSize={8} data-testid="split-panel">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      expect(splitter?.style.width).toBe('8px')
      expect(splitter?.style.height).toBe('100%')
    })

    it('applies custom splitter size for vertical orientation', () => {
      mockContainerSize(800, 600)
      
      const { container } = render(
        <SplitPanel primaryLocation="top" splitterSize={12} data-testid="split-panel">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      expect(splitter?.style.height).toBe('12px')
      expect(splitter?.style.width).toBe('100%')
    })

    it('positions splitter correctly with custom size', async () => {
      mockContainerSize(800, 600)
      
      const { container } = render(
        <SplitPanel 
          primaryLocation="left" 
          splitterSize={10} 
          initialPrimarySize={300}
          data-testid="split-panel"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
        // Splitter should be positioned at primarySize - halfSplitterSize = 300 - 5 = 295px
        expect(splitter?.style.left).toBe('295px')
        expect(splitter?.style.width).toBe('10px')
      })
    })
  })

  describe('Primary Size Constraints', () => {
    it('applies default minimum primary size of 10%', async () => {
      mockContainerSize(1000, 600)
      
      const { container } = render(
        <SplitPanel primaryLocation="left" initialPrimarySize={5} data-testid="split-panel">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const primaryPanel = container.querySelector('[data-testid="_$_SplitPanel-primary-panel"]') as HTMLElement
        // Should clamp to 10% of 1000px = 100px, not 5px
        expect(primaryPanel?.style.width).toBe('100px')
      })
    })

    it('applies default maximum primary size of 90%', async () => {
      mockContainerSize(1000, 600)
      
      const { container } = render(
        <SplitPanel primaryLocation="left" initialPrimarySize={950} data-testid="split-panel">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const primaryPanel = container.querySelector('[data-testid="_$_SplitPanel-primary-panel"]') as HTMLElement
        // Should clamp to 90% of 1000px = 900px, not 950px
        expect(primaryPanel?.style.width).toBe('900px')
      })
    })

    it('applies custom minimum primary size', async () => {
      mockContainerSize(1000, 600)
      
      const { container } = render(
        <SplitPanel 
          primaryLocation="left" 
          initialPrimarySize={50} 
          minPrimarySize="20%"
          data-testid="split-panel"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const primaryPanel = container.querySelector('[data-testid="_$_SplitPanel-primary-panel"]') as HTMLElement
        // Should clamp to 20% of 1000px = 200px, not 50px
        expect(primaryPanel?.style.width).toBe('200px')
      })
    })

    it('applies custom maximum primary size', async () => {
      mockContainerSize(1000, 600)
      
      const { container } = render(
        <SplitPanel 
          primaryLocation="left" 
          initialPrimarySize={800} 
          maxPrimarySize="70%"
          data-testid="split-panel"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const primaryPanel = container.querySelector('[data-testid="_$_SplitPanel-primary-panel"]') as HTMLElement
        // Should clamp to 70% of 1000px = 700px, not 800px
        expect(primaryPanel?.style.width).toBe('700px')
      })
    })

    it('respects both min and max constraints during dragging', async () => {
      mockContainerSize(1000, 600)
      
      const { container } = render(
        <SplitPanel 
          primaryLocation="left" 
          minPrimarySize="20%" 
          maxPrimarySize="80%"
          data-testid="split-panel"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
        expect(splitter).toBeInTheDocument()
        
        // Try to drag beyond max constraint
        fireEvent.mouseDown(splitter, { clientX: 500 })
        fireEvent.mouseMove(document, { clientX: 900 }) // Try to make primary 900px (90%)
        fireEvent.mouseUp(document)
        
        const primaryPanel = container.querySelector('[data-testid="_$_SplitPanel-primary-panel"]') as HTMLElement
        // Should be clamped to 80% = 800px maximum
        expect(parseInt(primaryPanel?.style.width || '0')).toBeLessThanOrEqual(800)
      })
    })
  })

  describe('Initial Primary Size', () => {
    it('applies initialPrimarySize as percentage', async () => {
      mockContainerSize(800, 600)
      
      const { container } = render(
        <SplitPanel primaryLocation="left" initialPrimarySize="30%">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const primaryPanel = container.querySelector('[data-testid="_$_SplitPanel-primary-panel"]') as HTMLElement
        expect(primaryPanel?.style.width).toBe('240px') // 30% of 800px
      })
    })

    it('applies initialPrimarySize as pixels', async () => {
      mockContainerSize(800, 600)
      
      const { container } = render(
        <SplitPanel primaryLocation="left" initialPrimarySize={200}>
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const primaryPanel = container.querySelector('[data-testid="_$_SplitPanel-primary-panel"]') as HTMLElement
        expect(primaryPanel?.style.width).toBe('200px')
      })
    })

    it('applies initialPrimarySize as string pixels', async () => {
      mockContainerSize(800, 600)
      
      const { container } = render(
        <SplitPanel primaryLocation="left" initialPrimarySize="300px">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const primaryPanel = container.querySelector('[data-testid="_$_SplitPanel-primary-panel"]') as HTMLElement
        expect(primaryPanel?.style.width).toBe('300px')
      })
    })
  })

  describe('Minimum Sizes', () => {
    it('respects minPrimarySize constraint', async () => {
      mockContainerSize(800, 600)
      
      const { container } = render(
        <SplitPanel 
          primaryLocation="left" 
          initialPrimarySize={50} 
          minPrimarySize={100}
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const primaryPanel = container.querySelector('[data-testid="_$_SplitPanel-primary-panel"]') as HTMLElement
        expect(primaryPanel?.style.width).toBe('100px') // Clamped to minimum
      })
    })

    it('respects minSecondarySize constraint', async () => {
      mockContainerSize(800, 600)
      
      const { container } = render(
        <SplitPanel 
          primaryLocation="left" 
          initialPrimarySize={750} 
          minSecondarySize={100}
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const primaryPanel = container.querySelector('[data-testid="_$_SplitPanel-primary-panel"]') as HTMLElement
        expect(primaryPanel?.style.width).toBe('700px') // 800 - 100 (min secondary)
      })
    })
  })

  describe('Splitter Interaction', () => {
    it('calls onUpdatePrimarySize during drag', () => {
      const onUpdatePrimarySize = vi.fn()
      
      const { container } = render(
        <SplitPanel 
          primaryLocation="left" 
          onUpdatePrimarySize={onUpdatePrimarySize}
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      
      fireEvent.mouseDown(splitter, { clientX: 400 })
      fireEvent.mouseMove(document, { clientX: 450 })
      
      expect(onUpdatePrimarySize).toHaveBeenCalled()
    })

    it('calls onPrimarySizeUpdateCompleted on mouse up', () => {
      const onPrimarySizeUpdateCompleted = vi.fn()
      
      const { container } = render(
        <SplitPanel 
          primaryLocation="left" 
          onPrimarySizeUpdateCompleted={onPrimarySizeUpdateCompleted}
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      
      fireEvent.mouseDown(splitter, { clientX: 400 })
      fireEvent.mouseMove(document, { clientX: 450 })
      fireEvent.mouseUp(document)
      
      expect(onPrimarySizeUpdateCompleted).toHaveBeenCalled()
    })

    it('applies dragging class during mouse interaction', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left" data-testid="split-panel">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      const panel = container.querySelector('[data-testid="split-panel"]') as HTMLElement
      
      // Start dragging
      fireEvent.mouseDown(splitter, { clientX: 400 })
      
      expect(panel.className).toMatch(/_userSelecting_\w+/)
      expect(splitter.className).toMatch(/_dragging_\w+/)
      
      // End dragging
      fireEvent.mouseUp(document)
      
      expect(panel.className).not.toMatch(/_userSelecting_\w+/)
      expect(splitter.className).not.toMatch(/_dragging_\w+/)
    })
  })

  describe('Cursor Styles', () => {
    it('applies col-resize cursor for horizontal splitter', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      expect(splitter.className).toMatch(/_horizontal_\w+/)
    })

    it('applies row-resize cursor for vertical splitter', () => {
      const { container } = render(
        <SplitPanel primaryLocation="top">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      expect(splitter.className).toMatch(/_vertical_\w+/)
    })
  })

  describe('Panel Order', () => {
    it('renders primary panel first for left location', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left">
          <div data-testid="primary">Primary</div>
          <div data-testid="secondary">Secondary</div>
        </SplitPanel>
      )
      
      const panels = container.querySelectorAll('[data-testid="_$_SplitPanel-primary-panel"], [data-testid="_$_SplitPanel-secondary-panel"]')
      const firstPanel = panels[0]
      expect(firstPanel.querySelector('[data-testid="primary"]')).toBeInTheDocument()
    })

    it('renders primary panel first for top location', () => {
      const { container } = render(
        <SplitPanel primaryLocation="top">
          <div data-testid="primary">Primary</div>
          <div data-testid="secondary">Secondary</div>
        </SplitPanel>
      )
      
      const panels = container.querySelectorAll('[data-testid="_$_SplitPanel-primary-panel"], [data-testid="_$_SplitPanel-secondary-panel"]')
      const firstPanel = panels[0]
      expect(firstPanel.querySelector('[data-testid="primary"]')).toBeInTheDocument()
    })

    it('renders secondary panel first for right location', () => {
      const { container } = render(
        <SplitPanel primaryLocation="right">
          <div data-testid="primary">Primary</div>
          <div data-testid="secondary">Secondary</div>
        </SplitPanel>
      )
      
      const panels = container.querySelectorAll('[data-testid="_$_SplitPanel-primary-panel"], [data-testid="_$_SplitPanel-secondary-panel"]')
      const firstPanel = panels[0]
      expect(firstPanel.querySelector('[data-testid="secondary"]')).toBeInTheDocument()
    })

    it('renders secondary panel first for bottom location', () => {
      const { container } = render(
        <SplitPanel primaryLocation="bottom">
          <div data-testid="primary">Primary</div>
          <div data-testid="secondary">Secondary</div>
        </SplitPanel>
      )
      
      const panels = container.querySelectorAll('[data-testid="_$_SplitPanel-primary-panel"], [data-testid="_$_SplitPanel-secondary-panel"]')
      const firstPanel = panels[0]
      expect(firstPanel.querySelector('[data-testid="secondary"]')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles missing children gracefully', () => {
      render(
        <SplitPanel primaryLocation="left" data-testid="split-panel">
        </SplitPanel>
      )
      
      const panel = screen.getByTestId('split-panel')
      expect(panel).toBeInTheDocument()
    })

    it('handles single child gracefully', () => {
      render(
        <SplitPanel primaryLocation="left" data-testid="split-panel">
          <div data-testid="primary">Primary Only</div>
        </SplitPanel>
      )
      
      expect(screen.getByTestId('primary')).toBeInTheDocument()
      expect(screen.getByText('Primary Only')).toBeInTheDocument()
    })

    it('prevents default behavior on mouse down', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
      const preventDefault = vi.spyOn(event, 'preventDefault')
      
      splitter.dispatchEvent(event)
      
      expect(preventDefault).toHaveBeenCalled()
    })
  })

  describe('Cursor constraint behavior', () => {
    it('applies constrainedLeft class when left primary panel is at minimum size', async () => {
      mockContainerSize(800, 600)
      
      render(
        <SplitPanel 
          primaryLocation="left" 
          minPrimarySize="100px"
          initialPrimarySize="100px"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const splitter = screen.getByTestId('_$_SplitPanel-splitter')
        expect(splitter.className).toMatch(/constrainedLeft/)
      })
    })

    it('applies constrainedRight class when left primary panel is at maximum size', async () => {
      mockContainerSize(800, 600)
      
      render(
        <SplitPanel 
          primaryLocation="left" 
          maxPrimarySize="700px"
          initialPrimarySize="700px"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const splitter = screen.getByTestId('_$_SplitPanel-splitter')
        expect(splitter.className).toMatch(/constrainedRight/)
      })
    })

    it('applies constrainedRight class when right primary panel is at minimum size', async () => {
      mockContainerSize(800, 600)
      
      render(
        <SplitPanel 
          primaryLocation="right" 
          minPrimarySize="100px"
          initialPrimarySize="100px"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const splitter = screen.getByTestId('_$_SplitPanel-splitter')
        expect(splitter.className).toMatch(/constrainedRight/)
      })
    })

    it('applies constrainedLeft class when right primary panel is at maximum size', async () => {
      mockContainerSize(800, 600)
      
      render(
        <SplitPanel 
          primaryLocation="right" 
          maxPrimarySize="700px"
          initialPrimarySize="700px"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const splitter = screen.getByTestId('_$_SplitPanel-splitter')
        expect(splitter.className).toMatch(/constrainedLeft/)
      })
    })

    it('applies constrainedUp class when top primary panel is at minimum size', async () => {
      mockContainerSize(800, 600)
      
      render(
        <SplitPanel 
          primaryLocation="top" 
          minPrimarySize="100px"
          initialPrimarySize="100px"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const splitter = screen.getByTestId('_$_SplitPanel-splitter')
        expect(splitter.className).toMatch(/constrainedUp/)
      })
    })

    it('applies constrainedDown class when top primary panel is at maximum size', async () => {
      mockContainerSize(800, 600)
      
      render(
        <SplitPanel 
          primaryLocation="top" 
          maxPrimarySize="500px"
          initialPrimarySize="500px"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const splitter = screen.getByTestId('_$_SplitPanel-splitter')
        expect(splitter.className).toMatch(/constrainedDown/)
      })
    })

    it('applies constrainedDown class when bottom primary panel is at minimum size', async () => {
      mockContainerSize(800, 600)
      
      render(
        <SplitPanel 
          primaryLocation="bottom" 
          minPrimarySize="100px"
          initialPrimarySize="100px"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const splitter = screen.getByTestId('_$_SplitPanel-splitter')
        expect(splitter.className).toMatch(/constrainedDown/)
      })
    })

    it('applies constrainedUp class when bottom primary panel is at maximum size', async () => {
      mockContainerSize(800, 600)
      
      render(
        <SplitPanel 
          primaryLocation="bottom" 
          maxPrimarySize="500px"
          initialPrimarySize="500px"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const splitter = screen.getByTestId('_$_SplitPanel-splitter')
        expect(splitter.className).toMatch(/constrainedUp/)
      })
    })

    it('applies constraint when secondary panel reaches minimum size', async () => {
      mockContainerSize(800, 600)
      
      render(
        <SplitPanel 
          primaryLocation="left" 
          minSecondarySize="100px"
          initialPrimarySize="700px"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const splitter = screen.getByTestId('_$_SplitPanel-splitter')
        expect(splitter.className).toMatch(/constrainedLeft/)
      })
    })

    it('does not apply constraint classes when panel can resize freely', async () => {
      mockContainerSize(800, 600)
      
      render(
        <SplitPanel 
          primaryLocation="left" 
          minPrimarySize="100px"
          maxPrimarySize="600px"
          initialPrimarySize="300px"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const splitter = screen.getByTestId('_$_SplitPanel-splitter')
        expect(splitter.className).not.toMatch(/constrainedLeft/)
        expect(splitter.className).not.toMatch(/constrainedRight/)
        expect(splitter.className).not.toMatch(/constrainedUp/)
        expect(splitter.className).not.toMatch(/constrainedDown/)
      })
    })

    it('handles percentage-based constraints correctly', async () => {
      mockContainerSize(800, 600)
      
      render(
        <SplitPanel 
          primaryLocation="left" 
          minPrimarySize="10%"
          maxPrimarySize="90%"
          minSecondarySize="5%" // Lower minimum for secondary to test primary max
          initialPrimarySize="90%"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      await waitFor(() => {
        const splitter = screen.getByTestId('_$_SplitPanel-splitter')
        expect(splitter.className).toMatch(/constrainedRight/)
      })
    })

  })

  describe('Cursor persistence behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('applies persistent cursor after drag ends for unconstrained horizontal splitter', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left" data-testid="split-panel">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const panel = container.querySelector('[data-testid="split-panel"]') as HTMLElement
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      
      // Check initial state
      expect(panel.className).not.toMatch(/persistent/)
      
      // Start and end drag
      act(() => {
        fireEvent.mouseDown(splitter, { clientX: 400 })
        fireEvent.mouseUp(document)
      })
      
      // Should apply persistent col-resize cursor
      expect(panel.className).toMatch(/_persistentColResize_\w+/)
      
      // Should clear after timeout
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(panel.className).not.toMatch(/_persistentColResize_\w+/)
    })

    it('applies persistent cursor after drag ends for unconstrained vertical splitter', () => {
      const { container } = render(
        <SplitPanel primaryLocation="top" data-testid="split-panel">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const panel = container.querySelector('[data-testid="split-panel"]') as HTMLElement
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      
      // Start and end drag
      act(() => {
        fireEvent.mouseDown(splitter, { clientY: 400 })
        fireEvent.mouseUp(document)
      })
      
      // Should apply persistent row-resize cursor
      expect(panel.className).toMatch(/_persistentRowResize_\w+/)
      
      // Should clear after timeout
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(panel.className).not.toMatch(/_persistentRowResize_\w+/)
    })

    it('applies persistent constrained cursor after drag ends for left-constrained splitter', () => {
      const { container } = render(
        <SplitPanel 
          primaryLocation="left" 
          minPrimarySize="300px"
          initialPrimarySize="300px"
          data-testid="split-panel"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const panel = container.querySelector('[data-testid="split-panel"]') as HTMLElement
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      
      // Start and end drag
      act(() => {
        fireEvent.mouseDown(splitter, { clientX: 400 })
        fireEvent.mouseUp(document)
      })
      
      // Should apply persistent e-resize cursor for constrained left
      expect(panel.className).toMatch(/_persistentEResize_\w+/)
      
      // Should clear after timeout
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(panel.className).not.toMatch(/_persistentEResize_\w+/)
    })

    it('applies persistent constrained cursor after drag ends for right-constrained splitter', () => {
      const { container } = render(
        <SplitPanel 
          primaryLocation="left" 
          maxPrimarySize="100px"
          initialPrimarySize="100px"
          data-testid="split-panel"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const panel = container.querySelector('[data-testid="split-panel"]') as HTMLElement
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      
      // Start and end drag
      act(() => {
        fireEvent.mouseDown(splitter, { clientX: 400 })
        fireEvent.mouseUp(document)
      })
      
      // Should apply persistent w-resize cursor for constrained right
      expect(panel.className).toMatch(/_persistentWResize_\w+/)
      
      // Should clear after timeout
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(panel.className).not.toMatch(/_persistentWResize_\w+/)
    })

    it('does not apply persistent cursor without drag interaction', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left" data-testid="split-panel">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const panel = container.querySelector('[data-testid="split-panel"]') as HTMLElement
      
      // Should not have any persistent cursor classes initially
      expect(panel.className).not.toMatch(/_persistent\w+Resize_\w+/)
    })
  })

  describe('Global cursor during dragging', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
      // Cleanup any global styles that might have been set
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    })

    it('should set global cursor during horizontal drag', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left" data-testid="split-panel">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const panel = container.querySelector('[data-testid="split-panel"]') as HTMLElement
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      
      // Initially no global cursor
      expect(document.body.style.cursor).toBe('')
      expect(panel.className).not.toMatch(/_globalDragging_\w+/)
      
      // Start drag
      act(() => {
        fireEvent.mouseDown(splitter, { clientX: 250 })
      })
      
      // Should set global cursor and add globalDragging class
      expect(document.body.style.cursor).toBe('col-resize')
      expect(document.body.style.userSelect).toBe('none')
      expect(panel.className).toMatch(/_globalDragging_\w+/)
      
      // End drag
      act(() => {
        fireEvent.mouseUp(document)
      })
      
      // Should clear global cursor but keep globalDragging class cleared
      expect(document.body.style.cursor).toBe('')
      expect(document.body.style.userSelect).toBe('')
      expect(panel.className).not.toMatch(/_globalDragging_\w+/)
    })

    it('should set global cursor during vertical drag', () => {
      const { container } = render(
        <SplitPanel primaryLocation="top" data-testid="split-panel">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      
      // Start drag
      act(() => {
        fireEvent.mouseDown(splitter, { clientY: 150 })
      })
      
      // Should set global row-resize cursor
      expect(document.body.style.cursor).toBe('row-resize')
      expect(document.body.style.userSelect).toBe('none')
      
      // End drag
      act(() => {
        fireEvent.mouseUp(document)
      })
      
      // Should clear global cursor
      expect(document.body.style.cursor).toBe('')
      expect(document.body.style.userSelect).toBe('')
    })

    it('should set constrained global cursor when at limits', () => {
      const { container } = render(
        <SplitPanel 
          primaryLocation="left" 
          initialPrimarySize="10%" 
          minPrimarySize="10%"
          data-testid="split-panel"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      
      // Start drag when at minimum
      act(() => {
        fireEvent.mouseDown(splitter, { clientX: 50 })
      })
      
      // Should set constrained cursor (can only resize right)
      expect(document.body.style.cursor).toBe('e-resize')
      
      // End drag
      act(() => {
        fireEvent.mouseUp(document)
      })
      
      expect(document.body.style.cursor).toBe('')
    })

    it('should clean up global cursor on component unmount during drag', () => {
      const { container, unmount } = render(
        <SplitPanel primaryLocation="left" data-testid="split-panel">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      
      // Start drag
      act(() => {
        fireEvent.mouseDown(splitter, { clientX: 250 })
      })
      
      expect(document.body.style.cursor).toBe('col-resize')
      
      // Unmount component during drag
      act(() => {
        unmount()
      })
      
      // Should clean up global cursor
      expect(document.body.style.cursor).toBe('')
      expect(document.body.style.userSelect).toBe('')
    })
  })

  describe('Spatial cursor logic during dragging', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    })

    it('should show s-resize when mouse is above splitter and primary is at minimum (top layout)', () => {
      const { container } = render(
        <SplitPanel 
          primaryLocation="top" 
          initialPrimarySize="10%" 
          minPrimarySize="10%"
          data-testid="split-panel"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      
      // Mock getBoundingClientRect to simulate panel dimensions
      const mockGetBoundingClientRect = vi.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 600,
        height: 300,
      })
      
      const panel = container.querySelector('[data-testid="split-panel"]') as HTMLElement
      panel.getBoundingClientRect = mockGetBoundingClientRect
      
      // Start drag with mouse above the splitter (simulating mouse outside panel area)
      act(() => {
        fireEvent.mouseDown(splitter, { clientX: 300, clientY: 10 }) // Y=10 is above splitter
      })
      
      // Should show s-resize (can only move down)
      expect(document.body.style.cursor).toBe('s-resize')
      
      act(() => {
        fireEvent.mouseUp(document)
      })
    })

    it('should show e-resize when mouse is left of splitter and primary is at minimum (left layout)', () => {
      const { container } = render(
        <SplitPanel 
          primaryLocation="left" 
          initialPrimarySize="10%" 
          minPrimarySize="10%"
          data-testid="split-panel"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      
      // Mock getBoundingClientRect
      const mockGetBoundingClientRect = vi.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 600,
        height: 300,
      })
      
      const panel = container.querySelector('[data-testid="split-panel"]') as HTMLElement
      panel.getBoundingClientRect = mockGetBoundingClientRect
      
      // Start drag with mouse left of the splitter
      act(() => {
        fireEvent.mouseDown(splitter, { clientX: 30, clientY: 150 }) // X=30 is left of splitter
      })
      
      // Should show e-resize (can only move right)
      expect(document.body.style.cursor).toBe('e-resize')
      
      act(() => {
        fireEvent.mouseUp(document)
      })
    })

    it('should show w-resize when mouse is right of splitter and primary is at maximum (left layout)', () => {
      const { container } = render(
        <SplitPanel 
          primaryLocation="left" 
          initialPrimarySize="720px" // Explicitly set to pixels for more predictable test
          maxPrimarySize="720px"
          data-testid="split-panel"
        >
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="_$_SplitPanel-splitter"]') as HTMLElement
      
      // Mock getBoundingClientRect with a fixed pixel width for more consistent testing
      const mockGetBoundingClientRect = vi.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 800, // Use 800 to make percentage math simpler
        height: 300,
      })
      
      const panel = container.querySelector('[data-testid="split-panel"]') as HTMLElement
      panel.getBoundingClientRect = mockGetBoundingClientRect
      
      // Mock ResizeObserver to force size initialization
      const resizeObserverMock = vi.fn().mockImplementation((cb) => {
        // Immediately trigger with mock dimensions
        setTimeout(() => {
          cb([{
            contentRect: { width: 800, height: 300 },
            target: panel,
            contentBoxSize: [],
            borderBoxSize: [],
            devicePixelContentBoxSize: []
          }]);
        }, 0);
        return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
      });
      
      // @ts-ignore - Mock ResizeObserver
      global.ResizeObserver = resizeObserverMock;
      
      // Advance timers to ensure ResizeObserver fires
      act(() => {
        vi.advanceTimersByTime(10);
      });
      
      // Force the splitter to appear at the correct position
      splitter.style.left = '720px';
      
      console.log('TEST: Splitter at position:', splitter.style.left);
      
      // Start drag with mouse right of the splitter (770 > 720)
      act(() => {
        fireEvent.mouseDown(splitter, { clientX: 770, clientY: 150 }) 
      })
      
      // Should show w-resize (can only move left)
      expect(document.body.style.cursor).toBe('w-resize')
      
      act(() => {
        fireEvent.mouseUp(document)
      })
    })

    
  })
})
