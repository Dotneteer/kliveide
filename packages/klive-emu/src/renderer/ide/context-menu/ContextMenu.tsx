import * as React from "react";
import {
  BeforeOpenCloseMenuEventArgs,
  ContextMenuComponent,
  MenuEventArgs,
  MenuItemModel,
} from "@syncfusion/ej2-react-navigations";
import { useSelector } from "react-redux";
import { AppState } from "../../../shared/state/AppState";
import { animationTick } from "../../common-ui/utils";
import { getContextMenuService } from "../../../abstractions/service-helpers";

import { useState } from "react";
import { useEffect } from "react";
import {
  Command,
  CommandGroup,
  isCommandGroup,
  MenuItem,
} from "../../../shared/command/commands";
import { ContextMenuOpenTarget } from "../../../shared/services/IContextMenuService";

type Props = {
  target: string;
};

export default function IdeContextMenu({ target }: Props) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const ideFocused = useSelector((s: AppState) => s.ideHasFocus);
  let thisComponent: ContextMenuComponent;

  // --- Refresh menu items
  const menuItemsChanged = () => {
    setItems(getContextMenuService().getContextMenu());
  };
  const openRequested = ({ top, left, target }: ContextMenuOpenTarget) => {
    thisComponent?.open(top, left, target);
  };

  useEffect(() => {
    // --- Mount
    const contextMenuService = getContextMenuService();
    contextMenuService.menuChanged.on(menuItemsChanged);
    contextMenuService.openRequested.on(openRequested);

    return () => {
      // --- OnMount
      contextMenuService.menuChanged.off(menuItemsChanged);
      contextMenuService.openRequested.off(openRequested);
    };
  });

  const menuItems = mapToMenuItems(items);

  const beforeOpen = (args: BeforeOpenCloseMenuEventArgs) => {
    if (!getContextMenuService().isOpen) {
      args.cancel = true;
    }
    thisComponent.enableItems(
      collectIds(items, () => true),
      true,
      true
    );
    const disabledIds = collectDisabledIds(items);
    thisComponent.enableItems(disabledIds, false, true);
  };

  const select = (args: MenuEventArgs) => {
    const command = findCommandById(items, args.item.id);
    command?.execute?.();
  };

  const onClose = async () => {
    const contextMenuService = getContextMenuService();
    if (contextMenuService.isOpen) {
      await new Promise((r) => setTimeout(r, 50));
      contextMenuService.close();
    }
  };

  if (!ideFocused) {
    (async () => {
      await animationTick();
      thisComponent?.close();
    })();
  }

  return (
    <ContextMenuComponent
      ref={(scope) => {
        thisComponent = scope;
      }}
      target={target}
      items={menuItems}
      animationSettings={{ effect: "None" }}
      beforeOpen={beforeOpen}
      select={select}
      onClose={onClose}
    />
  );
}

/**
 * Map menu items to the model used by the ContextMenuComponent
 * @param items Items to map
 * @returns Mapped model
 */
function mapToMenuItems(items: MenuItem[]): MenuItemModel[] {
  const menuItems: MenuItemModel[] = [];
  items.forEach((item) => {
    if (typeof item === "string") {
      menuItems.push({
        separator: true,
      });
    } else if (isCommandGroup(item)) {
      if (item.visible ?? true) {
        menuItems.push({
          id: item.id,
          text: item.text,
          items: mapToMenuItems(item.items),
        });
      }
    } else {
      if (item.visible ?? true) {
        menuItems.push({
          id: item.id,
          text: item.text,
        });
      }
    }
  });
  return menuItems;
}

function collectDisabledIds(items: MenuItem[]): string[] {
  return collectIds(items, (i) => !(i.enabled ?? true));
}

function collectIds(
  items: MenuItem[],
  predicate: (item: Command | CommandGroup) => boolean
): string[] {
  const disabledIds: string[] = [];
  items.forEach((item) => {
    if (typeof item === "string") {
      return;
    } else if (isCommandGroup(item)) {
      if (predicate(item)) {
        disabledIds.push(item.id);
      }
      disabledIds.push(...collectDisabledIds(item.items));
    } else {
      if (predicate(item)) {
        disabledIds.push(item.id);
      }
    }
  });
  return disabledIds;
}

/**
 * Map menu items to the model used by the ContextMenuComponent
 * @param items Items to map
 * @returns Mapped model
 */
function findCommandById(items: MenuItem[], id: string): Command | null {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (typeof item === "string") {
      continue;
    } else if (isCommandGroup(item)) {
      const command = findCommandById(item.items, id);
      if (command) {
        return command;
      }
    } else {
      if (item.id === id) {
        return item;
      }
    }
  }
  return null;
}
