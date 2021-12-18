import * as React from "react";

import { getContextMenuService } from "@core/service-registry";
import { CSSProperties, useEffect, useState } from "react";
import { Activity } from "@core/abstractions/activity";
import { commandStatusChanged } from "@abstractions/command-registry";
import {
  isCommandGroup,
  isKliveCommand,
  MenuItem,
} from "@abstractions/command-definitions";
import { CommandIconButton } from "../context-menu/CommandIconButton";
import { Fill, Row } from "@components/Panels";

type Props = {
  activity: Activity;
};

export const SideBarHeader: React.VFC<Props> = ({ activity }) => {
  return (
    <Row height={35}>
      <Fill
        style={{ paddingLeft: 4, alignItems: "center", flexDirection: "row" }}
      >
        <span style={textStyle}>{activity.title.toUpperCase()}</span>
        <CommandBar commands={activity.commands} />
      </Fill>
    </Row>
  );
};

const textStyle: CSSProperties = {
  color: "var(--sidebar-header-color)",
  fontSize: "0.8em",
  fontWeight: 400,
  paddingLeft: 20,
  width: "100%",
  flexGrow: 1,
  flexShrink: 1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

type CommandBarProps = {
  commands?: MenuItem[];
};

const CommandBar: React.VFC<CommandBarProps> = ({ commands }) => {
  const [refreshCount, setRefreshCount] = useState(0);

  // --- Take care to update command status
  const onCommandStatusChanged = () => {
    setRefreshCount(refreshCount + 1);
  };

  // --- Mount/unmount component
  useEffect(() => {
    commandStatusChanged.on(onCommandStatusChanged);
    return () => {
      commandStatusChanged.off(onCommandStatusChanged);
    };
  });

  const style: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    flexGrow: 0,
    flexShrink: 0,
    height: "100%",
    width: "auto",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: "6px",
    paddingRight: "6px",
    background: "var(--commandbar-background-color)",
  };

  const buttons: JSX.Element[] = [];
  if (commands) {
    commands.forEach((cmd, index) => {
      if (typeof cmd === "string") {
        return;
      } else if (isCommandGroup(cmd)) {
        buttons.push(
          <CommandIconButton
            key={index}
            doNotPropagate={true}
            iconName="ellipsis"
            title={cmd.text}
            enabled={cmd.enabled}
            clicked={async (e: React.MouseEvent) => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              await getContextMenuService().openMenu(
                cmd.items,
                rect.y + 20,
                rect.x,
                e.target as HTMLElement
              );
            }}
          />
        );
      } else if (isKliveCommand(cmd)) {
        buttons.push(
          <CommandIconButton
            key={index}
            doNotPropagate={true}
            commandId={cmd.commandId}
          />
        );
      } else {
        buttons.push(
          <CommandIconButton
            key={index}
            doNotPropagate={true}
            iconName={cmd.iconName ?? "question"}
            enabled={cmd.enabled}
            title={cmd.text}
            clicked={cmd.execute}
          />
        );
      }
    });
  }

  return <div style={style}>{buttons}</div>;
};
