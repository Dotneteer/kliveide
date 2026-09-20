import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { MouseCaptureOverlay } from "@renderer/features/emulator/MouseCaptureOverlay";

afterEach(() => cleanup());

describe("MouseCaptureOverlay", () => {
  it("says nothing while the mouse is free", () => {
    const { container } = render(<MouseCaptureOverlay captured={false} refused={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names Esc while captured, because nothing else on screen can release the mouse", () => {
    render(<MouseCaptureOverlay captured={true} refused={false} />);
    expect(screen.getByText(/Esc/)).toBeInTheDocument();
  });

  it("asks for another click after a refusal, rather than looking dead", () => {
    // --- The Esc lockout: a capture straight after an Esc release is rejected for about a second.
    render(<MouseCaptureOverlay captured={false} refused={true} />);
    expect(screen.getByText(/click again/i)).toBeInTheDocument();
  });

  it("prefers the captured message when a refusal is still fading", () => {
    render(<MouseCaptureOverlay captured={true} refused={true} />);
    expect(screen.getByText(/Esc/)).toBeInTheDocument();
    expect(screen.queryByText(/click again/i)).toBeNull();
  });
});
