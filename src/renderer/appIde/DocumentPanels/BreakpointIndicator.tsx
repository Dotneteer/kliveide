import { useEffect, useState } from "react";
import { Icon } from "@controls/Icon";
import { TooltipFactory, useTooltipRef } from "@controls/Tooltip";
import { toHexa4 } from "../services/ide-commands";
import styles from "./BreakpointIndicator.module.scss";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { Checkbox } from "@renderer/controls/Checkbox";

type Props = {
  address: number | string;
  partition?: string;
  hasBreakpoint: boolean;
  disabled: boolean;
  current: boolean;
  memoryRead?: boolean;
  memoryWrite?: boolean;
  ioRead?: boolean;
  ioWrite?: boolean;
  ioMask?: number;
  showType?: boolean;
  resolvedAddress?: number;
  /**
   * Suppress this component's own tooltips.
   *
   * For a caller whose *row* already carries one: two tooltips on nested elements both fire on
   * hover and render on top of each other. `BreakpointsPanel` sets this and folds the action hints
   * below into its row tooltip; the disassembly view, which has no row tooltip, leaves it off.
   */
  noTooltip?: boolean;
  /**
   * Open an editor for this breakpoint.
   *
   * Supplied by the disassembly view, where the row has no menu of its own; the Breakpoints panel
   * leaves it unset because its own row already handles the same gesture.
   */
  onEdit?: () => void;
};

export const BreakpointIndicator = ({
  address,
  partition,
  hasBreakpoint,
  disabled,
  current,
  memoryRead,
  memoryWrite,
  ioRead,
  ioWrite,
  ioMask,
  showType,
  resolvedAddress,
  noTooltip,
  onEdit
}: Props) => {
  const { ideCommandsService } = useAppServices();
  const cbkRef = useTooltipRef();
  const ref = useTooltipRef();
  const [pointed, setPointed] = useState(false);
  const [isDisabled, setIsDisabled] = useState(disabled);

  // --- Calculate tooltip text
  let addrLabel =
    typeof address === "number"
      ? partition !== undefined
        ? `${partition}:$${toHexa4(address)}`
        : `$${toHexa4(address)}`
      : address;

  let bpType = "execute";
  // --- `bp-exec`, not the shared `symbol-event`: that one is a lightning bolt from another icon
  // --- family, it belongs to no set, and `registry.ts` still uses it elsewhere — so the breakpoint
  // --- type icons get their own glyph rather than overriding a shared name.
  let typeIcon = "bp-exec";
  if (memoryRead) {
    bpType = "memory read";
    typeIcon = "bp-mem-read";
  } else if (memoryWrite) {
    bpType = "memory write";
    typeIcon = "bp-mem-write";
  } else if (ioRead) {
    bpType = "I/O read";
    typeIcon = "bp-io-read";
  } else if (ioWrite) {
    bpType = "I/O write";
    typeIcon = "bp-io-write";
  }
  // --- One colour for all five: the glyphs now carry the read/write distinction the three ANSI
  // --- hues used to. See `--color-breakpoint-type` in componentAliases.ts.
  const typeColor = "--color-breakpoint-type";

  const tooltipCommon = `${addrLabel}${(ioRead || ioWrite) && ioMask ? " /$" + toHexa4(ioMask) : ""} (${bpType})`;
  const tooltip =
    `${tooltipCommon})\n` +
    (hasBreakpoint ? `Right-click to remove this breakpoint` : "Right-click to set a breakpoint") +
    (hasBreakpoint && onEdit ? "\nDouble-click to edit this breakpoint" : "");
  const tooltipCheckbox =
    `${tooltipCommon})\n` +
    (disabled ? `Check to enable this breakpoint` : "Uncheck to disable this breakpoint");

  // --- Select the icon to show
  let iconName = "";
  let fill = "";
  if (current) {
    iconName = hasBreakpoint ? "debug-with-bp" : "debug-current";
    fill = "--color-breakpoint-current";
  } else if (hasBreakpoint) {
    iconName = "circle-filled";
    fill = disabled
      ? "--color-breakpoint-disabled"
      : typeof address === "number"
        ? "--color-breakpoint-binary"
        : resolvedAddress
          ? "--color-breakpoint-code"
          : "--color-debug-unreachable-bp";
  } else if (pointed) {
    iconName = "circle-large-outline";
    fill = "--color-breakpoint-disabled";
  }

  useEffect(() => {
    setIsDisabled(disabled);
  }, [disabled]);

  // --- Handle adding/removing a breakpoint
  const handleRemove = async () => {
    let command =
      `${hasBreakpoint ? "bp-del" : "bp-set"} ${addrLabel} ` +
      `${memoryRead ? "-r" : ""} ${memoryWrite ? "-w" : ""}` +
      `${ioRead ? "-i" : ""} ${ioWrite ? "-o" : ""}`;
    if (ioRead || ioWrite) {
      command += ` -m $${toHexa4(ioMask)}`;
    }
    await ideCommandsService.executeCommand(command);
  };

  // --- Handle enabling/disabling a breakpoint
  const enableOrDisable = async () => {
    let command =
      `bp-en ${addrLabel} ${disabled ? "" : "-d"} ` +
      `${memoryRead ? "-r" : ""} ${memoryWrite ? "-w" : ""}` +
      `${ioRead ? "-i" : ""} ${ioWrite ? "-o" : ""}`;
    if (ioRead || ioWrite) {
      command += ` -m $${toHexa4(ioMask)}`;
    }
    if (hasBreakpoint) {
      await ideCommandsService.executeCommand(command);
    }
  };

  return (
    <div
      className={styles.breakpointWrapper}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
      /*
       * The indicator owns right-click within its own bounds.
       *
       * `BreakpointsPanel` puts a context menu on the whole row, and this indicator sits inside
       * every one of those rows while binding right-click to *delete the breakpoint outright*.
       * Without this the two would fight: the row menu would open on top of a silent delete, or
       * shadow it, depending on where in the indicator the click landed. Stopping propagation on
       * the wrapper — rather than on the icon alone — keeps the checkbox and the glyph behaving as
       * one unit, instead of a menu appearing a few pixels away from a gesture that deletes.
       */
      onContextMenu={(e) => e.stopPropagation()}
    >
      {showType && (
        <div ref={cbkRef} style={{ zoom: 0.8 }}>
          <Checkbox key={address} initialValue={!isDisabled} right={true} onChange={enableOrDisable} />
          {!noTooltip && (
            <TooltipFactory
              refElement={cbkRef.current}
              placement="right"
              offsetX={0}
              offsetY={40}
              showDelay={100}
              content={tooltipCheckbox}
            />
          )}
        </div>
      )}
      <div
        ref={ref}
        style={{ display: "flex", flexDirection: "row", justifyContent: "center" }}
        onContextMenu={(e) => {
          // --- Suppress the platform menu; the wrapper above has already stopped this reaching a
          // --- row-level menu.
          e.preventDefault();
          void handleRemove();
        }}
        onDoubleClick={
          hasBreakpoint && onEdit
            ? (e) => {
                // --- Where a row also listens for a double-click, only one editor should open.
                e.stopPropagation();
                onEdit();
              }
            : undefined
        }
      >
        {iconName ? (
          <div className={styles.breakpointIndicator}>
            <Icon width={16} height={16} iconName={iconName} fill={fill} />
          </div>
        ) : (
          <div className={styles.iconPlaceholder} />
        )}
        {!noTooltip && (
          <TooltipFactory
            refElement={ref.current}
            placement="right"
            offsetX={0}
            offsetY={40}
            showDelay={100}
            content={tooltip}
          />
        )}
        {showType && <Icon iconName={typeIcon} fill={typeColor} width={16} height={16} />}
      </div>
    </div>
  );
};
