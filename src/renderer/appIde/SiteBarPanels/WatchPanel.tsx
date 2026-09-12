import type { WatchInfo } from "@common/state/AppState";

import { Label } from "@renderer/controls/layout/Label";
import { Value } from "@renderer/controls/layout/Value";
import { useSelector } from "@renderer/core/RendererProvider";
import { useState, useEffect, useCallback, memo } from "react";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { Icon } from "@renderer/controls/Icon";
import styles from "./WatchPanel.module.scss";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { ExpressionValueType } from "@abstractions/CompilerInfo";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { DataRow, EmptyState, formatHex } from "@renderer/controls/data";
import regStyles from "@renderer/controls/data/Registers.module.scss";

/**
 * The type icon's colour.
 *
 * A watch's *type* is not state, so it does not earn a hue: the glyph already says which type it is
 * (`symbol-numeric`, `symbol-string`, `symbol-field`), and the row's tooltip names it. These icons
 * used to be filled with `--console-ansi-cyan`, `--console-ansi-bright-green` and
 * `--console-ansi-bright-red` — the *console's* ANSI palette, three saturated hues spent on
 * decoration in a data panel, which is the pattern §5.2 removed everywhere else.
 *
 * What does earn a hue is the one thing that is state: a watch that could not be resolved.
 */
const TYPE_ICON_FILL = "--data-label";
const UNRESOLVED_ICON_FILL = "--status-warning";

type WatchEntry = {
  symbol: string;
  value: string;
  icon: string;
  fill: string;
  typeName: string;
  /** The symbol could not be resolved, so `value` is a placeholder rather than data. */
  unresolved: boolean;
};

export const WatchPanel = () => {
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
          fill: UNRESOLVED_ICON_FILL,
          typeName: briefType,
          unresolved: true
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
            watchEntry.fill = TYPE_ICON_FILL;
            watchEntry.unresolved = false;
            break;
          case ExpressionValueType.Integer:
            watchEntry.value = formatIntegerWatchValue(watch, mem, symbolInfo);
            watchEntry.icon = watch.direct ? "symbol-numeric" : "symbol-field";
            watchEntry.fill = TYPE_ICON_FILL;
            watchEntry.unresolved = false;
            break;
          case ExpressionValueType.String:
            watchEntry.value = `"${symbolInfo.value._value}"`;
            watchEntry.icon = "symbol-string";
            watchEntry.fill = TYPE_ICON_FILL;
            watchEntry.unresolved = false;
            break;
          case ExpressionValueType.Real:
            watchEntry.value = symbolInfo.value._value;
            watchEntry.icon = "symbol-numeric";
            watchEntry.fill = TYPE_ICON_FILL;
            watchEntry.unresolved = false;
            break;
        }
      }

      setDisplayedWatches(toDisplay);
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
        <EmptyState message="No watch expressions defined" />
      )}
      {displayedWatches.length > 0 && (
        <VirtualizedList
          items={displayedWatches}
          scrollRowsHorizontally
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


// --- Helpers
type WatchItemProps = { watch: WatchEntry };
const WatchItem = memo(({ watch }: WatchItemProps) => {
  const { ideCommandsService } = useAppServices();
  const rowRef = useTooltipRef<HTMLDivElement>();

  // --- Handle adding/removing a breakpoint
  const handleRemove = async () => {
    let command = `w-del ${watch.symbol}`;
    await ideCommandsService.executeCommand(command);
  };

  /*
   * The tooltip now answers anywhere along the row rather than only over the 16px icon, so it says
   * *where* to right-click. The delete target itself is deliberately left on the icon: widening a
   * destructive action to the whole row is a behaviour change, not a restyle.
   */
  const tip = watch
    ? `${watch.symbol}\n(${watch.typeName})\nRight-click the icon to delete`
    : "";

  return watch ? (
    <DataRow hoverable ref={rowRef} xclass={styles.watchRow}>
      <div className={styles.watchIcon} onContextMenu={handleRemove}>
        <Icon iconName={watch.icon} width={16} height={16} fill={watch.fill} />
      </div>
      <Label text={watch.symbol} className={styles.watchLabel} />
      <Value
        text={watch.value}
        className={watch.unresolved ? styles.watchValueError : regStyles.stateValue}
      />
      <TooltipFactory
        refElement={rowRef.current}
        placement="right"
        offsetX={8}
        offsetY={32}
        showDelay={100}
        content={tip}
      />
    </DataRow>
  ) : null;
});

function formatIntegerWatchValue(watch: WatchInfo, mem: Uint8Array, symbolInfo: any): string {
  try {
    const direct = !!watch.direct;
    const wtype = watch.type ?? "b";
    const val = (Number(symbolInfo.value?._value) | 0) as number;

    const formatNum = (num: number, width: 2 | 4 | 8): string =>
      `${formatHex(num, width)} (${num >>> 0})`;

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
        // Was lowercase and unprefixed, unlike formatNum forty lines above in this same file.
        bytes.push(formatHex(b, 2, ""));
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
