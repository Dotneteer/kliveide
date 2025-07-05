import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { VStack } from "@renderer/controls/new/Panels";
import userEvent from "@testing-library/user-event";
import React from "react";
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

describe("VStack Component", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders correctly with default props", () => {
    render(<VStack>Content</VStack>);
    const stack = screen.getByTestId("stack");
    expect(stack).toBeDefined();
    expect(stack.textContent).toBe("Content");
  });

  it("applies custom ID when provided", () => {
    render(<VStack id="custom-id">Content</VStack>);
    const stack = screen.getByTestId("stack");
    expect(stack.id).toBe("custom-id");
  });

  it("applies custom class extension when provided", () => {
    render(<VStack classExt="custom-class">Content</VStack>);
    const stack = screen.getByTestId("stack");
    expect(stack.classList.contains("custom-class")).toBe(true);
  });

  it("applies vertical orientation correctly", () => {
    render(<VStack>Content</VStack>);
    const stack = screen.getByTestId("stack");
    // Check that the vertical stack class is applied
    expect(stack.className).toContain("vstack");
  });

  it("applies wrap property correctly when provided", () => {
    render(<VStack wrap={true}>Content</VStack>);
    const stack = screen.getByTestId("stack");
    expect(stack.className).toContain("wrap");
  });

  it("does not apply wrap property when not specified", () => {
    render(<VStack>Content</VStack>);
    const stack = screen.getByTestId("stack");
    expect(stack.className).not.toContain("wrap");
  });

  it("applies style properties correctly", () => {
    render(
      <VStack backgroundColor="red" padding="10px">
        Content
      </VStack>
    );
    const stack = screen.getByTestId("stack");
    expect(stack.style.backgroundColor).toBe("red");
    expect(stack.style.padding).toBe("10px");
  });

  it("changes background color on hover when hoverBackgroundColor is provided", async () => {
    const user = userEvent.setup();
    render(
      <VStack backgroundColor="blue" hoverBackgroundColor="green">
        Content
      </VStack>
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
      <VStack 
        backgroundColor="lightblue" 
        color="darkblue" 
        padding="15px"
        style={{ borderRadius: "8px" }}
      >
        Content
      </VStack>
    );
    
    const stack = screen.getByTestId("stack");
    expect(stack.style.backgroundColor).toBe("lightblue");
    expect(stack.style.color).toBe("darkblue");
    expect(stack.style.padding).toBe("15px");
    expect(stack.style.borderRadius).toBe("8px");
  });

  it("applies font styling properties correctly", () => {
    render(
      <VStack 
        fontSize="18px"
        fontFamily="Arial, sans-serif"
        style={{ fontWeight: "bold" }}
      >
        Content
      </VStack>
    );
    
    const stack = screen.getByTestId("stack");
    expect(stack.style.fontSize).toBe("18px");
    expect(stack.style.fontFamily).toBe("Arial, sans-serif");
    expect(stack.style.fontWeight).toBe("bold");
  });

  it("applies padding in different directions", () => {
    render(
      <VStack 
        paddingHorizontal="15px"
        paddingVertical="5px"
      >
        Content
      </VStack>
    );
    
    const stack = screen.getByTestId("stack");
    expect(stack.style.paddingLeft).toBe("15px");
    expect(stack.style.paddingRight).toBe("15px");
    expect(stack.style.paddingTop).toBe("5px");
    expect(stack.style.paddingBottom).toBe("5px");
  });

  it("applies content alignment properties", () => {
    render(
      <VStack 
        verticalContentAlignment="center"
        horizontalContentAlignment="flex-start"
      >
        Content
      </VStack>
    );
    
    const stack = screen.getByTestId("stack");
    expect(stack.style.alignItems).toBe("center");
    expect(stack.style.justifyContent).toBe("flex-start");
  });

  it("applies gap property correctly", () => {
    render(
      <VStack gap="20px">
        <div>Item 1</div>
        <div>Item 2</div>
      </VStack>
    );
    
    const stack = screen.getByTestId("stack");
    expect(stack.style.gap).toBe("20px");
  });

  it("nests content properly with children", () => {
    render(
      <VStack backgroundColor="lightblue">
        <div data-testid="child-element">Child content</div>
      </VStack>
    );
    
    const stack = screen.getByTestId("stack");
    const child = screen.getByTestId("child-element");
    
    expect(stack.contains(child)).toBe(true);
    expect(child.textContent).toBe("Child content");
  });

  it("renders nested components correctly", () => {
    render(
      <VStack>
        <VStack>Nested Content</VStack>
      </VStack>
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
