import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TabButton, TabButtonSpace, TabButtonSeparator } from "@renderer/controls/TabButton";
import React from "react";
import * as matchers from "@testing-library/jest-dom/matchers";

// Mock the TabButton.module.scss styles
vi.mock("@renderer/controls/TabButton.module.scss", () => ({
  default: {
    tabButton: "tabButton",
    keyDown: "keyDown",
    disabled: "disabled",
    active: "active",
    placeholder: "placeholder",
    separator: "separator",
    tabButtonSpace: "tabButtonSpace"
  }
}));

// Mock the useButtonState hook
vi.mock("@renderer/controls/hooks/useButtonState", () => ({
  useButtonState: vi.fn(() => ({
    isPressed: false,
    handleMouseDown: vi.fn(),
    handleMouseLeave: vi.fn(),
    handleClick: vi.fn(),
    handleKeyDown: vi.fn(),
    handleKeyUp: vi.fn()
  }))
}));

// Mock the BaseButton component
vi.mock("@renderer/controls/BaseButton", () => ({
  BaseButton: vi.fn(({ 
    title, 
    disabled, 
    onClick, 
    className, 
    "data-testid": dataTestId, 
    children,
    ...rest
  }) => (
    <div 
      data-testid={dataTestId} 
      className={className}
      aria-disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {title && <div data-testid="tooltip-title">{title}</div>}
      {children}
    </div>
  ))
}));

// Mock the Icon component
vi.mock("@renderer/controls/Icon", () => ({
  Icon: vi.fn(({ 
    iconName, 
    fill, 
    width, 
    height, 
    rotate,
    "data-testid": dataTestId
  }) => (
    <div 
      data-testid={dataTestId || "icon"} 
      data-icon-name={iconName}
      data-fill={fill}
      data-width={width}
      data-height={height}
      data-rotate={rotate}
    />
  ))
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
  }
}

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

describe("TabButton Components", () => {
  const mockClicked = vi.fn();
  
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockClicked.mockClear();
  });

  describe("TabButton", () => {
    it("renders with default props", () => {
      render(<TabButton iconName="test-icon" />);
      
      const button = screen.getByTestId("tab-button");
      const icon = screen.getByTestId("tab-button-icon");
      
      expect(button).toBeInTheDocument();
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute("data-icon-name", "test-icon");
      expect(icon).toHaveAttribute("data-width", "20");
      expect(icon).toHaveAttribute("data-height", "20");
      expect(icon).toHaveAttribute("data-fill", "--color-command-icon");
    });

    it("renders with placeholder when hide is true", () => {
      const { container } = render(<TabButton iconName="test-icon" hide={true} />);
      
      const button = screen.getByTestId("tab-button");
      const placeholder = container.querySelector(".placeholder");
      
      expect(button).toBeInTheDocument();
      expect(placeholder).toBeInTheDocument();
      expect(screen.queryByTestId("tab-button-icon")).not.toBeInTheDocument();
    });

    it("applies active styling", () => {
      render(<TabButton iconName="test-icon" isActive={true} />);
      
      const button = screen.getByTestId("tab-button");
      const icon = screen.getByTestId("tab-button-icon");
      
      expect(button).toHaveClass("active");
      expect(icon).toHaveAttribute("data-fill", "--color-active-tab-icon");
    });

    it("applies disabled styling", () => {
      render(<TabButton iconName="test-icon" disabled={true} />);
      
      const button = screen.getByTestId("tab-button");
      const icon = screen.getByTestId("tab-button-icon");
      
      expect(button).toHaveClass("disabled");
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(icon).toHaveAttribute("data-fill", "--color-command-icon-disabled");
    });

    it("applies custom fill color when not disabled or active", () => {
      render(<TabButton iconName="test-icon" fill="custom-color" />);
      
      const icon = screen.getByTestId("tab-button-icon");
      expect(icon).toHaveAttribute("data-fill", "custom-color");
    });

    it("applies rotation to icon", () => {
      render(<TabButton iconName="test-icon" rotate={90} />);
      
      const icon = screen.getByTestId("tab-button-icon");
      expect(icon).toHaveAttribute("data-rotate", "90");
    });

    it("includes space component when useSpace is true", () => {
      render(<TabButton iconName="test-icon" useSpace={true} />);
      
      const space = document.querySelector(".tabButtonSpace");
      expect(space).toBeInTheDocument();
    });

    it("forwards click handler", () => {
      render(<TabButton iconName="test-icon" clicked={mockClicked} />);
      
      const button = screen.getByTestId("tab-button");
      fireEvent.click(button);
      
      expect(mockClicked).toHaveBeenCalledTimes(1);
    });

    it("applies custom data-testid", () => {
      render(<TabButton iconName="test-icon" data-testid="custom-button" />);
      
      expect(screen.getByTestId("custom-button")).toBeInTheDocument();
      expect(screen.getByTestId("custom-button-icon")).toBeInTheDocument();
    });

    it("shows tooltip when title is provided", () => {
      render(<TabButton iconName="test-icon" title="Button Tooltip" />);
      
      expect(screen.getByTestId("tooltip-title")).toHaveTextContent("Button Tooltip");
    });
  });

  describe("TabButtonSpace", () => {
    it("renders a space element", () => {
      const { container } = render(<TabButtonSpace />);
      
      const space = container.querySelector(".tabButtonSpace");
      expect(space).toBeInTheDocument();
    });
  });

  describe("TabButtonSeparator", () => {
    it("renders a separator element", () => {
      const { container } = render(<TabButtonSeparator />);
      
      const separator = container.querySelector(".separator");
      expect(separator).toBeInTheDocument();
    });
  });
});
