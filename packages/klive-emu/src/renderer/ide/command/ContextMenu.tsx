import * as React from "react";
import {
  ContextMenuComponent,
  MenuItemModel,
} from "@syncfusion/ej2-react-navigations";
import { isCommandGroup, MenuItem } from "./command";

type Props = {
  target: string;
  items: MenuItem[];
};

export default function IdeContextMenu({ target, items }: Props) {
  const menuItems: MenuItemModel[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      menuItems.push({
        separator: true,
      });
    } else if (isCommandGroup(item)) {
      menuItems.push({
        id: item.id,
        text: item.text,
        items: item.items.map((i) => ({
          id: i.id,
          text: i.text,
        })),
      });
    } else {
      menuItems.push({
        id: item.id,
        text: item.text,
      });
    }
  }
  return <ContextMenuComponent target={target} items={menuItems} animationSettings={{effect: "None"}}/>;
}
