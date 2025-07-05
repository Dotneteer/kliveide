import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { IconButton, SmallIconButton } from "@renderer/controls/IconButton";
import React from "react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { useTooltipRef } from "@renderer/controls/Tooltip";

// We need to mock this before imports are processed
vi.mock("@renderer/controls/IconButton.module.scss", () => ({
  default: {
    iconButton: "iconButton",
    enabled: "enabled",
    noPadding: "noPadding",
    iconWrapper: "iconWrapper",
    keyDown: "keyDown",
    selected: "selected"
  }
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

// Mock modules
vi.mock("@renderer/controls/Icon", () => ({
  Icon: vi.fn(({ iconName, fill, width, height, opacity, "data-testid": dataTestId }) => (
    <div 
      data-testid={dataTestId || "icon"} 
      data-icon-name={iconName}
      data-fill={fill}
      data-width={width}
      data-height={height}
      data-opacity={opacity}
    />
  ))
}));

vi.mock("@renderer/controls/Tooltip", () => ({
  TooltipFactory: vi.fn(({ content }) => (
    <div data-testid="tooltip" data-content={content} />
  )),
  useTooltipRef: vi.fn(() => ({ current: document.createElement("div") }))
}));

describe("IconButton Component", () => {
  const mockClicked = vi.fn();
  
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockClicked.mockClear();
  });

  it("renders with default props", () => {
    render(<IconButton iconName="test-icon" />);
    const button = screen.getByTestId("icon-button");
    const icon = screen.getByTestId("icon-button-icon");
    
    expect(button).toBeInTheDocument();
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("data-icon-name", "test-icon");
    expect(icon).toHaveAttribute("data-width", "24");
    expect(icon).toHaveAttribute("data-height", "24");
  });

  it("applies custom dimensions", () => {
    render(<IconButton iconName="test-icon" iconSize={32} buttonWidth={48} buttonHeight={40} />);
    const button = screen.getByTestId("icon-button");
    const icon = screen.getByTestId("icon-button-icon");
    
    expect(icon).toHaveAttribute("data-width", "32");
    expect(icon).toHaveAttribute("data-height", "32");
  });

  it("applies noPadding class when noPadding is true", () => {
    render(<IconButton iconName="test-icon" buttonWidth={36} noPadding />);
    const button = screen.getByTestId("icon-button");
    
    expect(button).toHaveClass("noPadding");
  });

  it("shows tooltip when title is provided", () => {
    render(<IconButton iconName="test-icon" title="Test Tooltip" />);
    
    const tooltip = screen.getByTestId("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveAttribute("data-content", "Test Tooltip");
  });

  it("calls clicked handler when button is clicked", () => {
    render(<IconButton iconName="test-icon" clicked={mockClicked} />);
    const button = screen.getByTestId("icon-button");
    
    fireEvent.click(button);
    expect(mockClicked).toHaveBeenCalledTimes(1);
  });

  it("doesn't call clicked handler when disabled", () => {
    render(<IconButton iconName="test-icon" clicked={mockClicked} enable={false} />);
    const button = screen.getByTestId("icon-button");
    
    fireEvent.click(button);
    expect(mockClicked).not.toHaveBeenCalled();
  });

  it("applies disabled styling when enable is false", () => {
    render(<IconButton iconName="test-icon" enable={false} />);
    const button = screen.getByTestId("icon-button");
    const icon = screen.getByTestId("icon-button-icon");
    
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("tabIndex", "-1");
    expect(icon).toHaveAttribute("data-fill", "--bgcolor-toolbarbutton-disabled");
    expect(icon).toHaveAttribute("data-opacity", "0.5");
  });

  it("applies selected styling", () => {
    render(<IconButton iconName="test-icon" selected={true} />);
    const button = screen.getByTestId("icon-button");
    
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("handles keyboard navigation - Enter key", () => {
    render(<IconButton iconName="test-icon" clicked={mockClicked} />);
    const button = screen.getByTestId("icon-button");
    
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyUp(button, { key: 'Enter' });
    
    expect(mockClicked).toHaveBeenCalledTimes(1);
  });

  it("handles keyboard navigation - Space key", () => {
    render(<IconButton iconName="test-icon" clicked={mockClicked} />);
    const button = screen.getByTestId("icon-button");
    
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyUp(button, { key: ' ' });
    
    expect(mockClicked).toHaveBeenCalledTimes(1);
  });

  it("applies custom fill color", () => {
    render(<IconButton iconName="test-icon" fill="red" />);
    const icon = screen.getByTestId("icon-button-icon");
    
    expect(icon).toHaveAttribute("data-fill", "red");
  });

  it("applies custom data-testid", () => {
    render(<IconButton iconName="test-icon" data-testid="custom-button" />);
    
    const button = screen.getByTestId("custom-button");
    const icon = screen.getByTestId("custom-button-icon");
    
    expect(button).toBeInTheDocument();
    expect(icon).toBeInTheDocument();
  });
});

describe("SmallIconButton Component", () => {
  const mockClicked = vi.fn();
  
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockClicked.mockClear();
  });

  it("renders with correct default props", () => {
    render(<SmallIconButton iconName="test-icon" />);
    
    const button = screen.getByTestId("small-icon-button");
    const icon = screen.getByTestId("small-icon-button-icon");
    
    expect(button).toBeInTheDocument();
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("data-icon-name", "test-icon");
    // SmallIconButton renders an IconButton which renders an Icon
    expect(icon).toHaveAttribute("data-width", "18");
    expect(icon).toHaveAttribute("data-height", "18");
    expect(icon).toHaveAttribute("data-fill", "--color-command-icon");
  });

  it("forwards props to IconButton", () => {
    render(
      <SmallIconButton 
        iconName="test-icon" 
        title="Small Button" 
        enable={false}
        selected={true}
        clicked={mockClicked}
      />
    );
    
    const button = screen.getByTestId("small-icon-button");
    const tooltip = screen.getByTestId("tooltip");
    
    expect(tooltip).toHaveAttribute("data-content", "Small Button");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-pressed", "true");
    
    // Test click handler 
    fireEvent.click(button);
    expect(mockClicked).not.toHaveBeenCalled(); // Should not be called when disabled
  });

  it("applies custom fill color", () => {
    render(<SmallIconButton iconName="test-icon" fill="blue" />);
    
    const icon = screen.getByTestId("small-icon-button-icon");
    expect(icon).toHaveAttribute("data-fill", "blue");
  });

  it("applies custom data-testid", () => {
    render(<SmallIconButton iconName="test-icon" data-testid="custom-small-button" />);
    
    const button = screen.getByTestId("custom-small-button");
    const icon = screen.getByTestId("custom-small-button-icon");
    
    expect(button).toBeInTheDocument();
    expect(icon).toBeInTheDocument();
  });
});
