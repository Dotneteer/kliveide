import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HStack } from "@renderer/controls/new/Panels";
import userEvent from "@testing-library/user-event";
import React from "react";
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

describe("HStack Component", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders correctly with default props", () => {
    render(<HStack>Content</HStack>);
    const stack = screen.getByTestId("stack");
    expect(stack).toBeDefined();
    expect(stack.textContent).toBe("Content");
  });

  it("applies custom ID when provided", () => {
    render(<HStack id="custom-id">Content</HStack>);
    const stack = screen.getByTestId("stack");
    expect(stack.id).toBe("custom-id");
  });

  it("applies custom class extension when provided", () => {
    render(<HStack classExt="custom-class">Content</HStack>);
    const stack = screen.getByTestId("stack");
    expect(stack.classList.contains("custom-class")).toBe(true);
  });

  it("applies horizontal orientation correctly", () => {
    render(<HStack>Content</HStack>);
    const stack = screen.getByTestId("stack");
    // Check that the horizontal stack class is applied
    expect(stack.className).toContain("hstack");
  });

  it("applies wrap property correctly when provided", () => {
    render(<HStack wrap={true}>Content</HStack>);
    const stack = screen.getByTestId("stack");
    expect(stack.className).toContain("wrap");
  });

  it("does not apply wrap property when not specified", () => {
    render(<HStack>Content</HStack>);
    const stack = screen.getByTestId("stack");
    expect(stack.className).not.toContain("wrap");
  });

  it("applies style properties correctly", () => {
    render(
      <HStack backgroundColor="red" padding="10px">
        Content
      </HStack>
    );
    const stack = screen.getByTestId("stack");
    expect(stack.style.backgroundColor).toBe("red");
    expect(stack.style.padding).toBe("10px");
  });

  it("changes background color on hover when hoverBackgroundColor is provided", async () => {
    const user = userEvent.setup();
    render(
      <HStack backgroundColor="blue" hoverBackgroundColor="green">
        Content
      </HStack>
    );
    
    const stack = screen.getByTestId("stack");
    expect(stack.style.backgroundColor).toBe("blue");
    
    // Simulate hover
    await user.hover(stack);
    expect(stack.style.backgroundColor).toBe("green");
    
    // Simulate unhover
    await user.unhover(stack);
    expect(stack.style.backgroundColor).toBe("blue");
  });

  it("applies multiple style properties simultaneously", () => {
    render(
      <HStack 
        backgroundColor="lightblue" 
        color="darkblue" 
        padding="15px"
        style={{ borderRadius: "8px" }}
      >
        Content
      </HStack>
    );
    
    const stack = screen.getByTestId("stack");
    expect(stack.style.backgroundColor).toBe("lightblue");
    expect(stack.style.color).toBe("darkblue");
    expect(stack.style.padding).toBe("15px");
    expect(stack.style.borderRadius).toBe("8px");
  });

  it("applies font styling properties correctly", () => {
    render(
      <HStack 
        fontSize="18px"
        fontFamily="Arial, sans-serif"
        style={{ fontWeight: "bold" }}
      >
        Content
      </HStack>
    );
    
    const stack = screen.getByTestId("stack");
    expect(stack.style.fontSize).toBe("18px");
    expect(stack.style.fontFamily).toBe("Arial, sans-serif");
    expect(stack.style.fontWeight).toBe("bold");
  });

  it("applies padding in different directions", () => {
    render(
      <HStack 
        paddingHorizontal="15px"
        paddingVertical="5px"
      >
        Content
      </HStack>
    );
    
    const stack = screen.getByTestId("stack");
    expect(stack.style.paddingLeft).toBe("15px");
    expect(stack.style.paddingRight).toBe("15px");
    expect(stack.style.paddingTop).toBe("5px");
    expect(stack.style.paddingBottom).toBe("5px");
  });

  it("applies content alignment properties", () => {
    render(
      <HStack 
        verticalContentAlignment="center"
        horizontalContentAlignment="flex-start"
      >
        Content
      </HStack>
    );
    
    const stack = screen.getByTestId("stack");
    expect(stack.style.alignItems).toBe("center");
    expect(stack.style.justifyContent).toBe("flex-start");
  });

  it("applies gap property correctly", () => {
    render(
      <HStack gap="20px">
        <div>Item 1</div>
        <div>Item 2</div>
      </HStack>
    );
    
    const stack = screen.getByTestId("stack");
    expect(stack.style.gap).toBe("20px");
  });

  it("nests content properly with children", () => {
    render(
      <HStack backgroundColor="lightblue">
        <div data-testid="child-element">Child content</div>
      </HStack>
    );
    
    const stack = screen.getByTestId("stack");
    const child = screen.getByTestId("child-element");
    
    expect(stack.contains(child)).toBe(true);
    expect(child.textContent).toBe("Child content");
  });

  it("renders nested components correctly", () => {
    render(
      <HStack>
        <HStack>Nested Content</HStack>
      </HStack>
    );
    
    // Use getAllByTestId to get all stack elements and specifically select the first one (parent)
    const stacks = screen.getAllByTestId("stack");
    expect(stacks.length).toBe(2); // Should have parent and child
    
    const parentStack = stacks[0]; // First stack is the parent
    const nestedStack = stacks[1]; // Second stack is the nested one
    
    expect(parentStack.contains(nestedStack)).toBe(true);
    expect(nestedStack.textContent).toBe("Nested Content");
  });
});
