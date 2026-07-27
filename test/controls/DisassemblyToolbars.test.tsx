import { MachineControllerState } from "@abstractions/MachineControllerState";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDisassemblyOffsetOptions,
  DisassemblyBankToolbar,
  DisassemblyToolbar
} from "@renderer/appIde/DocumentPanels/DisassemblyToolbars";

vi.mock("@renderer/controls/AddressInput", () => ({
  AddressInput: ({ label, onAddressSent }: { label: string; onAddressSent?: (address: number) => void }) => (
    <input
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onAddressSent?.(parseInt(event.currentTarget.value, 16));
        }
      }}
    />
  )
}));

vi.mock("@renderer/controls/IconButton", () => ({
  SmallIconButton: ({
    clicked,
    enable = true,
    title
  }: {
    clicked?: () => void;
    enable?: boolean;
    title: string;
  }) => (
    <button disabled={!enable} onClick={() => clicked?.()}>
      {title}
    </button>
  )
}));

vi.mock("@renderer/controls/LabeledSwitch", () => ({
  LabeledSwitch: ({
    clicked,
    label,
    value
  }: {
    clicked?: (value: boolean) => void;
    label: string;
    value: boolean;
  }) => (
    <button onClick={() => clicked?.(!value)}>
      {label}:{value ? "on" : "off"}
    </button>
  )
}));

vi.mock("@renderer/controls/Dropdown", () => ({
  default: ({
    initialValue,
    onChanged,
    options
  }: {
    initialValue?: string;
    onChanged?: (value: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <select
      aria-label="dropdown"
      onChange={(event) => onChanged?.(event.currentTarget.value)}
      value={initialValue}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}));

vi.mock("@renderer/controls/new/BankDropdown", () => ({
  default: ({ onChanged }: { onChanged?: (value: number) => void }) => (
    <button onClick={() => onChanged?.(3)}>bank dropdown</button>
  )
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Disassembly toolbars", () => {
  it("creates disassembly offset options in hex and decimal", () => {
    expect(createDisassemblyOffsetOptions(false)[1]).toEqual({ value: "8192", label: "2000" });
    expect(createDisassemblyOffsetOptions(true)[1]).toEqual({ value: "8192", label: "8192" });
  });

  it("routes primary toolbar callbacks", () => {
    const onAutoRefreshChanged = vi.fn();
    const onGoToAddress = vi.fn();
    const onGoToPc = vi.fn();
    const onManualRefresh = vi.fn();

    render(
      <DisassemblyToolbar
        autoRefresh={false}
        bankLabel={true}
        decimalView={false}
        machineState={MachineControllerState.Paused}
        onAutoRefreshChanged={onAutoRefreshChanged}
        onDecimalViewChanged={vi.fn()}
        onGoToAddress={onGoToAddress}
        onGoToPc={onGoToPc}
        onManualRefresh={onManualRefresh}
        onRamChanged={vi.fn()}
        onScreenChanged={vi.fn()}
        onShowBankLabelChanged={vi.fn()}
        pausedPc={0x6000}
        ram={true}
        screen={false}
        topAddress={0x5000}
      />
    );

    fireEvent.click(screen.getByText("Follow PC:off"));
    fireEvent.click(screen.getByText("Refresh now"));
    fireEvent.click(screen.getByText("Go to the PC address"));
    fireEvent.change(screen.getByLabelText("Go To"), { target: { value: "6002" } });
    fireEvent.keyDown(screen.getByLabelText("Go To"), { key: "Enter" });

    expect(onAutoRefreshChanged).toHaveBeenCalledWith(true);
    expect(onManualRefresh).toHaveBeenCalled();
    expect(onGoToPc).toHaveBeenCalled();
    expect(onGoToAddress).toHaveBeenCalledWith(0x6002);
  });

  it("routes bank toolbar dropdown callbacks", () => {
    const onCurrentSegmentChanged = vi.fn();
    const onDisassOffsetChanged = vi.fn();

    render(
      <DisassemblyBankToolbar
        allowViews={true}
        autoRefresh={false}
        currentSegment={0}
        decimalView={false}
        disassOffset={0}
        displayBankMatrix={false}
        isFullView={false}
        machineId="sp128"
        offsetOptions={createDisassemblyOffsetOptions(false)}
        onCurrentSegmentChanged={onCurrentSegmentChanged}
        onDisassOffsetChanged={onDisassOffsetChanged}
        onFullViewChanged={vi.fn()}
        segmentOptions={[
          { value: "0", label: "BANK 0" },
          { value: "3", label: "BANK 3" }
        ]}
      />
    );

    const dropdowns = screen.getAllByLabelText("dropdown");
    fireEvent.change(dropdowns[0], { target: { value: "3" } });
    fireEvent.change(dropdowns[1], { target: { value: "8192" } });

    expect(onCurrentSegmentChanged).toHaveBeenCalledWith(3);
    expect(onDisassOffsetChanged).toHaveBeenCalledWith(8192);
  });
});
