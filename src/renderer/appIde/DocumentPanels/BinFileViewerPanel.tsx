import { useMemo, useRef, useState } from "react";
import { DocumentProps } from "@renderer/appIde/DocumentArea/DocumentsContainer";
import { DumpSection } from "./DumpSection";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { FullPanel, HStack } from "@renderer/controls/new/Panels";
import { PanelHeader } from "./helpers/PanelHeader";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { LabelSeparator } from "@renderer/controls/Labels";
import { VListHandle } from "virtua";
import { AddressInput } from "@renderer/controls/AddressInput";
import Dropdown, { DropdownOption } from "@renderer/controls/Dropdown";
import { Text } from "@renderer/controls/generic/Text";
import styles from "./BinFileViewerPanel.module.scss";

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

type DumpViewMode = "8x1" | "8x2" | "16x1";

const viewModeOptions: DropdownOption[] = [
  { value: "8x1", label: "8B / 1 col" },
  { value: "8x2", label: "8B / 2 col" },
  { value: "16x1", label: "16B / 1 col" },
];

const BinFileViewerPanelComponent = ({ contents }: DocumentProps) => {
  const data = contents as Uint8Array;

  const [decimalView, setDecimalView] = useState(false);
  const [charDump, setCharDump] = useState(true);
  const [viewMode, setViewMode] = useState<DumpViewMode>("8x2");
  const [lastJumpAddress, setLastJumpAddress] = useState(-1);
  const vlApi = useRef<VListHandle>(null);
  const lastScrolledIndex = useRef(-1);

  // Use 4 hex digits for files up to 64 KB, 6 digits for larger files (up to 4 MB)
  const addressDigits: 4 | 6 = data && data.length <= 0x1_0000 ? 4 : 6;

  const bytesPerRow = viewMode === "8x1" ? 8 : 16;
  const showTwoColumns = viewMode === "8x2";
  const byteCount: 8 | 16 = viewMode === "16x1" ? 16 : 8;

  const rows = useMemo(() => {
    if (!data || data.length === 0 || data.length > MAX_FILE_SIZE) return [];
    const items: number[] = [];
    for (let addr = 0; addr < data.length; addr += bytesPerRow) {
      items.push(addr);
    }
    return items;
  }, [data, bytesPerRow]);

  if (!data || data.length === 0) {
    return <div className={styles.message}>No content.</div>;
  }

  if (data.length > MAX_FILE_SIZE) {
    const sizeMb = (data.length / (1024 * 1024)).toFixed(2);
    return (
      <div className={styles.message}>
        File is too large to display ({sizeMb} MB). Maximum supported size is 4 MB.
      </div>
    );
  }

  return (
    <FullPanel fontFamily="--monospace-font" fontSize="0.8em">
      <PanelHeader>
        <LabeledSwitch
          label="Decimal"
          title="Show byte values in decimal"
          value={decimalView}
          clicked={(val) => setDecimalView(val)}
        />
        <LabelSeparator width={8} />
        <Text text="View" />
        <LabelSeparator width={4} />
        <Dropdown
          options={viewModeOptions}
          initialValue={viewMode}
          width={88}
          onChanged={(val) => setViewMode(val as DumpViewMode)}
        />
        <LabelSeparator width={8} />
        <LabeledSwitch
          label="Chars"
          title="Show character dump"
          value={charDump}
          clicked={(val) => setCharDump(val)}
        />
        <LabelSeparator width={8} />
        <AddressInput
          label="Go To"
          clearOnEnter={true}
          decimalView={decimalView}
          hexDigits={addressDigits}
          inputWidth={decimalView ? 64 : addressDigits === 6 ? 60 : 44}
          onAddressSent={async (address) => {
            const clampedAddress = Math.min(address, data.length - 1);
            const rowIndex = Math.floor(clampedAddress / bytesPerRow);
            setLastJumpAddress(clampedAddress);
            lastScrolledIndex.current = rowIndex;
            vlApi.current?.scrollToIndex(rowIndex, { align: "start" });
          }}
        />
      </PanelHeader>
      <FullPanel>
        <VirtualizedList
          items={rows}
          overscan={25}
          apiLoaded={(api) => {
            vlApi.current = api;
            lastScrolledIndex.current = -1;
          }}
          renderItem={(idx) => (
            <HStack
              backgroundColor={idx % 2 === 0 ? "--bgcolor-disass-even-row" : "transparent"}
              hoverBackgroundColor="--bgcolor-disass-hover"
            >
              <DumpSection
                address={rows[idx]}
                memory={data}
                decimalView={decimalView}
                charDump={charDump}
                lastJumpAddress={lastJumpAddress}
                addressDigits={addressDigits}
                byteCount={byteCount}
              />
              {showTwoColumns && rows[idx] + 0x08 < data.length && (
                <DumpSection
                  address={rows[idx] + 0x08}
                  memory={data}
                  decimalView={decimalView}
                  charDump={charDump}
                  lastJumpAddress={lastJumpAddress}
                  addressDigits={addressDigits}
                  byteCount={byteCount}
                />
              )}
            </HStack>
          )}
        />
      </FullPanel>
    </FullPanel>
  );
};

export const createBinFileViewerPanel = ({ document, contents, apiLoaded }: DocumentProps) => (
  <BinFileViewerPanelComponent document={document} contents={contents} apiLoaded={apiLoaded} />
);
