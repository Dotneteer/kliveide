import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@renderer/controls/Icon", () => ({ Icon: () => null }));

import { decodeProbe, WHY_L2, WHY_SPR } from "@common/zxnext/layers/layerMix";
import { LayerDebugOverlay } from "@renderer/features/emulator/LayerDebugOverlay";
import { ProbeTooltip } from "@renderer/features/emulator/NextLayersScreenOverlay";

/*
 * The emulator window's layer views (`.plans/LAYER_COMPOSITION_PLAN.md` D3, D7): the pill that
 * announces a hidden layer, and the probe's explanation of a pixel.
 */

afterEach(cleanup);

const params = 0x000 | (1 << 9) | (1 << 12) | (1 << 14) | (1 << 15); // LSU, ULA, Layer 2, sprites on

describe("layer debug views", () => {
  it("the pill says what is hidden, and when the paused picture is approximate", () => {
    const { rerender, container } = render(<LayerDebugOverlay text={undefined} />);
    expect(container.textContent).toBe("");
    rerender(<LayerDebugOverlay text="Layers: sprites hidden" approximate />);
    expect(screen.getByTestId("layer-debug-pill").textContent).toBe("Layers: sprites hiddenapproximate: exact from the next frame");
  });

  it("the probe names the rule, every layer's value and the mode in force for the pixel", () => {
    const probe = decodeProbe(288, 152, [0x8000 | 0x005, 0x0400, 0x8000 | 0x050, 0x8000 | 0x1c0, params, WHY_L2, 0x050, WHY_L2, 0x050, 3, 0, 0]);
    render(<ProbeTooltip probe={probe} />);
    const text = screen.getByTestId("next-layer-probe").textContent!;
    expect(text).toContain("(288, 152) $050");
    expect(text).toContain("Layer 2: the top opaque layer in this order");
    expect(text).toContain("Sprites$1C0");
    expect(text).toContain("Tilemapdisabled");
    expect(text).toContain("ModeLSU");
    expect(text).toContain("Drawn last frame (past the beam)");
    expect(text).not.toContain("The machine shows");
  });

  it("the probe says what the machine shows when a hidden layer would have won", () => {
    const probe = decodeProbe(0, 0, [0, 0, 0x8000 | 0x050, 0x8000 | 0x1c0, params & ~(7 << 9), WHY_L2, 0x050, WHY_SPR, 0x1c0, 3, 0, 1]);
    render(<ProbeTooltip probe={probe} />);
    expect(screen.getByTestId("next-layer-probe").textContent).toContain(
      "The machine shows $1C0: sprites: the top opaque layer in this order"
    );
  });
});
