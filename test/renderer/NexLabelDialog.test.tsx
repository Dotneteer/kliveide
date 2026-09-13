import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  NexLabelDialog,
  formatNexLabelValue,
  parseNexLabelValue,
  suggestNexLabelName
} from "@renderer/appIde/DocumentPanels/Next/NexLabelDialog";

afterEach(() => {
  cleanup();
});

describe("NexLabelDialog", () => {
  it("parses hex and decimal label values", () => {
    expect(parseNexLabelValue("$C000")).toBe(0xc000);
    expect(parseNexLabelValue("0xc000")).toBe(0xc000);
    expect(parseNexLabelValue("#c000")).toBe(0xc000);
    expect(parseNexLabelValue("c000h")).toBe(0xc000);
    expect(parseNexLabelValue("49152")).toBe(49152);
    expect(parseNexLabelValue("nope")).toBeUndefined();
    expect(formatNexLabelValue(0xc000)).toBe("$C000");
    expect(suggestNexLabelName("global", 0xc000)).toBe("L_C000");
    expect(suggestNexLabelName("local", 0x0123)).toBe("L_0123");
  });

  it("prefills an existing label at the default value", () => {
    const controls = createControls();

    render(
      <NexLabelDialog
        bank={5}
        initialScope="global"
        initialGlobalValue={0xc000}
        initialLocalValue={0}
        labels={[
          { scope: "global", name: "EntryPoint", value: 0xc000, referenced: true },
          { scope: "local", bank: 5, name: "LocalLoop", value: 0x0123 }
        ]}
        controls={controls}
      />
    );

    const textboxes = screen.getAllByRole("textbox");
    expect(textboxes[0]).toHaveValue("EntryPoint");
    expect(textboxes[1]).toHaveValue("$C000");
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search labels"), {
      target: { value: "local" }
    });

    expect(screen.queryByText("EntryPoint")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("LocalLoop"));

    expect(screen.getByRole("radio", { name: "Bank 5" })).toBeChecked();
    expect(textboxes[0]).toHaveValue("LocalLoop");
    expect(textboxes[1]).toHaveValue("$0123");
  });

  /**
   * The two label dialogs open one on top of the other, so they have to name the same two things
   * the same way. This one said "Global" / "Local to Bank 5"; the list said "Bank 5" / "Global" —
   * two namings *and* two orders for one pair of concepts.
   */
  it("names and orders the scopes the way the Labels list does", () => {
    render(
      <NexLabelDialog
        bank={5}
        initialScope="local"
        initialGlobalValue={0xc000}
        initialLocalValue={0}
        labels={[]}
        controls={createControls()}
      />
    );

    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("aria-label") ?? radio.closest("label")?.textContent?.trim()))
      .toEqual(["Bank 5", "Global"]);
    expect(screen.queryByText(/Local to Bank/)).not.toBeInTheDocument();
  });

  /**
   * The existing-labels list is a fixed viewport, as the Labels list is.
   *
   * It had `max-height`, so a search matching one label collapsed it to a single row and the dialog
   * resized as you typed. Asserted against the stylesheet because jsdom resolves every CSS-module
   * rule to `auto`; same approach as `row-size-contract.test.ts`.
   */
  it("sizes the existing-labels list to a stated row count", () => {
    const sheet = readFileSync(
      join(process.cwd(), "src/renderer/appIde/DocumentPanels/Next/NexLabelDialog.module.scss"),
      "utf8"
    );
    const list = sheet.slice(sheet.indexOf("\n.labelList {"), sheet.indexOf("\n.labelItem"));

    expect(list).not.toContain("max-height");
    expect(list).toContain("--list-visible-rows: 3");
    expect(list).toMatch(
      /height:\s*calc\(var\(--list-row-height\) \* var\(--list-visible-rows\)\)/
    );
  });

  it("blocks invalid duplicate labels and saves valid input", () => {
    const controls = createControls();

    render(
      <NexLabelDialog
        bank={5}
        initialScope="local"
        initialGlobalValue={0x8123}
        initialLocalValue={0x0123}
        labels={[{ scope: "local", bank: 5, name: "LocalLoop", value: 0x0100 }]}
        controls={controls}
      />
    );

    const textboxes = screen.getAllByRole("textbox");
    fireEvent.change(textboxes[0], { target: { value: "LocalLoop" } });

    expect(screen.getByText("A label with this name already exists in this scope."))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    fireEvent.change(textboxes[0], { target: { value: "LocalEntry" } });
    fireEvent.change(textboxes[1], { target: { value: "291" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(controls.close).toHaveBeenCalledWith({
      action: "save",
      scope: "local",
      name: "LocalEntry",
      value: 291,
      originalLabel: undefined
    });
  });

  it("does not allow typing more than sixteen name characters", () => {
    const controls = createControls();

    render(
      <NexLabelDialog
        bank={5}
        initialScope="local"
        initialGlobalValue={0x8123}
        initialLocalValue={0x0123}
        labels={[]}
        controls={controls}
      />
    );

    const nameInput = screen.getAllByRole("textbox")[0];
    fireEvent.change(nameInput, {
      target: { value: "SixteenCharsHereAndMore" }
    });

    expect(nameInput).toHaveAttribute("maxLength", "16");
    expect(nameInput).toHaveValue("SixteenCharsHere");
  });
});

function createControls() {
  return {
    id: "label-dialog",
    close: vi.fn(),
    cancel: vi.fn(),
    reject: vi.fn()
  };
}
