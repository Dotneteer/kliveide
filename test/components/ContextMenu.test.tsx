import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, renderHook, act } from "@testing-library/react";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, useContextMenuState, ContextMenuState } from "@renderer/controls/ContextMenu";
import React from "react";
import * as matchers from "@testing-library/jest-dom/matchers";

// Mock the styles
vi.mock("@renderer/controls/ContextMenu.module.scss", () => ({
  default: {
    contextMenu: "contextMenu",
    menuItem: "menuItem",
    dangerous: "dangerous",
    disabled: "disabled",
    separator: "separator"
  }
}));

// Mock the popper.js library
vi.mock("react-popper", () => ({
  usePopper: vi.fn().mockReturnValue({
    styles: {
      popper: { position: "absolute", top: "100px", left: "100px" }
    },
    attributes: {
      popper: {}
    }
  })
}));

// Mock createPortal
vi.mock("react-dom", () => ({
  createPortal: vi.fn((element) => element)
}));

// Add the necessary TypeScript declarations for jest-dom
declare module "vitest" {
  interface Assertion<T = any> {
    toBeInTheDocument(): T;
    toHaveStyle(style: Record<string, any>): T;
    toHaveClass(className: string): T;
    toHaveAttribute(name: string, value?: string): T;
    toBeEnabled(): T;
    toBeDisabled(): T;
    toHaveFocus(): T;
    toHaveTextContent(text: string | RegExp): T;
  }
}

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

describe("ContextMenu Components", () => {
  // Setup for main ContextMenu tests
  const mockOnClickOutside = vi.fn();
  let mockState: ContextMenuState;

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockOnClickOutside.mockClear();

    // Create a mock state for testing
    mockState = {
      contextVisible: true,
      contextRef: document.createElement("div"),
      contextX: 10,
      contextY: 20
    };
    
    // Create a mock themeRoot element for portal rendering
    const themeRoot = document.createElement("div");
    themeRoot.setAttribute("id", "themeRoot");
    document.body.appendChild(themeRoot);
  });

  afterEach(() => {
    const themeRoot = document.getElementById("themeRoot");
    if (themeRoot) {
      document.body.removeChild(themeRoot);
    }
  });

  describe("ContextMenu", () => {
    it("renders when visible", () => {
      render(
        <ContextMenu 
          state={{ ...mockState, contextVisible: true }} 
          onClickOutside={mockOnClickOutside}
        >
          <div data-testid="menu-content">Menu Content</div>
        </ContextMenu>
      );

      const menuContent = screen.getByTestId("menu-content");
      expect(menuContent).toBeInTheDocument();
      expect(menuContent).toHaveTextContent("Menu Content");
    });

    it("doesn't render when not visible", () => {
      const { container } = render(
        <ContextMenu 
          state={{ ...mockState, contextVisible: false }} 
          onClickOutside={mockOnClickOutside}
        >
          <div data-testid="menu-content">Menu Content</div>
        </ContextMenu>
      );

      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId("menu-content")).not.toBeInTheDocument();
    });

    it("applies proper ARIA attributes", () => {
      render(
        <ContextMenu 
          state={{ ...mockState, contextVisible: true }} 
          onClickOutside={mockOnClickOutside}
        >
          <div data-testid="menu-content">Menu Content</div>
        </ContextMenu>
      );

      const menu = screen.getByRole("menu");
      expect(menu).toBeInTheDocument();
      expect(menu).toHaveAttribute("aria-orientation", "vertical");
      expect(menu).toHaveAttribute("tabIndex", "0");
    });

    it("handles keyboard navigation - Escape key", () => {
      render(
        <ContextMenu 
          state={{ ...mockState, contextVisible: true }} 
          onClickOutside={mockOnClickOutside}
        >
          <div data-testid="menu-content">Menu Content</div>
        </ContextMenu>
      );

      const menu = screen.getByRole("menu");
      
      // Press Escape
      fireEvent.keyDown(menu, { key: "Escape" });
      
      expect(mockOnClickOutside).toHaveBeenCalledTimes(1);
    });

    it("handles outside clicks", () => {
      render(
        <ContextMenu 
          state={{ ...mockState, contextVisible: true }} 
          onClickOutside={mockOnClickOutside}
        >
          <div data-testid="menu-content">Menu Content</div>
        </ContextMenu>
      );

      // Simulate a mousedown outside the menu
      // This is simplified - in real tests with jsdom, event bubbling would be handled properly
      const mouseDownEvent = new MouseEvent("mousedown", { bubbles: true });
      document.dispatchEvent(mouseDownEvent);
      
      expect(mockOnClickOutside).toHaveBeenCalledTimes(1);
    });
  });

  describe("ContextMenuItem", () => {
    const mockClicked = vi.fn();

    beforeEach(() => {
      mockClicked.mockClear();
    });

    it("renders with text content", () => {
      render(<ContextMenuItem text="Item Text" clicked={mockClicked} />);
      
      const menuItem = screen.getByRole("menuitem");
      expect(menuItem).toBeInTheDocument();
      expect(menuItem).toHaveTextContent("Item Text");
    });

    it("applies dangerous styling", () => {
      render(<ContextMenuItem text="Dangerous Action" dangerous={true} clicked={mockClicked} />);
      
      const menuItem = screen.getByRole("menuitem");
      expect(menuItem).toHaveClass("dangerous");
    });

    it("handles click events", () => {
      render(<ContextMenuItem text="Clickable Item" clicked={mockClicked} />);
      
      const menuItem = screen.getByRole("menuitem");
      fireEvent.mouseDown(menuItem);
      
      expect(mockClicked).toHaveBeenCalledTimes(1);
    });

    it("does not call clicked handler when disabled", () => {
      render(<ContextMenuItem text="Disabled Item" disabled={true} clicked={mockClicked} />);
      
      const menuItem = screen.getByRole("menuitem");
      expect(menuItem).toHaveClass("disabled");
      expect(menuItem).toHaveAttribute("aria-disabled", "true");
      
      fireEvent.mouseDown(menuItem);
      expect(mockClicked).not.toHaveBeenCalled();
    });
  });

  describe("ContextMenuSeparator", () => {
    it("renders a separator", () => {
      render(<ContextMenuSeparator />);
      
      const separator = screen.getByRole("separator");
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveClass("separator");
    });
  });
});

// Test the useContextMenuState hook
describe("useContextMenuState hook", () => {
  it("initializes with correct default state", () => {
    const { result } = renderHook(() => useContextMenuState());
    
    const [state, api] = result.current;
    
    expect(state).toEqual({
      contextVisible: false,
      contextRef: null,
      contextX: 0,
      contextY: 0
    });
    
    expect(api).toHaveProperty("show");
    expect(api).toHaveProperty("conceal");
  });
  
  it("shows the menu when show is called", () => {
    const { result } = renderHook(() => useContextMenuState());
    
    const mockEvent = {
      target: document.createElement("div"),
      clientX: 150,
      clientY: 200
    };
    
    // Mock getBoundingClientRect
    mockEvent.target.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 50,
      bottom: 100
    });
    
    act(() => {
      result.current[1].show(mockEvent as any);
    });
    
    const [state] = result.current;
    
    expect(state).toEqual({
      contextVisible: true,
      contextRef: mockEvent.target,
      contextX: 100, // 150 - 50
      contextY: 100  // 200 - 100
    });
  });
  
  it("hides the menu when conceal is called", () => {
    const { result } = renderHook(() => useContextMenuState());
    
    // First show the menu
    const mockEvent = {
      target: document.createElement("div"),
      clientX: 150,
      clientY: 200
    };
    
    mockEvent.target.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 50,
      bottom: 100
    });
    
    act(() => {
      result.current[1].show(mockEvent as any);
    });
    
    // Then hide it
    act(() => {
      result.current[1].conceal();
    });
    
    const [state] = result.current;
    
    expect(state.contextVisible).toBe(false);
    // Other properties should remain unchanged
    expect(state.contextRef).toBe(mockEvent.target);
    expect(state.contextX).toBe(100);
    expect(state.contextY).toBe(100);
  });
});
