import { useMemo, useRef, useState } from "react";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { MemoryDumpSection } from "@renderer/features/memory/MemoryDumpSection";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { FullPanel } from "@renderer/controls/layout/Panels";
import { DataPanel, DataRow, EmptyState } from "@renderer/controls/data";
import { PanelHeader } from "@renderer/controls/data";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { VListHandle } from "virtua";
import { AddressInput } from "@renderer/controls/AddressInput";
import Dropdown, { DropdownOption } from "@renderer/controls/Dropdown";
import { Text } from "@renderer/controls/layout/Text";
import { useT, type TFunction } from "@common/i18n/useT";
import { uiLocale } from "@common/i18n/i18n";

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

type DumpViewMode = "8x1" | "8x2" | "16x1";

const viewModeOptions = (t: TFunction): DropdownOption[] => [
  { value: "8x1", label: t("panels.doc.binViewer.layout8x1") },
  { value: "8x2", label: t("panels.doc.binViewer.layout8x2") },
  { value: "16x1", label: t("panels.doc.binViewer.layout16x1") },
];

const BinFileViewerPanelComponent = ({ contents }: DocumentProps) => {
  const t = useT();
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
    return <EmptyState message={t("panels.doc.binViewer.noContent")} />;
  }

  if (data.length > MAX_FILE_SIZE) {
    const sizeMb = (data.length / (1024 * 1024)).toLocaleString(uiLocale(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return (
      <EmptyState
        message={t("panels.doc.binViewer.tooLarge", { sizeMb, maxMb: 4 })}
      />
    );
  }

  return (
    <DataPanel>
      <PanelHeader>
        <LabeledSwitch
          label={t("panels.doc.binViewer.decimal")}
          title={t("panels.doc.binViewer.decimalTitle")}
          value={decimalView}
          clicked={(val) => setDecimalView(val)}
        />
        <Text text={t("panels.doc.binViewer.view")} />
        <LabelSeparator />
        <Dropdown
          options={viewModeOptions(t)}
          initialValue={viewMode}
          width={88}
          onChanged={(val) => setViewMode(val as DumpViewMode)}
        />
        <LabeledSwitch
          label={t("panels.doc.binViewer.chars")}
          title={t("panels.doc.binViewer.charsTitle")}
          value={charDump}
          clicked={(val) => setCharDump(val)}
        />
        <AddressInput
          label={t("panels.doc.common.goTo")}
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
          apiLoaded={(api) => {
            vlApi.current = api;
            lastScrolledIndex.current = -1;
          }}
          renderItem={(idx) => (
            <DataRow index={idx} hoverable>
              <MemoryDumpSection
                address={rows[idx]}
                bytes={data.slice(rows[idx], rows[idx] + byteCount)}
                decimalView={decimalView}
                charDump={charDump}
                lastJumpAddress={lastJumpAddress}
                addressDigits={addressDigits}
              />
              {showTwoColumns && rows[idx] + 0x08 < data.length && (
                <MemoryDumpSection
                  address={rows[idx] + 0x08}
                  bytes={data.slice(rows[idx] + 0x08, rows[idx] + 0x08 + byteCount)}
                  decimalView={decimalView}
                  charDump={charDump}
                  lastJumpAddress={lastJumpAddress}
                  addressDigits={addressDigits}
                />
              )}
            </DataRow>
          )}
        />
      </FullPanel>
    </DataPanel>
  );
};

export const createBinFileViewerPanel = ({ document, contents, apiLoaded }: DocumentProps) => (
  <BinFileViewerPanelComponent document={document} contents={contents} apiLoaded={apiLoaded} />
);
