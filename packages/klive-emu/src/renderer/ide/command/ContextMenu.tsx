import * as React from "react";
import {
  ContextMenuComponent,
  MenuItemModel,
} from "@syncfusion/ej2-react-navigations";
import { isCommandGroup, MenuItem } from "./command";
import { useSelector } from "react-redux";
import { AppState } from "../../../shared/state/AppState";
import { animationTick } from "../../../renderer/common/utils";

type Props = {
  target: string;
  context: number | string;
  items: MenuItem[];
};

export default function IdeContextMenu({ target, items }: Props) {
  const ideFocused = useSelector((s: AppState) => s.ideHasFocus);

  var thisComponent: ContextMenuComponent;
  const menuItems = mapToMenuItems(items);

  const beforeOpen = () => {
    const disabledIds = collectDisabledIds(items);
    thisComponent.enableItems(disabledIds, false, true);
  };

  if (!ideFocused) {
    (async () => {
      await animationTick();
      thisComponent.close();
    })()
  }

  return (
    <ContextMenuComponent
      ref={(scope) => (thisComponent = scope)}
      target={target}
      items={menuItems}
      animationSettings={{ effect: "None" }}
      beforeOpen={beforeOpen}
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
  const disabledIds: string[] = [];
  items.forEach((item) => {
    if (typeof item === "string") {
      return;
    } else if (isCommandGroup(item)) {
      if (!(item.enabled ?? true)) {
        disabledIds.push(item.id);
      }
      disabledIds.push(...collectDisabledIds(item.items));
    } else {
      if (!(item.enabled ?? true)) {
        disabledIds.push(item.id);
      }
    }
  });
  return disabledIds;
}
