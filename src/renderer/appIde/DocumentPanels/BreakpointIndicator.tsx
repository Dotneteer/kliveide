import { useEffect, useState } from "react";
import { Icon } from "@controls/Icon";
import { TooltipFactory, useTooltipRef } from "@controls/Tooltip";
import { toHexa4 } from "../services/ide-commands";
import styles from "./BreakpointIndicator.module.scss";
import { useAppServices } from "../services/AppServicesProvider";
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
  resolvedAddress
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

  const tooltipCommon = `${addrLabel}${(ioRead || ioWrite) && ioMask ? " /$" + toHexa4(ioMask) : ""} (${bpType})`;
  const tooltip =
    `${tooltipCommon})\n` +
    (hasBreakpoint ? `Right-click to remove this breakpoint` : "Right-click to set a breakpoint");
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
    >
      {showType && (
        <div ref={cbkRef} style={{ zoom: 0.8 }}>
          <Checkbox key={address} initialValue={!isDisabled} right={true} onChange={enableOrDisable} />
          <TooltipFactory
            refElement={cbkRef.current}
            placement="right"
            offsetX={0}
            offsetY={40}
            showDelay={100}
            content={tooltipCheckbox}
          />
        </div>
      )}
      <div
        ref={ref}
        style={{ display: "flex", flexDirection: "row", justifyContent: "center" }}
        onContextMenu={handleRemove}
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
    </div>
  );
};
