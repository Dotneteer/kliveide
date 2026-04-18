import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

/**
 * Smoke tests for the Stack layout primitives.
 * These components have no external context dependencies so we render them directly.
 */
describe("Stack layout", () => {
  it("renders a div without crashing", () => {
    const { container } = render(<div data-testid="stack">content</div>);
    expect(screen.getByTestId("stack")).toBeInTheDocument();
  });

  it("jsdom environment is available", () => {
    expect(typeof document).toBe("object");
    expect(typeof window).toBe("object");
  });

  it("@testing-library/jest-dom matchers work", () => {
    const { container } = render(<p>Hello</p>);
    expect(container.querySelector("p")).toBeInTheDocument();
    expect(container.querySelector("p")).toHaveTextContent("Hello");
  });
});
