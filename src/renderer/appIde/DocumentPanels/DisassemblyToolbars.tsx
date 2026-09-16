import { MachineControllerState } from "@abstractions/MachineControllerState";
import { AddressInput } from "@renderer/controls/AddressInput";
import Dropdown, { type DropdownOption } from "@renderer/controls/Dropdown";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { PartitionPicker } from "@renderer/controls/PartitionPicker";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Text } from "@renderer/controls/layout/Text";
import { PanelHeader, PanelHeaderGroup } from "@renderer/controls/data";
import type { PartitionOption } from "@renderer/features/memory/memoryViewModel";
import { toHexa4 } from "../services/ide-commands";

export function createDisassemblyOffsetOptions(decimalView: boolean): DropdownOption[] {
  const options: DropdownOption[] = [];
  for (let i = 0; i < 8; i++) {
    const offset = 0x2000 * i;
    const label = decimalView ? offset.toString() : toHexa4(offset);
    options.push({ value: offset.toString(), label });
  }
  return options;
}

export const SYS_VAR_NAMES_TITLE =
  "Show system variable names in operands?";

type DisassemblyToolbarProps = {
  autoRefresh: boolean;
  bankLabel: boolean;
  decimalView: boolean;
  machineState: MachineControllerState | undefined;
  onAutoRefreshChanged: (value: boolean) => void | Promise<void>;
  onDecimalViewChanged: (value: boolean) => void;
  onGoToAddress: (address: number) => void | Promise<void>;
  onGoToPc: () => void;
  onManualRefresh: () => void | Promise<void>;
  onRamChanged: (value: boolean) => void;
  onScreenChanged: (value: boolean) => void;
  onShowBankLabelChanged: (value: boolean) => void;
  onSysVarNamesChanged: (value: boolean) => void;
  pausedPc: number;
  ram: boolean;
  screen: boolean;
  sysVarNames: boolean;
  topAddress: number;
};

export const DisassemblyToolbar = ({
  autoRefresh,
  bankLabel,
  decimalView,
  machineState,
  onAutoRefreshChanged,
  onDecimalViewChanged,
  onGoToAddress,
  onGoToPc,
  onManualRefresh,
  onRamChanged,
  onScreenChanged,
  onShowBankLabelChanged,
  onSysVarNamesChanged,
  pausedPc,
  ram,
  screen,
  sysVarNames,
  topAddress
}: DisassemblyToolbarProps) => (
  <PanelHeader>
    <PanelHeaderGroup>
      <LabeledSwitch
        value={decimalView}
        label="Decimal"
        title="Use decimal numbers?"
        clicked={onDecimalViewChanged}
      />
    </PanelHeaderGroup>
    <PanelHeaderGroup>
      <LabeledSwitch
        value={sysVarNames}
        label="Sys vars"
        title={SYS_VAR_NAMES_TITLE}
        clicked={onSysVarNamesChanged}
      />
    </PanelHeaderGroup>
    {/* --- The refresh button acts on what "Follow PC" selects, so the two travel together. */}
    <PanelHeaderGroup>
      <LabeledSwitch
        value={autoRefresh}
        label="Follow PC"
        title="Follow the changes of PC"
        clicked={onAutoRefreshChanged}
      />
      <SmallIconButton
        iconName="refresh"
        title={"Refresh now"}
        clicked={onManualRefresh}
      />
    </PanelHeaderGroup>
    {/* --- Three switches over what the listing covers: one group, so they wrap as a set. */}
    <PanelHeaderGroup>
      <LabeledSwitch value={ram} label="RAM:" title="Disassemble RAM?" clicked={onRamChanged} />
      <LabeledSwitch
        value={screen}
        label="Screen:"
        title="Disassemble screen?"
        clicked={onScreenChanged}
      />
      <LabeledSwitch
        value={bankLabel}
        label="Bank"
        title="Display bank label information?"
        clicked={onShowBankLabelChanged}
      />
    </PanelHeaderGroup>
    <PanelHeaderGroup>
      <SmallIconButton
        iconName={pausedPc < topAddress ? "arrow-circle-up" : "arrow-circle-down"}
        title={"Go to the PC address"}
        enable={
          machineState === MachineControllerState.Paused ||
          machineState === MachineControllerState.Stopped
        }
        clicked={onGoToPc}
      />
      <AddressInput
        label="Go To"
        clearOnEnter={true}
        decimalView={false}
        onAddressSent={async (address) => {
          await onGoToAddress(address);
        }}
      />
    </PanelHeaderGroup>
  </PanelHeader>
);

type DisassemblyBankToolbarProps = {
  allowViews: boolean;
  autoRefresh: boolean;
  currentSegment: number;
  decimalView: boolean;
  disassOffset: number;
  displayBankMatrix: boolean;
  isFullView: boolean;
  offsetOptions: DropdownOption[];
  onCurrentSegmentChanged: (segment: number) => void;
  onDisassOffsetChanged: (offset: number) => void;
  onFullViewChanged: (value: boolean) => void;
  segmentOptions: DropdownOption[];
  /** Every partition, for the matrix-shaped chooser. */
  partitionOptions: PartitionOption[];
};

export const DisassemblyBankToolbar = ({
  allowViews,
  autoRefresh,
  currentSegment,
  decimalView,
  disassOffset,
  displayBankMatrix,
  isFullView,
  offsetOptions,
  onCurrentSegmentChanged,
  onDisassOffsetChanged,
  onFullViewChanged,
  partitionOptions,
  segmentOptions
}: DisassemblyBankToolbarProps) => {
  if (autoRefresh || !allowViews) {
    return null;
  }

  return (
    <PanelHeader>
      <PanelHeaderGroup>
        <LabeledSwitch
          value={isFullView}
          label="64K View"
          title="Show the full 64K memory"
          clicked={onFullViewChanged}
        />
      </PanelHeaderGroup>
      {!isFullView && (
        <>
          <PanelHeaderGroup>
            <Text text="Select bank" />
            <LabelSeparator />
            {/*
              * The same chooser the Memory view and the breakpoint dialog use. This was a third copy
              * of the machine-id branch, which is how the disassembly view could have ended up
              * offering a different picker than the view beside it.
              */}
            <PartitionPicker
              value={currentSegment}
              onChange={onCurrentSegmentChanged}
              displayBankMatrix={displayBankMatrix}
              segmentOptions={segmentOptions}
              partitionOptions={partitionOptions}
              decimalView={decimalView}
            />
          </PanelHeaderGroup>
          <PanelHeaderGroup>
            <Text text="Offset" />
            <LabelSeparator />
            <Dropdown
              options={offsetOptions}
              initialValue={disassOffset.toString(10)}
              width={68}
              onChanged={(option) => onDisassOffsetChanged(parseInt(option, 10))}
            />
          </PanelHeaderGroup>
        </>
      )}
    </PanelHeader>
  );
};
