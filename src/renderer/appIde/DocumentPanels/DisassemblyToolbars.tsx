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
import type { ReactNode } from "react";
import { t as translate } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";

export function createDisassemblyOffsetOptions(decimalView: boolean): DropdownOption[] {
  const options: DropdownOption[] = [];
  for (let i = 0; i < 8; i++) {
    const offset = 0x2000 * i;
    const label = decimalView ? offset.toString() : toHexa4(offset);
    options.push({ value: offset.toString(), label });
  }
  return options;
}

/** The tooltip of the "Sys vars" switch, in the display language (shared with the memory views) */
export function sysVarNamesTitle(): string {
  return translate("panels.doc.disassembly.sysVarsTitle");
}

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
  onRomLabelsChanged?: (value: boolean) => void;
  pausedPc: number;
  ram: boolean;
  screen: boolean;
  sysVarNames: boolean;
  /** Whether the machine has ROM annotations to show; the toggle appears only then. */
  hasRomAnnotations?: boolean;
  romLabels?: boolean;
  topAddress: number;
  /** The reverse-engineering tools menu (`ReverseToolsMenu`), when the listing offers it. */
  reverseTools?: ReactNode;
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
  onRomLabelsChanged,
  pausedPc,
  ram,
  screen,
  sysVarNames,
  hasRomAnnotations,
  romLabels,
  topAddress,
  reverseTools
}: DisassemblyToolbarProps) => {
  const t = useT();
  return (
    <PanelHeader>
      <PanelHeaderGroup>
        <LabeledSwitch
          value={decimalView}
          label={t("panels.doc.disassembly.decimal")}
          title={t("panels.doc.disassembly.decimalTitle")}
          clicked={onDecimalViewChanged}
        />
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <LabeledSwitch
          value={sysVarNames}
          label={t("panels.doc.disassembly.sysVars")}
          title={t("panels.doc.disassembly.sysVarsTitle")}
          clicked={onSysVarNamesChanged}
        />
        {hasRomAnnotations && onRomLabelsChanged && (
          <LabeledSwitch
            value={romLabels ?? true}
            label={t("panels.doc.disassembly.romLabels")}
            title={t("panels.doc.disassembly.romLabelsTitle")}
            clicked={onRomLabelsChanged}
          />
        )}
      </PanelHeaderGroup>
      {/* --- The refresh button acts on what "Follow PC" selects, so the two travel together. */}
      <PanelHeaderGroup>
        <LabeledSwitch
          value={autoRefresh}
          label={t("panels.doc.disassembly.followPc")}
          title={t("panels.doc.disassembly.followPcTitle")}
          clicked={onAutoRefreshChanged}
        />
        <SmallIconButton
          iconName="refresh"
          title={t("panels.doc.common.refreshNow")}
          clicked={onManualRefresh}
        />
      </PanelHeaderGroup>
      {/* --- Three switches over what the listing covers: one group, so they wrap as a set. */}
      <PanelHeaderGroup>
        <LabeledSwitch
          value={ram}
          label={t("panels.doc.disassembly.ram")}
          title={t("panels.doc.disassembly.ramTitle")}
          clicked={onRamChanged}
        />
        <LabeledSwitch
          value={screen}
          label={t("panels.doc.disassembly.screen")}
          title={t("panels.doc.disassembly.screenTitle")}
          clicked={onScreenChanged}
        />
        <LabeledSwitch
          value={bankLabel}
          label={t("panels.doc.disassembly.bank")}
          title={t("panels.doc.disassembly.bankTitle")}
          clicked={onShowBankLabelChanged}
        />
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <SmallIconButton
          iconName={pausedPc < topAddress ? "arrow-circle-up" : "arrow-circle-down"}
          title={t("panels.doc.disassembly.goToPc")}
          enable={
            machineState === MachineControllerState.Paused ||
            machineState === MachineControllerState.Stopped
          }
          clicked={onGoToPc}
        />
        <AddressInput
          label={t("panels.doc.common.goTo")}
          clearOnEnter={true}
          decimalView={false}
          onAddressSent={async (address) => {
            await onGoToAddress(address);
          }}
        />
      </PanelHeaderGroup>
      {reverseTools && <PanelHeaderGroup>{reverseTools}</PanelHeaderGroup>}
    </PanelHeader>
  );
};

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
  const t = useT();
  if (autoRefresh || !allowViews) {
    return null;
  }

  return (
    <PanelHeader>
      <PanelHeaderGroup>
        <LabeledSwitch
          value={isFullView}
          label={t("panels.doc.disassembly.fullView")}
          title={t("panels.doc.disassembly.fullViewTitle")}
          clicked={onFullViewChanged}
        />
      </PanelHeaderGroup>
      {!isFullView && (
        <>
          <PanelHeaderGroup>
            <Text text={t("panels.doc.disassembly.selectBank")} />
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
            <Text text={t("panels.doc.disassembly.offset")} />
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
