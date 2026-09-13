import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NexRegionDialog,
  createRegionPreview,
  formatRegionPreview
} from "@renderer/appIde/DocumentPanels/Next/NexRegionDialog";

afterEach(() => {
  cleanup();
});

describe("NexRegionDialog", () => {
  it("previews bytes, words, and skip regions directly from the memory", () => {
    const bytes = [0x01, 0x02, 0x78, 0x56, 0xbc, 0x9a];

    expect(formatRegionPreview("bytes", 0, 3, bytes)).toBe(
      "$0000  .defb $01, $02, $78, $56"
    );
    expect(formatRegionPreview("words", 2, 5, bytes)).toBe(
      "$0002  .defw $5678, $9ABC"
    );
    expect(formatRegionPreview("skip", 1, 4, bytes)).toBe("$0001  .skip $0004");
  });

  /**
   * A disassembly region is previewed by really disassembling it.
   *
   * It used to render a sentence *about* the region — "$0001  Z80 disassembly, $0004 bytes" — which
   * is the region's own length read back at you, and the one region type whose preview showed
   * nothing of its contents. Decoding is async, which is why this case has a function of its own.
   */
  it("previews a disassembly region by decoding its bytes", async () => {
    // --- `ld bc,$5678` then `ld (bc),a`: two real instructions from four bytes.
    const bytes = [0x00, 0x01, 0x78, 0x56, 0x02, 0x00];

    expect(await createRegionPreview("disassemble", 1, 4, bytes)).toBe(
      "$0001  ld bc,$5678\n$0004  ld (bc),a"
    );
  });

  it("routes the other region types through the same entry point", async () => {
    const bytes = [0x01, 0x02, 0x78, 0x56, 0xbc, 0x9a];

    expect(await createRegionPreview("bytes", 0, 3, bytes)).toBe(
      formatRegionPreview("bytes", 0, 3, bytes)
    );
    expect(await createRegionPreview("skip", 1, 4, bytes)).toBe("$0001  .skip $0004");
  });

  it("shows defaults and saves edited region values", async () => {
    const controls = createControls();

    render(
      <NexRegionDialog
        initialType="bytes"
        initialStart={0x0004}
        initialEnd={0x0007}
        regions={[
          { start: 0, end: 3, type: "disassemble" },
          { start: 4, end: 15, type: "bytes" }
        ]}
        bytes={[0, 1, 2, 3, 4, 5, 6, 7]}
        controls={controls}
      />
    );

    expect(screen.getByRole("radio", { name: "Bytes" })).toBeChecked();
    expect(screen.getByText("$0004 (4)")).toBeInTheDocument();
    expect(screen.getByText("split")).toBeInTheDocument();
    // --- The preview settles a tick later: it is awaited now, so that code regions can decode.
    await waitFor(() =>
      expect(screen.getByLabelText("Region preview")).toHaveTextContent(".defb $04, $05, $06, $07")
    );

    const textboxes = screen.getAllByRole("textbox");
    fireEvent.change(textboxes[0], { target: { value: "$0008" } });
    fireEvent.change(textboxes[1], { target: { value: "11" } });
    fireEvent.click(screen.getByRole("radio", { name: "Skip" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(controls.close).toHaveBeenCalledWith({
      type: "skip",
      start: 8,
      end: 11
    });
  });

  it("sets the range to the full bank explicitly", () => {
    const controls = createControls();

    render(
      <NexRegionDialog
        initialType="bytes"
        initialStart={0x0004}
        initialEnd={0x0007}
        regions={[
          { start: 0, end: 3, type: "disassemble" },
          { start: 4, end: 15, type: "bytes" }
        ]}
        bytes={[0, 1, 2, 3, 4, 5, 6, 7]}
        controls={controls}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Entire bank" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(controls.close).toHaveBeenCalledWith({
      type: "bytes",
      start: 0,
      end: 0x3fff
    });
  });

  it("blocks odd-length word regions", () => {
    const controls = createControls();

    render(
      <NexRegionDialog
        initialType="words"
        initialStart={0x0000}
        initialEnd={0x0002}
        regions={[{ start: 0, end: 0x3fff, type: "disassemble" }]}
        bytes={[1, 2, 3]}
        controls={controls}
      />
    );

    expect(screen.getByText("Word regions must contain an even number of bytes."))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

function createControls() {
  return {
    id: "region-dialog",
    close: vi.fn(),
    cancel: vi.fn(),
    reject: vi.fn()
  };
}
