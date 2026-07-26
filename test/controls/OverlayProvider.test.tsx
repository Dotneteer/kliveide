import { createPortal } from "react-dom";
import { describe, expect, it } from "vitest";
import { renderWithProviders, screen, waitFor } from "../react-test-utils";
import { useOverlayRoot } from "@renderer/controls/overlay/useOverlayRoot";

function OverlayPortalProbe() {
  const root = useOverlayRoot();
  return root ? createPortal(<div data-testid="overlay-portal-child">Portal child</div>, root) : null;
}

describe("OverlayProvider", () => {
  it("renders one overlay root inside the themed root", async () => {
    renderWithProviders(<div>app content</div>);

    await waitFor(() => {
      const themeRoot = document.getElementById("themeRoot");
      const overlayRoot = document.getElementById("overlayRoot");

      expect(themeRoot).toBeInTheDocument();
      expect(overlayRoot).toBeInTheDocument();
      expect(overlayRoot?.parentElement).toBe(themeRoot);
    });
  });

  it("renders portal content under the overlay root within the themed tree", async () => {
    renderWithProviders(<OverlayPortalProbe />);

    const portalChild = await screen.findByTestId("overlay-portal-child");
    const overlayRoot = document.getElementById("overlayRoot");
    const themeRoot = document.getElementById("themeRoot");

    expect(overlayRoot).toContainElement(portalChild);
    expect(overlayRoot?.closest("#themeRoot")).toBe(themeRoot);
    await waitFor(() => {
      expect(themeRoot?.style.getPropertyValue("--main-font-family")).not.toBe("");
    });
  });

  it("removes the provider-owned overlay root on unmount", async () => {
    const { unmount } = renderWithProviders(<div>app content</div>);

    await waitFor(() => {
      expect(document.getElementById("overlayRoot")).toBeInTheDocument();
    });

    unmount();

    expect(document.getElementById("overlayRoot")).not.toBeInTheDocument();
  });
});
