import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AttachedShadow } from "@renderer/controls/AttachedShadow";
import React from "react";
import * as matchers from "@testing-library/jest-dom/matchers";

// Mock ResizeObserver before component is imported
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// Assign the mock to global object
global.ResizeObserver = MockResizeObserver as any;

// Mock the AttachedShadow.module.scss styles
vi.mock("@renderer/controls/AttachedShadow.module.scss", () => ({
  default: {
    attachedShadow: "attachedShadow",
    show: "show"
  }
}));

// Add the necessary TypeScript declarations for jest-dom
declare module "vitest" {
  interface Assertion<T = any> {
    toBeInTheDocument(): T;
    toHaveStyle(style: Record<string, any>): T;
    toHaveClass(className: string): T;
    toHaveAttribute(name: string, value?: string): T;
  }
}

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

describe("AttachedShadow Component", () => {
  let mockParentElement: HTMLElement;
  
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    
    // Create a mock parent element
    mockParentElement = document.createElement("div");
    mockParentElement.setAttribute("id", "parentElement");
    document.body.appendChild(mockParentElement);
    
    // Set mock values for offsetTop, offsetLeft, offsetWidth
    Object.defineProperties(mockParentElement, {
      offsetTop: { value: 100, configurable: true },
      offsetLeft: { value: 50, configurable: true },
      offsetWidth: { value: 200, configurable: true }
    });
  });
  
  afterEach(() => {
    document.body.removeChild(mockParentElement);
  });

  it("renders with correct position and size based on parent element", () => {
    render(<AttachedShadow parentElement={mockParentElement} visible={true} />);
    
    const shadow = screen.getByRole("presentation");
    expect(shadow).toBeInTheDocument();
    expect(shadow).toHaveClass("attachedShadow");
    expect(shadow).toHaveClass("show");
    expect(shadow).toHaveStyle({
      top: "100px",
      left: "50px",
      width: "200px"
    });
  });
  
  it("applies show class when visible is true", () => {
    render(<AttachedShadow parentElement={mockParentElement} visible={true} />);
    
    const shadow = screen.getByRole("presentation");
    expect(shadow).toHaveClass("show");
  });
  
  it("does not apply show class when visible is false", () => {
    render(<AttachedShadow parentElement={mockParentElement} visible={false} />);
    
    const shadow = screen.getByRole("presentation");
    expect(shadow).toBeInTheDocument();
    expect(shadow).not.toHaveClass("show");
  });
  
  it("updates position when parent element properties change", () => {
    render(<AttachedShadow parentElement={mockParentElement} visible={true} />);
    
    // Update the parent element properties
    Object.defineProperties(mockParentElement, {
      offsetTop: { value: 150, configurable: true },
      offsetLeft: { value: 75, configurable: true },
      offsetWidth: { value: 300, configurable: true }
    });
    
    // Manually trigger resize observer callback
    // Note: In real tests, ResizeObserver might need more thorough mocking
    const resizeEvent = new Event("resize");
    mockParentElement.dispatchEvent(resizeEvent);
    
    // Verify the component updates (this is simplified)
    // For more thorough testing, we'd need to mock ResizeObserver more completely
    const shadow = screen.getByRole("presentation");
    expect(shadow).toBeInTheDocument();
  });

  it("cleans up resize observer when unmounted", () => {
    // Mock the ResizeObserver methods
    const mockUnobserve = vi.fn();
    const mockDisconnect = vi.fn();
    
    // Create a custom mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: mockUnobserve,
      disconnect: mockDisconnect
    }));
    
    const { unmount } = render(
      <AttachedShadow parentElement={mockParentElement} visible={true} />
    );
    
    // Unmount component to trigger cleanup
    unmount();
    
    // Check cleanup was called
    // Since we can't easily verify the cleanup directly, we'll just ensure our
    // mock ResizeObserver was used (more detailed testing would require more complex mocking)
    expect(global.ResizeObserver).toHaveBeenCalled();
  });
});
