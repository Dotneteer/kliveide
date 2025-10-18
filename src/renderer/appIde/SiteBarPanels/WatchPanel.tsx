import type { WatchInfo } from "@common/state/AppState";

import { LabelSeparator, Label } from "@controls/Labels";
import { useSelector } from "@renderer/core/RendererProvider";
import { useState, useEffect, useCallback, memo } from "react";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { Icon } from "@renderer/controls/Icon";
import styles from "./WatchPanel.module.scss";
import { Value } from "@renderer/controls/generic/Value";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { ExpressionValueType } from "@abstractions/CompilerInfo";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import { useAppServices } from "../services/AppServicesProvider";

const LABEL_WIDTH = 120;

type WatchEntry = {
  symbol: string;
  value: string;
  icon: string;
  fill: string;
  typeName: string;
};

const WatchPanel = () => {
  const emuApi = useEmuApi();
  // (no machine charset usage)
  const [displayedWatches, setDisplayedWatches] = useState<WatchEntry[]>([]);
  const [memoryContents, setMemoryContents] = useState<Uint8Array | null>(null);
  const watchExpressions = useSelector((s) => s.watchExpressions || []);
  const compilationResult = useSelector((s) => s.compilation?.result);

  // --- Update the watch values according to the current definitions, compilation result,
  // --- and emulator memory state
  const updateWatchValues = useCallback(
    (watches: WatchInfo[], mem: Uint8Array | null, compRes: any) => {
      const toDisplay: WatchEntry[] = [];

      for (const watch of watches) {
        const briefType = getBriefTypeName(watch.type);
        const watchEntry: WatchEntry = {
          symbol: watch.symbol.toUpperCase(),
          value: "<unknown>",
          icon: "warning",
          fill: "--console-ansi-bright-red",
          typeName: briefType
        };
        toDisplay.push(watchEntry);
        if (!mem) {
          // --- No memory contents available
          continue;
        }

        if (!(compRes as any)?.symbols) {
          // --- No symbol information available
          continue;
        }

        // --- Does the symbol exist in the compiled symbols?
        const symbolInfo = (compRes as any).symbols?.[watch.symbol.toLowerCase()];
        if (!symbolInfo) {
          // --- Symbol not found
          watchEntry.value = "<not found>";
          continue;
        }

        // --- Process the symbol according to its value type
        switch (symbolInfo?.value?._type) {
          case ExpressionValueType.Bool:
            watchEntry.value = symbolInfo.value._value.toString();
            watchEntry.icon = "symbol-numeric";
            watchEntry.fill = "--console-ansi-cyan";
            break;
          case ExpressionValueType.Integer:
            watchEntry.value = formatIntegerWatchValue(watch, mem, symbolInfo);
            watchEntry.icon = watch.direct ? "symbol-numeric" : "symbol-field";
            watchEntry.fill = "--console-ansi-bright-green";
            break;
          case ExpressionValueType.String:
            watchEntry.value = `"${symbolInfo.value._value}"`;
            watchEntry.icon = "symbol-string";
            watchEntry.fill = "--console-ansi-cyan";
            break;
          case ExpressionValueType.Real:
            watchEntry.value = symbolInfo.value._value;
            watchEntry.icon = "symbol-numeric";
            watchEntry.fill = "--console-ansi-cyan";
            break;
        }
      }

      setDisplayedWatches(toDisplay);
      console.log("WatchPanel: Updated watch values", toDisplay);
    },
    []
  );

  // --- Update the local state when Redux state changes
  useEffect(() => {
    updateWatchValues(watchExpressions, memoryContents, compilationResult);
  }, [watchExpressions, memoryContents, compilationResult, updateWatchValues]);

  // --- Periodically refresh watch values
  useEmuStateListener(emuApi, async () => {
    // --- Obtain the current memory contents
    const mem = (await emuApi.getMemoryContents()).memory;
    setMemoryContents(mem);
  });

  return (
    <div className={styles.watchPanel}>
      {displayedWatches.length === 0 && (
        <div className={styles.center}>No watch expressions defined</div>
      )}
      {displayedWatches.length > 0 && (
        <VirtualizedList
          items={displayedWatches}
          renderItem={(idx) => {
            try {
              const watch = displayedWatches[idx];
              return <WatchItem watch={watch} />;
            } catch (e) {
              return <div key={idx} />;
            }
          }}
        />
      )}
    </div>
  );
};

export const watchPanelRenderer = () => <WatchPanel />;

// --- Helpers
type WatchItemProps = { watch: WatchEntry };
const WatchItem = memo(({ watch }: WatchItemProps) => {
  const { ideCommandsService } = useAppServices();
  const watchRef = useTooltipRef();

  // --- Handle adding/removing a breakpoint
  const handleRemove = async () => {
    let command = `w-del ${watch.symbol}`;
    await ideCommandsService.executeCommand(command);
  };

  const tip = `(${watch.typeName}) Right-click to delete '${watch.symbol}'`;

  return watch ? (
    <div className={styles.watchItem}>
      <LabelSeparator width={4} />
      <div ref={watchRef} style={{ cursor: "pointer" }} onContextMenu={handleRemove}>
        <Icon iconName={watch.icon} width={16} height={16} fill={watch.fill} />
        <TooltipFactory
          refElement={watchRef.current}
          placement="right"
          offsetX={8}
          offsetY={32}
          showDelay={100}
          content={tip}
        />
      </div>
      <LabelSeparator width={8} />
      <Label text={watch.symbol} width={LABEL_WIDTH} />
      <Value text={watch.value} />
    </div>
  ) : null;
});

function formatIntegerWatchValue(watch: WatchInfo, mem: Uint8Array, symbolInfo: any): string {
  try {
    const direct = !!watch.direct;
    const wtype = watch.type ?? "b";
    const val = (Number(symbolInfo.value?._value) | 0) as number;

    const formatNum = (num: number, width: 2 | 4 | 8): string => {
      const hex = num >>> 0; // ensure unsigned for display
      return `$${hex.toString(16).toUpperCase().padStart(width, "0")} (${hex})`;
    };

    // Helper to wrap addresses to 16-bit range and read byte(s)
    const readByte = (addr: number) => mem[(addr & 0xffff) >>> 0];

    const readWordLE = (addr: number) => {
      const lo = readByte(addr);
      const hi = readByte(addr + 1);
      return (lo | (hi << 8)) & 0xffff;
    };

    const readWordBE = (addr: number) => {
      const hi = readByte(addr);
      const lo = readByte(addr + 1);
      return (lo | (hi << 8)) & 0xffff;
    };

    const readDWordLE = (addr: number) => {
      const b0 = readByte(addr);
      const b1 = readByte(addr + 1);
      const b2 = readByte(addr + 2);
      const b3 = readByte(addr + 3);
      return (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0;
    };

    const readDWordBE = (addr: number) => {
      const b0 = readByte(addr);
      const b1 = readByte(addr + 1);
      const b2 = readByte(addr + 2);
      const b3 = readByte(addr + 3);
      return ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
    };

    const readAscii = (addr: number, len: number) => {
      const chars: string[] = [];
      for (let i = 0; i < len; i++) {
        const ch = readByte(addr + i) & 0xff;
        // printable ASCII 32..126; fallback to '.'
        chars.push(ch >= 32 && ch <= 126 ? String.fromCharCode(ch) : ".");
      }
      return `"${chars.join("")}"`;
    };

    const readArrayHex = (addr: number, len: number) => {
      const bytes: string[] = [];
      const maxPreview = Math.min(len, 16);
      for (let i = 0; i < maxPreview; i++) {
        const b = readByte(addr + i);
        bytes.push(b.toString(16).padStart(2, "0"));
      }
      const suffix = len > maxPreview ? ` … (+${len - maxPreview})` : "";
      return bytes.join(" ") + suffix;
    };

    if (direct) {
      // Always use 16-bit formatting for direct integer values, regardless of type
      return formatNum(val & 0xffff, 4);
    }

    // Treat symbol value as an address within 16-bit range
    const addr = val & 0xffff;
    switch (wtype) {
      case "f": {
        const b = readByte(addr);
        return (b !== 0).toString();
      }
      case "b": {
        const b = readByte(addr);
        return formatNum(b, 2);
      }
      case "w": {
        const wv = readWordLE(addr);
        return formatNum(wv, 4);
      }
      case "-w": {
        const wv = readWordBE(addr);
        return formatNum(wv, 4);
      }
      case "l": {
        const lv = readDWordLE(addr);
        return formatNum(lv, 8);
      }
      case "-l": {
        const lv = readDWordBE(addr);
        return formatNum(lv, 8);
      }
      case "s": {
        const len = Math.max(0, watch.length ?? 0);
        if (len <= 0) {
          return "<invalid length>";
        }
        return readAscii(addr, len);
      }
      case "a": {
        const len = Math.max(0, watch.length ?? 0);
        if (len <= 0) {
          return "<invalid length>";
        }
        return readArrayHex(addr, len);
      }
      default:
        return "<unsupported type>";
    }
  } catch (err) {
    console.error("WatchPanel: integer formatting failed", err);
    return "<error>";
  }
}

function getBriefTypeName(type: WatchInfo["type"] | undefined): string {
  switch (type) {
    case "a":
      return "byte array";
    case "b":
      return "byte";
    case "w":
      return "word";
    case "-w":
      return "big-endian word";
    case "l":
      return "dword";
    case "-l":
      return "big-endian dword";
    case "f":
      return "flag";
    case "s":
      return "string";
    default:
      return "unknown";
  }
}
