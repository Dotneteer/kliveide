import type { WatchInfo } from "@common/state/AppState";

import { Label } from "@renderer/controls/layout/Label";
import { Value } from "@renderer/controls/layout/Value";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import { removeWatchAction, setSideBarPanelExpandedAction } from "@common/state/actions";
import { useState, useEffect, useCallback, useMemo, memo } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@controls/ContextMenu";
import { useMainApi } from "@renderer/core/MainApi";
import { integerSymbolsOf } from "@common/utils/breakpoint-condition/integer-symbols";
import { getBreakpointStorageKey } from "@common/utils/breakpoints";
import {
  describeWatchpoints,
  overlappingWatchpoints,
  watchByteCount,
  watchpointsForWatch,
  watchpointsOfWatch,
  type WatchAccess
} from "../utils/watch-watchpoints";
import { requestBreakpointReveal } from "../utils/breakpoint-reveal";
import { EMPTY_ARRAY } from "@renderer/utils/stablerefs";
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
import { HistoryPresentBanner } from "../debugger/history/HistoryPresentBanner";

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
  /** The watch definition the row shows. */
  info: WatchInfo;
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
  /*
   * `?? EMPTY_ARRAY`, not `|| []`.
   *
   * The panel genuinely needs the items — selecting a length here would be wrong, and `WatchBadge`
   * exists precisely because the *badge* needs the count. What was wrong is the fallback: a fresh
   * `[]` on every store update while the list is empty, so referential equality never held, the
   * panel re-rendered on every unrelated state change, and the effect below re-ran with it.
   */
  const watchExpressions = useSelector((s) => s.watchExpressions ?? EMPTY_ARRAY);
  const compilationResult = useSelector((s) => s.compilation?.result);

  // --- Update the watch values according to the current definitions, compilation result,
  // --- and emulator memory state
  const updateWatchValues = useCallback(
    (watches: WatchInfo[], mem: Uint8Array | null, compRes: any) => {
      const toDisplay: WatchEntry[] = [];

      for (const watch of watches) {
        const briefType = getBriefTypeName(watch.type);
        const watchEntry: WatchEntry = {
          info: watch,
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

  /*
   * Periodically refresh watch values.
   *
   * The guard is the point: this pulls the machine's entire 64K, ~1.3 times a second, for as long
   * as the panel is open — and did so with zero watch expressions defined, which is the panel's
   * default state. Nothing can be computed from that memory until there is something to evaluate.
   * `SysVarsPanel` takes the same shape for the same reason.
   */
  const refreshMemory = useCallback(async () => {
    if (!watchExpressions.length) return;
    setMemoryContents((await emuApi.getMemoryContents()).memory);
  }, [emuApi, watchExpressions.length]);

  useEmuStateListener(emuApi, refreshMemory);

  /*
   * The breakpoints, for the watchpoint indicator (W4): refreshed when the set changes, the panel's
   * one extra read. Only while there are watches to mark.
   */
  const bpsVersion = useSelector((s) => s.emulatorState?.breakpointsVersion);
  const [breakpoints, setBreakpoints] = useState<BreakpointInfo[]>(EMPTY_ARRAY);
  useEffect(() => {
    if (!watchExpressions.length) return undefined;
    let live = true;
    void Promise.resolve()
      .then(() => emuApi.listBreakpoints())
      .then((r) => live && setBreakpoints(r?.breakpoints ?? []))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [emuApi, bpsVersion, watchExpressions.length]);
  const symbols = useMemo(
    () => integerSymbolsOf((compilationResult as { symbols?: Record<string, unknown> })?.symbols),
    [compilationResult]
  );

  // --- The row menu (W2): the watchpoint items, then the watch's own delete
  const dispatch = useDispatch();
  const mainApi = useMainApi();
  const [menuState, menuApi] = useContextMenuState();
  const [menuTarget, setMenuTarget] = useState<WatchEntry>();
  const openMenu = useCallback(
    (entry: WatchEntry, e: ReactMouseEvent) => {
      e.preventDefault();
      setMenuTarget(entry);
      menuApi.show(e);
    },
    [menuApi]
  );
  const breakOn = async (entry: WatchEntry, access: WatchAccess) => {
    for (const bp of watchpointsForWatch(entry.info, access)) await emuApi.setBreakpoint(bp);
    void mainApi.saveProject();
  };
  const removeWatchpoints = async (entry: WatchEntry) => {
    for (const bp of watchpointsOfWatch(entry.info, breakpoints)) await emuApi.removeBreakpoint(bp);
    void mainApi.saveProject();
  };
  const runFromMenu = (action: () => Promise<void> | void) => () => {
    menuApi.conceal();
    void action();
  };
  const menuNoMemory = !menuTarget || watchByteCount(menuTarget.info) === undefined;

  return (
    <div className={styles.watchPanel}>
      <HistoryPresentBanner what="Watched memory" />
      <ContextMenu state={menuState} onClickOutside={() => menuApi.conceal()}>
        <ContextMenuItem
          text="Break on write"
          iconName="bp-mem-write"
          disabled={menuNoMemory}
          clicked={runFromMenu(() => breakOn(menuTarget!, "w"))}
        />
        <ContextMenuItem
          text="Break on read"
          iconName="bp-mem-read"
          disabled={menuNoMemory}
          clicked={runFromMenu(() => breakOn(menuTarget!, "r"))}
        />
        <ContextMenuItem
          text="Break on access"
          disabled={menuNoMemory}
          clicked={runFromMenu(() => breakOn(menuTarget!, "rw"))}
        />
        <ContextMenuItem
          text="Remove watchpoint"
          disabled={!menuTarget || watchpointsOfWatch(menuTarget.info, breakpoints).length === 0}
          clicked={runFromMenu(() => removeWatchpoints(menuTarget!))}
        />
        <ContextMenuSeparator />
        <ContextMenuItem
          text="Delete watch"
          dangerous
          clicked={runFromMenu(async () => {
            // --- What `w-del` does: drop it from the store, save the project
            dispatch(removeWatchAction(menuTarget!.info.symbol), "ide");
            await mainApi.saveProject();
          })}
        />
      </ContextMenu>
      {displayedWatches.length === 0 && (
        <EmptyState message="No watch expressions defined" />
      )}
      {displayedWatches.length > 0 && (
        <VirtualizedList
          items={displayedWatches}
          scrollRowsHorizontally
          /*
           * No `try`/`catch` here. Indexing an array cannot throw, so the catch this replaced was
           * unreachable — and had it ever caught anything it would have swallowed a real render
           * error from `WatchItem` and drawn an empty div in its place.
           */
          renderItem={(idx) => {
            const entry = displayedWatches[idx];
            const start = symbols[entry.info.symbol.toLowerCase()];
            const length = watchByteCount(entry.info);
            const watched =
              start === undefined || length === undefined
                ? EMPTY_ARRAY
                : overlappingWatchpoints(start & 0xffff, length, breakpoints);
            return <WatchItem watch={entry} watchpoints={watched} onMenu={openMenu} />;
          }}
        />
      )}
    </div>
  );
};


// --- Helpers
type WatchItemProps = {
  watch: WatchEntry;
  /** The enabled memory breakpoints over the watch's bytes (W4). */
  watchpoints: readonly BreakpointInfo[];
  onMenu: (entry: WatchEntry, e: ReactMouseEvent) => void;
};
const WatchItem = memo(({ watch, watchpoints, onMenu }: WatchItemProps) => {
  const dispatch = useDispatch();
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
    ? [
        watch.symbol,
        `(${watch.typeName})`,
        ...describeWatchpoints(watchpoints),
        watchpoints.length ? "Click the watchpoint mark to show it in the Breakpoints panel" : "",
        "Right-click the row for watchpoints; right-click the icon to delete"
      ]
        .filter((line) => line)
        .join("\n")
    : "";
  const reads = watchpoints.some((bp) => bp.memoryRead);
  const writes = watchpoints.some((bp) => bp.memoryWrite);

  return watch ? (
    <DataRow
      hoverable
      ref={rowRef}
      xclass={styles.watchRow}
      onContextMenu={(e) => onMenu(watch, e)}
    >
      <div
        className={styles.watchIcon}
        onContextMenu={(e) => {
          // --- The icon keeps its delete (W2), and the row menu does not open on top of it
          e.preventDefault();
          e.stopPropagation();
          void handleRemove();
        }}
      >
        <Icon iconName={watch.icon} width={16} height={16} fill={watch.fill} />
      </div>
      {/* The watchpoint mark (W4): the memory-write glyph wins when both kinds watch the bytes */}
      <div
        className={styles.watchpointMark}
        onClick={() => {
          if (!watchpoints[0]) return;
          dispatch(setSideBarPanelExpandedAction("breakpointsPanel", true));
          // --- After the panel has had a chance to mount
          setTimeout(() => requestBreakpointReveal(getBreakpointStorageKey(watchpoints[0])), 50);
        }}
      >
        {(reads || writes) && (
          <Icon
            iconName={writes ? "bp-mem-write" : "bp-mem-read"}
            width={14}
            height={14}
            fill="--color-breakpoint-binary"
          />
        )}
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
