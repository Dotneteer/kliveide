import { useState } from "react";
import { Icon } from "@controls/Icon";
import { TooltipFactory, useTooltipRef } from "@controls/Tooltip";
import { toHexa4 } from "../services/ide-commands";
import styles from "./BreakpointIndicator.module.scss";
import { useAppServices } from "../services/AppServicesProvider";

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
  showType
}: Props) => {
  const { ideCommandsService } = useAppServices();
  const ref = useTooltipRef();
  const [pointed, setPointed] = useState(false);

  // --- Calculate tooltip text
  let addrLabel =
    typeof address === "number"
      ? partition !== undefined
        ? `${partition}:$${toHexa4(address)}`
        : `$${toHexa4(address)}`
      : address;

  let bpType = "execute";
  let typeIcon = "symbol-event";
  let typeColor = "--console-ansi-bright-blue";
  if (memoryRead) {
    bpType = "memory read";
    typeIcon = "bp-mem-read";
    typeColor = "--console-ansi-bright-green";
  } else if (memoryWrite) {
    bpType = "memory write";
    typeIcon = "bp-mem-write";
    typeColor = "--console-ansi-bright-magenta";
  } else if (ioRead) {
    bpType = "I/O read";
    typeIcon = "bp-io-read";
    typeColor = "--console-ansi-bright-green";
  } else if (ioWrite) {
    bpType = "I/O write";
    typeIcon = "bp-io-write";
    typeColor = "--console-ansi-bright-magenta";
  }
  const tooltip =
    `${addrLabel}${(ioRead || ioWrite) && ioMask ? " /$" + toHexa4(ioMask) : ""} (${bpType})\n` +
    (hasBreakpoint
      ? `Left-click to remove\nRight-click to ${disabled ? "enable" : "disable"}`
      : "Click to set a breakpoint");

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
        : "--color-breakpoint-code";
  } else if (pointed) {
    iconName = "circle-large-outline";
    fill = "--color-breakpoint-disabled";
  }

  // --- Handle adding/removing a breakpoint
  const handleLeftClick = async () => {
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
  const handleRightClick = async () => {
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
      ref={ref}
      className={styles.breakpointWrapper}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
      onClick={handleLeftClick}
      onContextMenu={handleRightClick}
    >
      {iconName ? (
        <div className={styles.breakpointIndicator}>
          <Icon width={16} height={16} iconName={iconName} fill={fill} />
        </div>
      ) : (
        <div className={styles.iconPlaceholder} />
      )}
      <TooltipFactory
        refElement={ref.current}
        placement="right"
        offsetX={0}
        offsetY={40}
        showDelay={100}
        content={tooltip}
      />
      {showType && <Icon iconName={typeIcon} fill={typeColor} width={16} height={16} />}
    </div>
  );
};
