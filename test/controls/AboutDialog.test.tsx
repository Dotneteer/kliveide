import { describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen } from "../react-test-utils";
import { AboutDialog } from "@renderer/appIde/dialogs/AboutDialog";

describe("AboutDialog", () => {
  const about = {
    version: "0.58.0-test",
    electronVersion: "43.2.0",
    osVersion: "test-os"
  };

  it("renders the supplied current-version information", () => {
    renderWithProviders(<AboutDialog about={about} onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "About Klive IDE" })).toBeInTheDocument();
    expect(screen.getByTestId("about-version")).toHaveTextContent("0.58.0-test");
    expect(screen.getByText("Electron version: 43.2.0")).toBeInTheDocument();
    expect(screen.getByText("OS version: test-os")).toBeInTheDocument();
  });

  it("closes from the accessible Close button", () => {
    const onClose = vi.fn();
    renderWithProviders(<AboutDialog about={about} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledWith("close");
  });
});
