import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Checkbox } from "@renderer/controls/Checkbox";
import React from "react";
import * as matchers from "@testing-library/jest-dom/matchers";

// Mock the Checkbox.module.scss styles
vi.mock("@renderer/controls/Checkbox.module.scss", () => ({
  default: {
    checkboxWrapper: "checkboxWrapper",
    resetAppearance: "resetAppearance",
    checkbox: "checkbox",
    left: "left",
    right: "right",
    disabled: "disabled"
  }
}));

// Add the necessary TypeScript declarations for jest-dom
declare module "vitest" {
  interface Assertion<T = any> {
    toBeInTheDocument(): T;
    toHaveStyle(style: Record<string, any>): T;
    toHaveClass(className: string): T;
    toHaveAttribute(name: string, value?: string): T;
    toBeChecked(): T;
    toBeEnabled(): T;
    toBeDisabled(): T;
    toHaveFocus(): T;
    toHaveTextContent(text: string | RegExp): T;
  }
}

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

describe("Checkbox Component", () => {
  const mockOnChange = vi.fn();
  
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockOnChange.mockClear();
    
    // Reset Math.random to return a consistent value for ID generation
    const mockRandom = vi.spyOn(Math, 'random');
    mockRandom.mockReturnValue(0.123456789);
  });

  it("renders with default props", () => {
    render(<Checkbox />);
    
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toBeEnabled();
  });

  it("renders with label on left by default", () => {
    render(<Checkbox label="Test Label" />);
    
    const label = screen.getByText("Test Label");
    expect(label).toBeInTheDocument();
    expect(label).toHaveClass("left");
    expect(label).not.toHaveClass("right");
  });

  it("renders with label on right when right prop is true", () => {
    render(<Checkbox label="Test Label" right={true} />);
    
    const label = screen.getByText("Test Label");
    expect(label).toBeInTheDocument();
    expect(label).toHaveClass("right");
    expect(label).not.toHaveClass("left");
  });

  it("renders in checked state when initialValue is true", () => {
    render(<Checkbox initialValue={true} />);
    
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("renders in disabled state when enabled is false", () => {
    render(<Checkbox enabled={false} label="Disabled Checkbox" />);
    
    const checkbox = screen.getByRole("checkbox");
    const label = screen.getByText("Disabled Checkbox");
    
    expect(checkbox).toBeDisabled();
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    expect(label).toHaveClass("disabled");
  });

  it("toggles state when clicked", () => {
    render(<Checkbox label="Clickable Checkbox" onChange={mockOnChange} />);
    
    const checkbox = screen.getByRole("checkbox");
    
    // Initial state
    expect(checkbox).not.toBeChecked();
    
    // Click to toggle
    fireEvent.click(checkbox);
    
    // Should be checked now
    expect(checkbox).toBeChecked();
    expect(mockOnChange).toHaveBeenCalledWith(true);
    
    // Click again to toggle off
    fireEvent.click(checkbox);
    
    // Should be unchecked
    expect(checkbox).not.toBeChecked();
    expect(mockOnChange).toHaveBeenCalledWith(false);
  });

  it("toggles state when label is clicked", () => {
    render(<Checkbox label="Clickable Label" onChange={mockOnChange} />);
    
    const checkbox = screen.getByRole("checkbox");
    const label = screen.getByText("Clickable Label");
    
    // Initial state
    expect(checkbox).not.toBeChecked();
    
    // Click label to toggle
    fireEvent.click(label);
    
    // Should be checked now
    expect(checkbox).toBeChecked();
    expect(mockOnChange).toHaveBeenCalledWith(true);
  });

  it("doesn't toggle when disabled", () => {
    render(
      <Checkbox 
        label="Disabled Checkbox" 
        enabled={false} 
        onChange={mockOnChange} 
      />
    );
    
    const checkbox = screen.getByRole("checkbox");
    const label = screen.getByText("Disabled Checkbox");
    
    // Click checkbox
    fireEvent.click(checkbox);
    expect(mockOnChange).not.toHaveBeenCalled();
    
    // Click label
    fireEvent.click(label);
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("updates when initialValue prop changes", () => {
    const { rerender } = render(
      <Checkbox initialValue={false} onChange={mockOnChange} />
    );
    
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    
    // Update props
    rerender(<Checkbox initialValue={true} onChange={mockOnChange} />);
    
    // Should now be checked
    expect(checkbox).toBeChecked();
  });

  it("uses provided id when specified", () => {
    render(<Checkbox id="custom-id" label="Custom ID" />);
    
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("id", "custom-id");
    
    // Label should be associated with the checkbox via htmlFor
    const label = screen.getByText("Custom ID");
    expect(label).toHaveAttribute("for", "custom-id");
  });

  it("generates unique id when not provided", () => {
    render(<Checkbox label="Generated ID" />);
    
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.id).toMatch(/checkbox-.*$/);
    
    const label = screen.getByText("Generated ID");
    expect(label).toHaveAttribute("for", checkbox.id);
  });

  it("works in controlled mode with onChange handler", () => {
    const { rerender } = render(
      <Checkbox 
        initialValue={false}
        onChange={mockOnChange}
      />
    );
    
    const checkbox = screen.getByRole("checkbox");
    
    // Simulate external state change through rerender
    mockOnChange.mockImplementationOnce((newValue) => {
      rerender(<Checkbox initialValue={newValue} onChange={mockOnChange} />);
    });
    
    // Click to toggle
    fireEvent.click(checkbox);
    
    // Should be checked now through the controlled flow
    expect(checkbox).toBeChecked();
    expect(mockOnChange).toHaveBeenCalledWith(true);
  });
});
