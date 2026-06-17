import type { ComponentType } from "react";

export type IdeViewPlacement = "primarySideBar" | "secondarySideBar" | "document" | "tool";

export type IdeViewChrome = "compact" | "document" | "tool";

export type IdeViewHostProps = {
  viewId: string;
  placement: IdeViewPlacement;
  chrome: IdeViewChrome;
};

export type IdeViewInfo = {
  id: string;
  title: string;
  iconName?: string;
  preferredPlacement: IdeViewPlacement;
  allowedPlacements: IdeViewPlacement[];
  renderer?: ComponentType<IdeViewHostProps>;
};

export const ideViewRegistry: IdeViewInfo[] = [
  {
    id: "memory",
    title: "Memory",
    iconName: "memory-icon",
    preferredPlacement: "document",
    allowedPlacements: ["primarySideBar", "secondarySideBar", "document", "tool"]
  },
  {
    id: "disassembly",
    title: "Disassembly",
    iconName: "disassembly-icon",
    preferredPlacement: "document",
    allowedPlacements: ["primarySideBar", "secondarySideBar", "document"]
  },
  {
    id: "output",
    title: "Output",
    iconName: "output",
    preferredPlacement: "tool",
    allowedPlacements: ["document", "tool"]
  },
  {
    id: "scripting-history",
    title: "Scripting History",
    iconName: "symbol-event",
    preferredPlacement: "primarySideBar",
    allowedPlacements: ["primarySideBar", "secondarySideBar", "tool"]
  }
];
