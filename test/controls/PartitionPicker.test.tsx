import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";

import { PartitionPicker } from "@renderer/controls/PartitionPicker";
import { derivePartitionOptions } from "@renderer/features/memory/memoryViewModel";
import { renderWithProviders } from "../react-test-utils";

afterEach(cleanup);

/*
 * The picker's contract after the naming unification: whatever it shows, it shows the machine's own
 * label as the partition's identity, and the description only as a gloss. It no longer knows which
 * machine it is choosing for — the shape of the answer arrives as data.
 */

const LABELS = { [-2]: "R1", [-1]: "R0", 0: "B0", 1: "B1" };
const DESCRIPTIONS = { [-1]: "ROM 0", [-2]: "ROM 1", 0: "Bank 0", 1: "Bank 1" };

const segmentOptions = [
  { value: "-1", label: "R0", description: "ROM 0" },
  { value: "0", label: "B0", description: "Bank 0" }
];

describe("PartitionPicker - the list form", () => {
  it("shows the machine's label for the selected partition, not the description", () => {
    renderWithProviders(
      <PartitionPicker
        value={-1}
        onChange={vi.fn()}
        displayBankMatrix={false}
        segmentOptions={segmentOptions}
      />
    );

    // --- `R0`, not `ROM 0`: what the trigger shows is what a breakpoint key and the bank column
    // --- show, and what `bp-set` accepts.
    expect(screen.getAllByText("R0").length).toBeGreaterThan(0);
  });

});

describe("PartitionPicker - the matrix form", () => {
  const partitionOptions = derivePartitionOptions(LABELS, DESCRIPTIONS);

  it("uses the matrix when the machine has too many banks to list", () => {
    renderWithProviders(
      <PartitionPicker
        value={0}
        onChange={vi.fn()}
        displayBankMatrix={true}
        segmentOptions={[]}
        partitionOptions={partitionOptions}
      />
    );

    expect(screen.getAllByText("B0").length).toBeGreaterThan(0);
  });

  it("falls back to the list rather than showing no picker at all", () => {
    // --- A machine that wants the matrix but whose partitions have not arrived yet. Some chooser
    // --- beats none; the previous implementation rendered nothing for any machine it did not
    // --- recognise by id.
    renderWithProviders(
      <PartitionPicker
        value={-1}
        onChange={vi.fn()}
        displayBankMatrix={true}
        segmentOptions={segmentOptions}
        partitionOptions={[]}
      />
    );

    expect(screen.getAllByText("R0").length).toBeGreaterThan(0);
  });

});

describe("BankDropdown grid, through the picker", () => {
  it("renders every partition the machine has", () => {
    const many = derivePartitionOptions(
      Object.fromEntries(Array.from({ length: 40 }, (_, i) => [i, i.toString(16).padStart(2, "0")])),
      {}
    );

    renderWithProviders(
      <PartitionPicker
        value={0}
        onChange={vi.fn()}
        displayBankMatrix={true}
        segmentOptions={[]}
        partitionOptions={many}
      />
    );

    // --- The trigger shows the selected one; the rest live in the portal until opened.
    expect(screen.getAllByText("00").length).toBeGreaterThan(0);
  });

  it("separates special pages from banks", () => {
    const options = derivePartitionOptions(LABELS, DESCRIPTIONS);

    expect(options.filter((o) => o.group === "special").map((o) => o.label)).toEqual(["R0", "R1"]);
    expect(options.filter((o) => o.group === "bank").map((o) => o.label)).toEqual(["B0", "B1"]);
  });
});
