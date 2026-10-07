import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@renderer/controls/Icon", () => ({ Icon: () => null }));

import { beamAt, type BeamTiming } from "@common/utils/beamGeometry";
import { BeamPositionOverlay, BeamPositionPill } from "@renderer/features/emulator/BeamPositionOverlay";

/*
 * The beam position overlay as the emulator window renders it (`.plans/BEAM_POSITION_OVERLAY_PLAN.md`
 * D1, D2, D6): shapes in the buffer's own coordinates, the "previous frame" legend, the pill, and the
 * hover readout.
 */

afterEach(cleanup);

const SP48: BeamTiming = {
  unit: "T",
  tactsPerLine: 224,
  linesPerFrame: 312,
  firstVisibleTact: 16 * 224 - 24,
  tactsPerBufferPixel: 0.5,
  bufferWidth: 352,
  bufferHeight: 287,
  paperLeft: 48,
  paperTop: 47,
  paperWidth: 256,
  paperHeight: 192
};

const beam = beamAt(SP48, SP48.firstVisibleTact + 100 * 224 + 60, 352 * 90);

describe("beam position overlay", () => {
  it("draws in the buffer's coordinates and labels the previous frame", () => {
    render(<BeamPositionOverlay state={{ beam, instant: false }} screenWidth={352} screenHeight={287} hover={false} />);
    const svg = screen.getByTestId("beam-shapes");
    expect(svg.getAttribute("viewBox")).toBe("0 0 352 287");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("none");
    expect(svg.querySelector("pattern")).not.toBeNull();
    expect(svg.querySelectorAll("rect[x]").length).toBeGreaterThanOrEqual(1);
    const label = screen.getByTestId("beam-stale-label");
    expect(label.textContent).toBe("previous frame");
    // --- under the first stale row
    expect(label.style.top).toBe(`${(91 / 287) * 100}%`);
    // --- without the hover readout the overlay lets the pointer through to the screen
    expect(screen.queryByTestId("beam-readout")).toBeNull();
  });

  it("D6: the hover readout names the pixel and the distance from the beam", () => {
    render(<BeamPositionOverlay state={{ beam, instant: false }} screenWidth={352} screenHeight={287} hover />);
    const host = screen.getByTestId("beam-overlay");
    host.getBoundingClientRect = () => ({ left: 0, top: 0, width: 704, height: 574, right: 704, bottom: 574, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.mouseMove(host, { clientX: 2 * 10 + 1, clientY: 2 * 101 + 1 });
    expect(screen.getByTestId("beam-readout").textContent).toBe("(10, 101) · line 116 · tact 205 · T 26,189 · in 169 T");
    fireEvent.mouseMove(host, { clientX: 1, clientY: 1 });
    expect(screen.getByTestId("beam-readout").textContent).toMatch(/· drawn$/);
    fireEvent.mouseLeave(host);
    expect(screen.queryByTestId("beam-readout")).toBeNull();
  });

  it("D1: the pill shows the beam's position, and nothing without one", () => {
    const { rerender, container } = render(<BeamPositionPill text={undefined} />);
    expect(container.textContent).toBe("");
    rerender(<BeamPositionPill text="line 116 · paper row 53 · tact 36 · T 26,020" />);
    expect(screen.getByTestId("beam-pill").textContent).toBe("line 116 · paper row 53 · tact 36 · T 26,020");
  });
});
