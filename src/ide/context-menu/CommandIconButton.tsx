import * as React from "react";
import { useRef, useState } from "react";

import { getThemeService } from "@core/service-registry";
import { executeCommand, getCommand } from "@abstractions/command-registry";
import { IKliveCommand } from "@abstractions/command-definitions";
import { Icon } from "@components/Icon";

interface Props {
  commandId?: string;
  iconName?: string;
  size?: number;
  title?: string;
  fill?: string;
  enabled?: boolean;
  clicked?: (ev: React.MouseEvent) => void;
  setContext?: () => any;
  doNotPropagate?: boolean;
}

/**
 * Represents the statusbar of the emulator
 */
export default function CommandIconButton({
  commandId,
  iconName,
  size = 16,
  title,
  fill,
  enabled,
  clicked,
  setContext,
  doNotPropagate = false,
}: Props) {
  const hostElement = useRef<HTMLDivElement>();
  const [pointed, setPointed] = useState(false);
  const [mouseDown, setMouseDown] = useState(false);

  const command: IKliveCommand = commandId ? getCommand(commandId) : null;
  if (!iconName) {
    iconName = command?.icon ?? "question";
  }
  if (!title) {
    title = command?.title ?? command?.commandId ?? "<none>";
  }
  if (enabled === null || enabled === undefined) {
    enabled = command?.enabled ?? true;
  }

  const themeService = getThemeService();
  const pointedBackground = themeService.getProperty(
    "--icon-pointed-background"
  );
  const mouseDownBackground = themeService.getProperty(
    "--icon-mousedown-background"
  );

  const style = {
    display: "flex",
    padding: "2px 2px",
    margin: "0",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    background: pointed
      ? mouseDown && enabled
        ? mouseDownBackground
        : pointedBackground
      : "transparent",
  };

  const handleClick = async (ev: React.MouseEvent) => {
    if (command) {
      const context = setContext ? setContext() : undefined;
      await executeCommand(command.commandId, context);
    } else {
      if (clicked && enabled) {
        clicked(ev);
      }
    }
    if (doNotPropagate) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  };

  return (
    <div
      ref={hostElement}
      style={style}
      title={title}
      onClick={handleClick}
      onMouseDown={(ev) => setMouseDown(ev.button === 0)}
      onMouseUp={() => setMouseDown(false)}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => {
        setPointed(false);
        setMouseDown(false);
      }}
    >
      <Icon
        iconName={iconName}
        fill={enabled ?? true ? fill : "--toolbar-button-disabled-fill"}
        width={size}
        height={size}
      />
    </div>
  );
}
