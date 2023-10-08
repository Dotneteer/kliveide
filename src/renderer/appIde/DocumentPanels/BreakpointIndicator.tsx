import { useState, useRef } from "react";
import { Icon } from "@controls/Icon";
import { TooltipFactory } from "@controls/Tooltip";
import { toHexa4 } from "../services/ide-commands";
import styles from "./BreakpointIndicator.module.scss";
import { useAppServices } from "../services/AppServicesProvider";

type Props = {
  address: number | string;
  partition?: number;
  hasBreakpoint: boolean;
  disabled: boolean;
  current: boolean;
};

export const BreakpointIndicator = ({
  address,
  partition,
  hasBreakpoint,
  disabled,
  current
}: Props) => {
  const { ideCommandsService } = useAppServices();
  const ref = useRef<HTMLDivElement>(null);
  const [pointed, setPointed] = useState(false);

  // --- Calculate tooltip text
  const addrLabel =
    typeof address === "number"
      ? partition !== undefined
        ? `${partition < 0 ? `R${-(partition + 1)}` : partition}:$${toHexa4(
            address
          )}`
        : `$${toHexa4(address)}`
      : address;
  const tooltip =
    `${addrLabel}\n` +
    (hasBreakpoint
      ? `Left-click to remove\nRight-click to ${
          disabled ? "enable" : "disable"
        }`
      : "Click to set a breakpoint");
  const toolTipLines = (tooltip ?? "").split("\n");

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
    const command = `${hasBreakpoint ? "bp-del" : "bp-set"} ${addrLabel}`;
    console.log(command);
    await ideCommandsService.executeCommand(command);
  };

  // --- Handle enabling/disabling a breakpoint
  const handleRightClick = async () => {
    const command = `bp-en ${addrLabel} ${disabled ? "" : "-d"}`;
    console.log(command);
    if (hasBreakpoint) {
      await ideCommandsService.executeCommand(command);
    }
  };

  return (
    <div
      ref={ref}
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
        placement='right'
        offsetX={0}
        offsetY={40}
        showDelay={100}
      >
        {toolTipLines.map((l, idx) => (
          <div key={idx}>{l}</div>
        ))}
      </TooltipFactory>
    </div>
  );
};
