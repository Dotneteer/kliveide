import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SplitPanel } from '../src/renderer/common'

// --- Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

global.ResizeObserver = MockResizeObserver

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
      
      const primaryPanel = container.querySelector('[data-testid="primary-panel"]') as HTMLElement
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
      
      const splitter = container.querySelector('[data-testid="splitter"]') as HTMLElement
      expect(splitter?.style.display).not.toBe('none')
    })

    it('hides splitter when primary panel is hidden', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left" primaryVisible={false} secondaryVisible={true}>
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="splitter"]') as HTMLElement
      expect(splitter?.style.display).toBe('none')
    })

    it('hides splitter when secondary panel is hidden', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left" primaryVisible={true} secondaryVisible={false}>
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="splitter"]') as HTMLElement
      expect(splitter?.style.display).toBe('none')
    })

    it('hides splitter when both panels are hidden', () => {
      const { container } = render(
        <SplitPanel primaryLocation="left" primaryVisible={false} secondaryVisible={false}>
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="splitter"]') as HTMLElement
      expect(splitter?.style.display).toBe('none')
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
        const primaryPanel = container.querySelector('[data-testid="primary-panel"]') as HTMLElement
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
        const primaryPanel = container.querySelector('[data-testid="primary-panel"]') as HTMLElement
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
        const primaryPanel = container.querySelector('[data-testid="primary-panel"]') as HTMLElement
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
        const primaryPanel = container.querySelector('[data-testid="primary-panel"]') as HTMLElement
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
        const primaryPanel = container.querySelector('[data-testid="primary-panel"]') as HTMLElement
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
      
      const splitter = container.querySelector('[data-testid="splitter"]') as HTMLElement
      
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
      
      const splitter = container.querySelector('[data-testid="splitter"]') as HTMLElement
      
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
      
      const splitter = container.querySelector('[data-testid="splitter"]') as HTMLElement
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
      
      const splitter = container.querySelector('[data-testid="splitter"]') as HTMLElement
      expect(splitter.className).toMatch(/_horizontal_\w+/)
    })

    it('applies row-resize cursor for vertical splitter', () => {
      const { container } = render(
        <SplitPanel primaryLocation="top">
          <div>Primary</div>
          <div>Secondary</div>
        </SplitPanel>
      )
      
      const splitter = container.querySelector('[data-testid="splitter"]') as HTMLElement
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
      
      const panels = container.querySelectorAll('[data-testid="primary-panel"], [data-testid="secondary-panel"]')
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
      
      const panels = container.querySelectorAll('[data-testid="primary-panel"], [data-testid="secondary-panel"]')
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
      
      const panels = container.querySelectorAll('[data-testid="primary-panel"], [data-testid="secondary-panel"]')
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
      
      const panels = container.querySelectorAll('[data-testid="primary-panel"], [data-testid="secondary-panel"]')
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
      
      const splitter = container.querySelector('[data-testid="splitter"]') as HTMLElement
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
      const preventDefault = vi.spyOn(event, 'preventDefault')
      
      splitter.dispatchEvent(event)
      
      expect(preventDefault).toHaveBeenCalled()
    })
  })
})
